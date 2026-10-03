import Link from "next/link";
import type { CallListItem } from "@/lib/calls";
import { formatInr, formatSeconds } from "@/lib/format";
import { formatIstLabel } from "@/lib/workingHours";
import { StatusBadge } from "./StatusBadge";

const GRID_COLS = "grid-cols-[1.3fr_1.1fr_1.2fr_0.7fr_0.7fr_0.9fr_1.3fr_2fr]";

function scheduledCell(call: CallListItem): string {
  if (call.bookedSlotStart) return formatIstLabel(new Date(call.bookedSlotStart));
  if (call.status === "qualified") return "Not booked yet";
  if (call.status === "escalated") return "Handed off";
  return "—";
}

export function CallsTable({ calls }: { calls: CallListItem[] }) {
  if (calls.length === 0) {
    return (
      <div className="rounded-2xl border border-sand-200 bg-sand-50/60 p-10 text-center text-sm text-charcoal-400">
        No calls yet. Once Vaani&apos;s webhook is wired up, every inbound call will show up here right after it ends.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-sand-200 bg-sand-50/60 shadow-panel">
      <div className="min-w-[1100px]">
        <div
          className={`grid ${GRID_COLS} gap-3 border-b border-sand-200 px-5 py-3 text-xs font-medium uppercase tracking-wide text-charcoal-400`}
        >
          <span>Date &amp; time</span>
          <span>Caller</span>
          <span>Project</span>
          <span>Duration</span>
          <span>Cost</span>
          <span>Status</span>
          <span>Scheduled</span>
          <span>Summary</span>
        </div>
        <div className="divide-y divide-sand-200">
          {calls.map((call) => (
            <Link
              key={call.id}
              href={`/dashboard/calls/${call.id}`}
              className={`grid ${GRID_COLS} gap-3 px-5 py-3 text-sm text-charcoal-600 transition hover:bg-white/70`}
            >
              <span className="whitespace-nowrap">
                {formatIstLabel(new Date(call.callStartedAt))}
                {!call.withinWorkingHours && (
                  <span className="ml-1.5 rounded bg-sand-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-charcoal-400">
                    After hours
                  </span>
                )}
              </span>
              <span className="truncate">
                {call.callerName || "Unknown caller"}
                {call.callerPhone ? <span className="block text-xs text-charcoal-400">{call.callerPhone}</span> : null}
              </span>
              <span className="truncate text-charcoal-500">
                {[call.projectType, call.projectLocation].filter(Boolean).join(" — ") || "—"}
              </span>
              <span>{formatSeconds(call.durationSeconds)}</span>
              <span>{formatInr(call.costInr)}</span>
              <span>
                <StatusBadge status={call.status} />
              </span>
              <span className="truncate text-charcoal-500">{scheduledCell(call)}</span>
              <span className="truncate text-charcoal-500">
                {call.status === "escalated" ? call.escalationReason : call.summary}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
