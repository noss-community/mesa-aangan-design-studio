import { getEconomicsMetrics, getPerformanceMetrics } from "@/lib/metrics";
import { PerformancePanel } from "@/components/dashboard/PerformancePanel";
import { EconomicsPanel } from "@/components/dashboard/EconomicsPanel";

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

  if (loadError) {
    return (
      <div className="rounded-2xl border border-terracotta-500/30 bg-terracotta-500/5 p-6 text-sm text-charcoal-600">
        <p className="font-medium text-terracotta-600">Couldn&apos;t load metrics yet.</p>
        <p className="mt-1 text-charcoal-500">
          {loadError} — check that <code className="rounded bg-white/60 px-1">DATABASE_URL</code> is set and the
          schema has been applied (<code className="rounded bg-white/60 px-1">npm run db:migrate</code>).
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PerformancePanel metrics={performance!} />
      <EconomicsPanel metrics={economics!} />
    </div>
  );
}
