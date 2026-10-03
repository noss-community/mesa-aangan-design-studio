import { sql } from "./db";
import type { CallRow, OfferedSlot, QualificationState, TranscriptTurn } from "./types";

export interface HandoffNoteInput {
  callId: string;
  transcript: TranscriptTurn[];
  summary: string | null;
  qualification: QualificationState;
  reason: string;
  bookedSlot: OfferedSlot | null;
}

/**
 * Persists the handoff note and logs it. The delivery channel (Telegram vs email) is deliberately
 * left as "pending" — that decision, and the actual send, is wired up in the next session. This
 * function guarantees the note's *content* is fully assembled and durable the moment a call
 * qualifies or escalates, so wiring a channel later is a pure delivery step with no logic to add.
 */
export async function recordHandoffNote(input: HandoffNoteInput): Promise<void> {
  const criteriaAnswers = Object.fromEntries(
    (["criterion_1", "criterion_2", "criterion_3", "criterion_4", "criterion_5"] as const).map((key) => [
      key,
      input.qualification[key],
    ])
  );

  await sql`
    insert into handoff_notes (call_id, transcript, summary, criteria_answers, reason, booked_slot, channel, delivered)
    values (
      ${input.callId},
      ${JSON.stringify(input.transcript)}::jsonb,
      ${input.summary},
      ${JSON.stringify(criteriaAnswers)}::jsonb,
      ${input.reason},
      ${input.bookedSlot ? JSON.stringify(input.bookedSlot) : null}::jsonb,
      'pending',
      false
    )
    on conflict (call_id) do update set
      transcript = excluded.transcript,
      summary = excluded.summary,
      criteria_answers = excluded.criteria_answers,
      reason = excluded.reason,
      booked_slot = excluded.booked_slot
  `;

  // eslint-disable-next-line no-console
  console.log(
    `[handoff-note] call=${input.callId} reason="${input.reason}" channel=pending (Telegram/email TBD next session)`,
    { summary: input.summary, bookedSlot: input.bookedSlot }
  );
}

export function buildHandoffReason(call: Pick<CallRow, "status" | "escalation_triggered" | "escalation_reason">): string {
  if (call.escalation_triggered) {
    return call.escalation_reason ?? "Escalation condition triggered.";
  }
  return "Call qualified against all five criteria.";
}
