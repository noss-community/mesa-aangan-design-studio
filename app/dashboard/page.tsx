import { getEconomicsMetrics, getPerformanceMetrics } from "@/lib/metrics";
import { PerformancePanel } from "@/components/dashboard/PerformancePanel";
import { EconomicsPanel } from "@/components/dashboard/EconomicsPanel";
import { RefreshButton } from "@/components/dashboard/RefreshButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let performance;
  let economics;
  let loadError: string | null = null;

  try {
    [performance, economics] = await Promise.all([getPerformanceMetrics(30), getEconomicsMetrics()]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not load metrics.";
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-sand-200 pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-terracotta-500">Aangan Studio</p>
          <h1 className="font-display text-3xl text-charcoal-700">Voice Agent Dashboard</h1>
        </div>
        <RefreshButton />
      </header>

      {loadError ? (
        <div className="rounded-2xl border border-terracotta-500/30 bg-terracotta-500/5 p-6 text-sm text-charcoal-600">
          <p className="font-medium text-terracotta-600">Couldn&apos;t load metrics yet.</p>
          <p className="mt-1 text-charcoal-500">
            {loadError} — check that <code className="rounded bg-white/60 px-1">DATABASE_URL</code> is set and the
            schema has been applied (<code className="rounded bg-white/60 px-1">npm run db:migrate</code>).
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <PerformancePanel metrics={performance!} />
          <EconomicsPanel metrics={economics!} />
        </div>
      )}
    </main>
  );
}
