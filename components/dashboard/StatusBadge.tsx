import type { CallStatus } from "@/lib/types";

const STYLES: Record<CallStatus, { label: string; className: string }> = {
  booked: { label: "Booked", className: "bg-sage-500/15 text-sage-600" },
  qualified: { label: "Qualified", className: "bg-terracotta-400/15 text-terracotta-600" },
  escalated: { label: "Escalated", className: "bg-terracotta-500/20 text-terracotta-700" },
  declined: { label: "Declined", className: "bg-charcoal-500/10 text-charcoal-500" },
  abandoned: { label: "Abandoned", className: "bg-charcoal-500/10 text-charcoal-400" },
  in_progress: { label: "In progress", className: "bg-sand-200 text-charcoal-500" },
};

export function StatusBadge({ status }: { status: CallStatus }) {
  const { label, className } = STYLES[status];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${className}`}>
      {label}
    </span>
  );
}
