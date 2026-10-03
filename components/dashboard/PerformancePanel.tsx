import type { PerformanceMetrics } from "@/lib/metrics";
import { formatPct, formatSeconds } from "@/lib/format";
import { MetricCard } from "./MetricCard";

export function PerformancePanel({ metrics }: { metrics: PerformanceMetrics }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-sand-200 bg-sand-50/60 p-6 shadow-panel">
      <header className="flex items-baseline justify-between">
        <h2 className="font-display text-xl text-charcoal-700">Performance</h2>
        <span className="text-xs text-charcoal-400">Last {metrics.periodDays} days · {metrics.totalCalls} calls</span>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricCard
          label="Median time to first response"
          value={metrics.medianFirstResponseSeconds !== null ? formatSeconds(metrics.medianFirstResponseSeconds) : "—"}
          sublabel="Call start → agent's first reply"
          accent="terracotta"
        />
        <MetricCard
          label="Answered under 60s"
          value={metrics.pctUnderSixtySeconds !== null ? formatPct(metrics.pctUnderSixtySeconds) : "—"}
          sublabel="Share of calls"
          accent="sage"
        />
        <MetricCard
          label="Overnight calls"
          value={String(metrics.overnightCallCount)}
          sublabel="Started 7pm–10am IST"
        />
        <MetricCard
          label="Qualified rate"
          value={metrics.qualifiedRatePct !== null ? formatPct(metrics.qualifiedRatePct) : "—"}
          sublabel="Qualified ÷ total calls"
          accent="terracotta"
        />
      </div>
    </section>
  );
}
