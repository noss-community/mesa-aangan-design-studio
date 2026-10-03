import { sql } from "./db";
import { computeCallCostInr, getRates } from "./rates";
import type { CallRow, TranscriptTurn } from "./types";

export interface CallListItem {
  id: string;
  callStartedAt: string;
  callerName: string | null;
  callerPhone: string | null;
  projectLocation: string | null;
  projectType: string | null;
  status: CallRow["status"];
  withinWorkingHours: boolean;
  durationSeconds: number;
  costInr: number;
  bookedSlotStart: string | null;
  escalationReason: string | null;
  summary: string | null;
}

function rowsToCallRows(rows: Record<string, unknown>[]): CallRow[] {
  return rows.map((row) => ({
    ...row,
    qualification: row.qualification,
    offered_slot: row.offered_slot,
  })) as unknown as CallRow[];
}

/** Most recent calls first, newest 200 — an internal tool at this call volume doesn't need real
 * pagination yet (see README if that changes). */
export async function getRecentCalls(): Promise<CallListItem[]> {
  const rows = (await sql`
    select * from calls order by call_started_at desc limit 200
  `) as unknown as Record<string, unknown>[];

  const rates = await getRates();

  return rowsToCallRows(rows).map((call) => ({
    id: call.id,
    callStartedAt: call.call_started_at,
    callerName: call.caller_name,
    callerPhone: call.caller_phone,
    projectLocation: call.project_location,
    projectType: call.project_type,
    status: call.status,
    withinWorkingHours: call.within_working_hours,
    durationSeconds: Number(call.vaani_duration_seconds),
    costInr: computeCallCostInr(
      { vaaniDurationSeconds: Number(call.vaani_duration_seconds), geminiTokensUsed: Number(call.gemini_tokens_used) },
      rates
    ),
    bookedSlotStart: call.booked_slot_start,
    escalationReason: call.escalation_reason,
    summary: call.summary,
  }));
}

export interface CallDetail {
  call: CallRow;
  costInr: number;
  transcript: TranscriptTurn[];
  handoffNote: { reason: string | null; channel: string; delivered: boolean } | null;
}

export async function getCallDetail(id: string): Promise<CallDetail | null> {
  const rows = (await sql`select * from calls where id = ${id} limit 1`) as unknown as Record<string, unknown>[];
  if (rows.length === 0) return null;
  const call = rowsToCallRows(rows)[0];

  const [turnRows, noteRows, rates] = await Promise.all([
    sql`select role, text, at_label from call_turns where call_id = ${id} order by turn_index asc` as unknown as Promise<
      Array<{ role: "caller" | "agent"; text: string; at_label: string | null }>
    >,
    sql`select reason, channel, delivered from handoff_notes where call_id = ${id} limit 1` as unknown as Promise<
      Array<{ reason: string | null; channel: string; delivered: boolean }>
    >,
    getRates(),
  ]);

  return {
    call,
    costInr: computeCallCostInr(
      { vaaniDurationSeconds: Number(call.vaani_duration_seconds), geminiTokensUsed: Number(call.gemini_tokens_used) },
      rates
    ),
    transcript: turnRows.map((t) => ({ role: t.role, text: t.text, at: t.at_label ?? "" })),
    handoffNote: noteRows[0] ?? null,
  };
}
