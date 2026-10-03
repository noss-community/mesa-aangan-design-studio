import { neon } from "@neondatabase/serverless";

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add your Neon connection string to the environment (see .env.example)."
    );
  }
  return url;
}

// Lazily created so the module can be imported (e.g. by the dashboard build) even before
// DATABASE_URL is configured — the error only surfaces when a query actually runs.
let cached: ReturnType<typeof neon> | null = null;

export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  if (!cached) {
    cached = neon(getConnectionString());
  }
  return cached(strings, ...values);
}
