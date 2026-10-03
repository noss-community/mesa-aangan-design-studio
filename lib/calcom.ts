import type { OfferedSlot } from "./types";
import { formatIstLabel } from "./workingHours";

const CALCOM_BASE = "https://api.cal.com/v2";

// Cal.com v2 versions endpoints independently via the `cal-api-version` header — confirmed by
// trial against the live API 2026-10-03: /slots 404s on 2024-08-13 (the bookings/event-types
// version) and needs 2024-09-04 specifically. Not documented anywhere obvious; keep these two
// separate rather than assuming one CALCOM_API_VERSION covers every endpoint.
const SLOTS_API_VERSION = "2024-09-04";

function getConfig() {
  const apiKey = process.env.CALCOM_API_KEY;
  const eventTypeId = process.env.CALCOM_EVENT_TYPE_ID;
  if (!apiKey || !eventTypeId) {
    throw new Error("CALCOM_API_KEY / CALCOM_EVENT_TYPE_ID are not set.");
  }
  return {
    apiKey,
    eventTypeId,
    bookingsApiVersion: process.env.CALCOM_API_VERSION ?? "2024-08-13",
    timeZone: process.env.CALCOM_TIMEZONE ?? "Asia/Kolkata",
  };
}

function headers(apiKey: string, apiVersion: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "cal-api-version": apiVersion,
  };
}

/**
 * Finds the next available consultation slot from now, looking ahead up to 14 days.
 * Cal.com v2's GET /slots returns a map of date -> slot start times.
 */
export async function getNextAvailableSlot(): Promise<OfferedSlot | null> {
  const { apiKey, eventTypeId, timeZone } = getConfig();

  const start = new Date();
  const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);

  const url = new URL(`${CALCOM_BASE}/slots`);
  url.searchParams.set("eventTypeId", eventTypeId);
  url.searchParams.set("start", start.toISOString());
  url.searchParams.set("end", end.toISOString());
  url.searchParams.set("timeZone", timeZone);

  const res = await fetch(url, { headers: headers(apiKey, SLOTS_API_VERSION) });
  if (!res.ok) {
    throw new Error(`Cal.com slots lookup failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { data?: Record<string, Array<{ start: string }>> };
  const days = Object.keys(body.data ?? {}).sort();

  for (const day of days) {
    const slots = body.data?.[day] ?? [];
    for (const slot of slots) {
      const startDate = new Date(slot.start);
      const durationMinutes = 60; // Aangan consultations are booked as 1-hour blocks.
      const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
      return {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        label: formatIstLabel(startDate),
      };
    }
  }
  return null;
}

export interface BookConsultationInput {
  slot: OfferedSlot;
  callerName: string;
  callerPhone: string;
}

export interface BookConsultationResult {
  bookingId: string;
}

/**
 * Cal.com requires an attendee email even though we only ever collect a phone number on the call,
 * and validates that the domain can receive mail — an RFC 2606 reserved domain like .invalid gets
 * rejected with "email_domain_cannot_receive_mail" (confirmed against the live API 2026-10-03), so
 * a domain with real MX records is required even though no real mailbox exists at this address.
 * The team works off the phone number (stored in notes/metadata) and the handoff note, not a
 * calendar-invite email — any mail Cal.com tries to send here will just bounce, harmlessly.
 */
function placeholderEmail(callerPhone: string): string {
  const digits = (callerPhone || "unknown").replace(/[^0-9]/g, "") || "unknown";
  return `aangan-voice-agent-caller-${digits}@gmail.com`;
}

export async function bookConsultation(input: BookConsultationInput): Promise<BookConsultationResult> {
  const { apiKey, eventTypeId, bookingsApiVersion, timeZone } = getConfig();

  const res = await fetch(`${CALCOM_BASE}/bookings`, {
    method: "POST",
    headers: headers(apiKey, bookingsApiVersion),
    body: JSON.stringify({
      eventTypeId: Number(eventTypeId),
      start: input.slot.start,
      attendee: {
        name: input.callerName || "Aangan Studio caller",
        email: placeholderEmail(input.callerPhone),
        phoneNumber: input.callerPhone || undefined,
        timeZone,
      },
      metadata: { source: "voice-agent", caller_phone: input.callerPhone || "" },
    }),
  });

  if (!res.ok) {
    throw new Error(`Cal.com booking failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { data?: { uid?: string; id?: string | number } };
  const bookingId = String(body.data?.uid ?? body.data?.id ?? "");
  return { bookingId };
}
