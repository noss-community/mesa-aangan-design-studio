export type CriterionStatus = "pass" | "fail" | "unclear" | "not_assessed";

export interface CriterionState {
  status: CriterionStatus;
  note: string;
}

export interface QualificationState {
  criterion_1: CriterionState;
  criterion_2: CriterionState;
  criterion_3: CriterionState;
  criterion_4: CriterionState;
  criterion_5: CriterionState;
}

export type CallStatus =
  | "in_progress"
  | "qualified"
  | "booked"
  | "declined"
  | "escalated"
  | "abandoned";

export type BookingStatus = "not_ready" | "offered" | "confirmed" | "declined";

export interface OfferedSlot {
  start: string; // ISO timestamp
  end: string; // ISO timestamp
  label: string; // human-readable, e.g. "Thursday, 9 Oct at 3:00 PM"
}

export interface CallRow {
  id: string;
  vaani_call_id: string;
  caller_phone: string | null;
  caller_name: string | null;
  call_started_at: string;
  call_ended_at: string | null;
  first_response_at: string | null;
  within_working_hours: boolean;
  status: CallStatus;
  qualification: QualificationState;
  escalation_triggered: boolean;
  escalation_condition: number | null;
  escalation_reason: string | null;
  booking_status: BookingStatus;
  offered_slot: OfferedSlot | null;
  booked_slot_start: string | null;
  booked_slot_end: string | null;
  calcom_booking_id: string | null;
  hubspot_deal_id: string | null;
  gemini_tokens_used: number;
  gemini_calls_count: number;
  vaani_duration_seconds: number;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranscriptTurn {
  role: "caller" | "agent";
  text: string;
  at: string; // the "HH:MM:SS" label from Vaani's transcript, or an ISO timestamp as fallback
}

/**
 * Vaani's real webhook event envelope (confirmed against docs.vaanivoice.ai 2026-10-03 — their
 * webhooks are fire-and-forget notifications, not a request/response contract; we always reply
 * 200 and never supply conversational text back). `room_name` is the one identifier present on
 * every event type; `call_id` only shows up from call_postprocessing onward and equals room_name.
 */
export interface VaaniWebhookEnvelope {
  event: string;
  room_name?: string;
  call_id?: string;
  status?: string;
  phone_number?: string;
  timestamp?: string;
  data?: VaaniCallPostprocessingData;
}

export interface VaaniCallPostprocessingData {
  room_name: string;
  call_id: string;
  call_duration: number; // milliseconds
  end_reason?: string;
  summary?: string;
  entities?: Record<string, string>;
  dispositions?: Record<string, string>;
  recording_url?: string;
  /** Single multi-line string: "[HH:MM:SS] AGENT: ...\n[HH:MM:SS] USER: ..." — see lib/transcript.ts */
  transcript?: string;
}

export interface CallAnalysisResult {
  qualification: QualificationState;
  overall_status: "qualified" | "declined";
  escalation: {
    triggered: boolean;
    condition: 1 | 2 | 3 | 4 | null;
    reason: string | null;
  };
  summary: string;
}
