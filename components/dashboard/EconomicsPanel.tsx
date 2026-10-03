import type { EconomicsMetrics } from "@/lib/metrics";
import { formatInr, formatMultiple } from "@/lib/format";
import { MetricCard } from "./MetricCard";

export function EconomicsPanel({ metrics }: { metrics: EconomicsMetrics }) {
  const now = new Date();
  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-sand-200 bg-sand-50/60 p-6 shadow-panel">
      <header className="flex items-baseline justify-between">
        <h2 className="font-display text-xl text-charcoal-700">Economics</h2>
        <span className="text-xs text-charcoal-400">{monthLabel}</span>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="AI cost per call"
          value={metrics.avgCostPerCallInr !== null ? formatInr(metrics.avgCostPerCallInr) : "—"}
          sublabel="Avg. this month"
        />
        <MetricCard
          label="Total AI spend"
          value={formatInr(metrics.totalSpendThisMonthInr)}
          sublabel="This month"
          accent="terracotta"
        />
        <MetricCard
          label="Consultations booked"
          value={String(metrics.consultationsBookedThisMonth)}
          sublabel="This month"
          accent="sage"
        />
        <MetricCard
          label="Pipeline in progress"
          value={formatInr(metrics.estimatedPipelineInr, { compact: true })}
          sublabel="Booked × avg. project value"
          accent="sage"
        />
        <MetricCard
          label="ROI multiple"
          value={metrics.roiMultiple !== null ? formatMultiple(metrics.roiMultiple) : "—"}
          sublabel="Pipeline ÷ AI spend"
          accent="terracotta"
        />
      </div>
      <p className="text-xs text-charcoal-400">
        Rates: {formatInr(metrics.rates.vaaniLabsRatePerMin)}/min voice, {formatInr(metrics.rates.geminiRatePerMillion)}/M
        tokens, {formatInr(metrics.rates.averageProjectValueInr, { compact: true })} avg. project value.
      </p>
    </section>
  );
}
