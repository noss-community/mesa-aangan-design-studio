import type { QualificationState, TranscriptTurn } from "./types";

const HUBSPOT_BASE = "https://api.hubapi.com";

function getToken(): string {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    throw new Error("HUBSPOT_ACCESS_TOKEN is not set.");
  }
  return token;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export interface CreateQualifiedDealInput {
  callerName: string;
  callerPhone: string;
  qualification: QualificationState;
  transcript: TranscriptTurn[];
  bookedSlotLabel: string | null;
}

export interface CreateQualifiedDealResult {
  dealId: string;
}

/**
 * Creates a HubSpot deal for a qualified call, sets it to the "Consultation Booked" stage, records
 * each of the five qualification answers as custom deal properties, and attaches the full
 * transcript as a note on the deal.
 *
 * Custom properties expected on the Deal object (create these once in HubSpot under
 * Settings -> Properties -> Deal properties before going live):
 *   aangan_criterion_1_answer .. aangan_criterion_5_answer   (single-line text)
 */
export async function createQualifiedDeal(input: CreateQualifiedDealInput): Promise<CreateQualifiedDealResult> {
  const token = getToken();
  const dealStageId = process.env.HUBSPOT_DEAL_STAGE_ID;
  if (!dealStageId) {
    throw new Error("HUBSPOT_DEAL_STAGE_ID is not set.");
  }

  const criteriaProperties: Record<string, string> = {};
  (["criterion_1", "criterion_2", "criterion_3", "criterion_4", "criterion_5"] as const).forEach((key, i) => {
    const c = input.qualification[key];
    criteriaProperties[`aangan_criterion_${i + 1}_answer`] = `${c.status}: ${c.note}`;
  });

  const dealRes = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/deals`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      properties: {
        dealname: `${input.callerName || "Unnamed caller"} — consultation booked`,
        dealstage: dealStageId,
        ...(process.env.HUBSPOT_PIPELINE_ID ? { pipeline: process.env.HUBSPOT_PIPELINE_ID } : {}),
        ...criteriaProperties,
      },
    }),
  });

  if (!dealRes.ok) {
    throw new Error(`HubSpot deal creation failed: ${dealRes.status} ${await dealRes.text()}`);
  }

  const deal = (await dealRes.json()) as { id: string };

  const transcriptText = input.transcript.map((t) => `${t.role}: ${t.text}`).join("\n");
  const noteBody = [
    `Call transcript — ${input.callerName || "caller"} (${input.callerPhone || "no number"})`,
    input.bookedSlotLabel ? `Booked slot: ${input.bookedSlotLabel}` : null,
    "",
    transcriptText,
  ]
    .filter(Boolean)
    .join("\n");

  const noteRes = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/notes`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      properties: {
        hs_note_body: noteBody,
        hs_timestamp: Date.now(),
      },
      associations: [
        {
          to: { id: deal.id },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 214 }],
        },
      ],
    }),
  });

  if (!noteRes.ok) {
    // Deal exists even if the note attach fails — surface but don't throw, the deal is the important part.
    console.error("HubSpot note attach failed:", noteRes.status, await noteRes.text());
  }

  return { dealId: deal.id };
}
