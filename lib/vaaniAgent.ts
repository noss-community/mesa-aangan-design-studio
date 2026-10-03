// Client for Vaani's agent-configuration REST API (api.vaanivoice.ai). Used by
// scripts/setup-vaani-agent.ts, not by the live webhook path. Note the API's own inconsistency:
// agent CRUD is under /api/agent/{id}/... (singular) for config PATCHes, confirmed against
// docs.vaanivoice.ai/api-reference/* on 2026-10-03.

const VAANI_BASE = "https://api.vaanivoice.ai";

function getApiKey(): string {
  const key = process.env.VAANI_API_KEY;
  if (!key) throw new Error("VAANI_API_KEY is not set.");
  return key;
}

function headers(apiKey: string) {
  return { "X-API-Key": apiKey, "Content-Type": "application/json" };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${VAANI_BASE}${path}`, {
    method,
    headers: headers(getApiKey()),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Vaani API ${method} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export interface CreateAgentResult {
  agent_id: string;
  [key: string]: unknown;
}

export function createAgent(displayName: string, systemPrompt: string) {
  return request<CreateAgentResult>("POST", "/api/create-agent", {
    agent_display_name: displayName,
    config: { persona: { identity: { system_prompt: systemPrompt } } },
  });
}

export function updateSystemPrompt(agentId: string, systemPrompt: string) {
  return request("PATCH", `/api/agent/${agentId}/persona`, {
    identity: { system_prompt: systemPrompt },
  });
}

export function updateAnalysisConfig(agentId: string) {
  return request("PATCH", `/api/agent/${agentId}/analysis`, {
    evaluations: {
      dispositions: {
        enabled: true,
        prompt_based: [
          {
            name: "call_outcome",
            type: "string",
            prompt:
              "Classify this call as one of: qualified (caller passed the five-criterion rubric), declined (caller clearly did not fit), escalated (handed off per an escalation condition), or incomplete (call dropped before an outcome was reached).",
            list_of_tags: {
              qualified: "caller qualified for a consultation",
              declined: "caller was declined",
              escalated: "call was escalated to a human",
              incomplete: "call ended without a clear outcome",
            },
          },
        ],
      },
    },
    extraction: {
      data_collection: {
        enabled: true,
        data_points: [
          { name: "caller_name", prompt: "Extract the caller full name, if given.", nullable: true },
          {
            name: "project_location",
            prompt: "Extract the locality/neighbourhood of the project site mentioned.",
            nullable: true,
          },
          {
            name: "project_type",
            prompt: "Extract a short description of the project type (e.g. full flat, single room, office).",
            nullable: true,
          },
          {
            name: "scheduling_preference",
            prompt: "Extract any day/time preference the caller mentioned for a consultation callback, if any.",
            nullable: true,
          },
        ],
      },
      collect_concerns: { enabled: true },
    },
  });
}

/**
 * Assigns an inbound phone number to the agent. Requires a number already provisioned in the
 * Vaani dashboard (or brought via your own SIP trunk) — provisioning itself isn't exposed in the
 * public API, so run this only after you have a real E.164 number to hand it.
 */
export function assignInboundNumber(agentId: string, e164PhoneNumber: string) {
  return request("PATCH", `/api/agent/${agentId}/deployment`, {
    deployment: { phone: { call_type: { Inbound: e164PhoneNumber } } },
  });
}
