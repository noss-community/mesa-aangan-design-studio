interface MetricCardProps {
  label: string;
  value: string;
  sublabel?: string;
  accent?: "terracotta" | "sage" | "charcoal";
}

const accentClasses: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  terracotta: "text-terracotta-600",
  sage: "text-sage-600",
  charcoal: "text-charcoal-600",
};

export function MetricCard({ label, value, sublabel, accent = "charcoal" }: MetricCardProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-sand-200 bg-white/70 px-5 py-4 shadow-panel">
      <span className="text-xs font-medium uppercase tracking-wide text-charcoal-400">{label}</span>
      <span className={`font-display text-3xl leading-tight ${accentClasses[accent]}`}>{value}</span>
      {sublabel ? <span className="text-xs text-charcoal-400">{sublabel}</span> : null}
    </div>
  );
}
