import { get as edgeConfigGet } from "@vercel/edge-config";

export interface Rates {
  vaaniLabsRatePerMin: number;
  geminiRatePerMillion: number;
  averageProjectValueInr: number;
}

const DEFAULTS: Rates = {
  vaaniLabsRatePerMin: 12,
  geminiRatePerMillion: 300,
  averageProjectValueInr: 1_100_000,
};

async function edgeConfigNumber(key: string): Promise<number | null> {
  if (!process.env.EDGE_CONFIG) return null;
  try {
    const value = await edgeConfigGet<number | string>(key);
    if (value === undefined || value === null) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  } catch {
    // Edge Config not reachable / key missing — fall through to env vars.
    return null;
  }
}

function envNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Resolves the three Economics-panel rates. Preference order:
 *   1. Vercel Edge Config (if EDGE_CONFIG is linked) — editable at runtime, no redeploy.
 *   2. Plain environment variables — require a redeploy on Vercel to take effect.
 *   3. Hard defaults (12, 300, 1,100,000).
 *
 * Called fresh on every dashboard/metrics request — never cache the result across requests.
 */
export async function getRates(): Promise<Rates> {
  const [vaani, gemini, avgProject] = await Promise.all([
    edgeConfigNumber("VAANI_LABS_RATE_PER_MIN"),
    edgeConfigNumber("GEMINI_API_RATE_PER_MILLION"),
    edgeConfigNumber("AVERAGE_PROJECT_VALUE_INR"),
  ]);

  return {
    vaaniLabsRatePerMin: vaani ?? envNumber("VAANI_LABS_RATE_PER_MIN", DEFAULTS.vaaniLabsRatePerMin),
    geminiRatePerMillion: gemini ?? envNumber("GEMINI_API_RATE_PER_MILLION", DEFAULTS.geminiRatePerMillion),
    averageProjectValueInr:
      avgProject ?? envNumber("AVERAGE_PROJECT_VALUE_INR", DEFAULTS.averageProjectValueInr),
  };
}

export function computeCallCostInr(
  input: { vaaniDurationSeconds: number; geminiTokensUsed: number },
  rates: Rates
): number {
  const vaaniCost = (input.vaaniDurationSeconds / 60) * rates.vaaniLabsRatePerMin;
  const geminiCost = (input.geminiTokensUsed / 1_000_000) * rates.geminiRatePerMillion;
  return vaaniCost + geminiCost;
}
