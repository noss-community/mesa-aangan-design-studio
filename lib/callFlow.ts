import { sql } from "./db";
import { analyzeCompletedCall } from "./gemini";
import { bookConsultation, getNextAvailableSlot } from "./calcom";
import { createQualifiedDeal } from "./hubspot";
import { buildHandoffReason, recordHandoffNote } from "./handoff";
import { isWithinWorkingHours } from "./workingHours";
import { parseVaaniTranscript } from "./transcript";
import type {
  CallRow,
  OfferedSlot,
  QualificationState,
  VaaniCallPostprocessingData,
  VaaniWebhookEnvelope,
} from "./types";

const BLANK_QUALIFICATION: QualificationState = {
  criterion_1: { status: "not_assessed", note: "" },
  criterion_2: { status: "not_assessed", note: "" },
  criterion_3: { status: "not_assessed", note: "" },
  criterion_4: { status: "not_assessed", note: "" },
  criterion_5: { status: "not_assessed", note: "" },
};

function rowToCall(row: Record<string, unknown>): CallRow {
  return {
    ...row,
    qualification: (row.qualification as QualificationState) ?? BLANK_QUALIFICATION,
    offered_slot: (row.offered_slot as OfferedSlot | null) ?? null,
  } as CallRow;
}

async function getCallByVaaniId(vaaniCallId: string): Promise<CallRow | null> {
  const rows = (await sql`select * from calls where vaani_call_id = ${vaaniCallId} limit 1`) as unknown as Record<
    string,
    unknown
  >[];
  return rows[0] ? rowToCall(rows[0]) : null;
}

export async function handleCallStarted(input: { roomName: string; phoneNumber?: string }): Promise<void> {
  const now = new Date();
  const existing = await getCallByVaaniId(input.roomName);
  if (existing) return; // idempotent — Vaani may retry webhooks

  await sql`
    insert into calls (
      vaani_call_id, caller_phone, call_started_at, first_response_at, within_working_hours, qualification
    )
    values (
      ${input.roomName},
      ${input.phoneNumber ?? null},
      ${now.toISOString()},
      ${now.toISOString()},
      ${isWithinWorkingHours(now)},
      ${JSON.stringify(BLANK_QUALIFICATION)}::jsonb
    )
    on conflict (vaani_call_id) do nothing
  `;
  // first_response_at = call_started_at: Vaani's agent auto-answers every inbound call, so there is
  // no human-style ring-before-pickup delay to measure — see README "Performance panel" notes.
}

export async function handleCallPostprocessing(data: VaaniCallPostprocessingData): Promise<void> {
  const roomName = data.room_name;
  if (!roomName) {
    console.error("call_postprocessing payload missing room_name, dropping:", data);
    return;
  }

  const durationSeconds = (data.call_duration ?? 0) / 1000;
  let call = await getCallByVaaniId(roomName);

  if (!call) {
    // call_started was missed (e.g. webhook registered after this call began) — reconstruct a
    // reasonable call_started_at from the duration so dashboard metrics still make sense.
    const estimatedStart = new Date(Date.now() - durationSeconds * 1000);
    await sql`
      insert into calls (vaani_call_id, call_started_at, first_response_at, within_working_hours, qualification)
      values (
        ${roomName}, ${estimatedStart.toISOString()}, ${estimatedStart.toISOString()},
        ${isWithinWorkingHours(estimatedStart)}, ${JSON.stringify(BLANK_QUALIFICATION)}::jsonb
      )
      on conflict (vaani_call_id) do nothing
    `;
    call = await getCallByVaaniId(roomName);
  }
  if (!call) throw new Error(`Could not create or find call ${roomName}`);

  const transcript = parseVaaniTranscript(data.transcript);
  for (let i = 0; i < transcript.length; i++) {
    const turn = transcript[i];
    await sql`
      insert into call_turns (call_id, turn_index, role, text)
      values (${call.id}, ${i}, ${turn.role}, ${turn.text})
    `;
  }

  const { result, usage } = await analyzeCompletedCall({ transcript });

  const callerName = call.caller_name ?? data.entities?.caller_name ?? null;
  const schedulingPreference = data.entities?.scheduling_preference ?? null;

  let status: CallRow["status"] = result.escalation.triggered
    ? "escalated"
    : result.overall_status === "qualified"
      ? "qualified"
      : "declined";

  let bookingStatus: CallRow["booking_status"] = "not_ready";
  let offeredSlot: OfferedSlot | null = null;
  let calcomBookingId: string | null = null;
  let hubspotDealId: string | null = null;

  if (status === "qualified") {
    try {
      const slot = await getNextAvailableSlot();
      if (slot) {
        const booking = await bookConsultation({
          slot,
          callerName: callerName ?? "",
          callerPhone: call.caller_phone ?? "",
        });
        offeredSlot = slot;
        calcomBookingId = booking.bookingId;
        bookingStatus = "confirmed";
        status = "booked";
      } else {
        console.error(`No Cal.com availability found for call ${roomName} — leaving for manual booking.`);
      }
    } catch (err) {
      console.error(`Cal.com booking failed for call ${roomName}:`, err);
    }
  }

  if (status === "escalated" || status === "qualified" || status === "booked") {
    const reasonBase = buildHandoffReason({
      status,
      escalation_triggered: result.escalation.triggered,
      escalation_reason: result.escalation.reason,
    });
    const reason = schedulingPreference ? `${reasonBase} Caller's stated preference: ${schedulingPreference}.` : reasonBase;

    await recordHandoffNote({
      callId: call.id,
      transcript,
      summary: result.summary,
      qualification: result.qualification,
      reason,
      bookedSlot: offeredSlot,
    });
  }

  if (status === "booked") {
    try {
      const deal = await createQualifiedDeal({
        callerName: callerName ?? "",
        callerPhone: call.caller_phone ?? "",
        qualification: result.qualification,
        transcript,
        bookedSlotLabel: offeredSlot?.label ?? null,
      });
      hubspotDealId = deal.dealId;
    } catch (err) {
      console.error(`HubSpot deal creation failed for call ${roomName}:`, err);
    }
  }

  await sql`
    update calls set
      caller_name = ${callerName},
      call_ended_at = now(),
      vaani_duration_seconds = ${durationSeconds},
      qualification = ${JSON.stringify(result.qualification)}::jsonb,
      status = ${status},
      escalation_triggered = ${result.escalation.triggered},
      escalation_condition = ${result.escalation.condition},
      escalation_reason = ${result.escalation.reason},
      booking_status = ${bookingStatus},
      offered_slot = ${offeredSlot ? JSON.stringify(offeredSlot) : null}::jsonb,
      booked_slot_start = ${offeredSlot?.start ?? null},
      booked_slot_end = ${offeredSlot?.end ?? null},
      calcom_booking_id = ${calcomBookingId},
      hubspot_deal_id = ${hubspotDealId},
      gemini_tokens_used = gemini_tokens_used + ${usage.totalTokens},
      gemini_calls_count = gemini_calls_count + 1,
      summary = ${result.summary}
    where id = ${call.id}
  `;

  console.log(`[call ${roomName}] status=${status} booking=${bookingStatus} escalated=${result.escalation.triggered}`);
}

const TERMINAL_FAILURE_EVENTS = new Set(["call_rejected", "call_no_answer", "call_failed"]);

/** Everything that isn't call_started / call_postprocessing: logged, and used to close out calls
 * that never reached postprocessing (e.g. the line dropped before Vaani could analyze it). */
export async function handleLifecycleEvent(envelope: VaaniWebhookEnvelope): Promise<void> {
  const roomName = envelope.room_name ?? envelope.call_id;
  console.log(`[vaani webhook] event=${envelope.event} room=${roomName ?? "?"} status=${envelope.status ?? ""}`);

  if (!roomName || !TERMINAL_FAILURE_EVENTS.has(envelope.event)) return;

  const call = await getCallByVaaniId(roomName);
  if (call && call.status === "in_progress") {
    await sql`update calls set status = 'abandoned', call_ended_at = now() where id = ${call.id}`;
  }
}
