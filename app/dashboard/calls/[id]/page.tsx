import Link from "next/link";
import { notFound } from "next/navigation";
import { getCallDetail } from "@/lib/calls";
import { formatInr, formatSeconds } from "@/lib/format";
import { formatIstLabel } from "@/lib/workingHours";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { CRITERIA } from "@/lib/rubric";

export const dynamic = "force-dynamic";

const CRITERION_STATUS_STYLE: Record<string, string> = {
  pass: "bg-sage-500/15 text-sage-600",
  fail: "bg-terracotta-500/20 text-terracotta-700",
  unclear: "bg-sand-200 text-charcoal-500",
  not_assessed: "bg-sand-100 text-charcoal-400",
};

export default async function CallDetailPage({ params }: { params: { id: string } }) {
  const detail = await getCallDetail(params.id);
  if (!detail) notFound();

  const { call, costInr, transcript, handoffNote } = detail;
  const qualification = call.qualification;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/dashboard/calls" className="w-fit text-sm text-terracotta-600 hover:underline">
        ← All calls
      </Link>

      <section className="flex flex-col gap-4 rounded-2xl border border-sand-200 bg-sand-50/60 p-6 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl text-charcoal-700">{call.caller_name || "Unknown caller"}</h1>
            <p className="text-sm text-charcoal-400">{call.caller_phone || "No number captured"}</p>
          </div>
          <StatusBadge status={call.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-sand-200 pt-4 sm:grid-cols-4">
          <Field label="Call started">
            {formatIstLabel(new Date(call.call_started_at))}
            {!call.within_working_hours && <span className="block text-xs text-charcoal-400">After hours</span>}
          </Field>
          <Field label="Duration">{formatSeconds(Number(call.vaani_duration_seconds))}</Field>
          <Field label="AI cost">{formatInr(costInr)}</Field>
          <Field label="Project">
            {[call.project_type, call.project_location].filter(Boolean).join(" — ") || "Not captured"}
          </Field>
        </div>

        {call.status === "booked" && call.booked_slot_start && (
          <div className="rounded-xl bg-sage-500/10 px-4 py-3 text-sm text-sage-600">
            Consultation booked for <strong>{formatIstLabel(new Date(call.booked_slot_start))}</strong>
            {call.calcom_booking_id && (
              <>
                {" "}
                ·{" "}
                <a
                  href={`https://cal.com/booking/${call.calcom_booking_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  view on Cal.com
                </a>
              </>
            )}
          </div>
        )}

        {call.status === "qualified" && !call.booked_slot_start && (
          <div className="rounded-xl bg-terracotta-400/10 px-4 py-3 text-sm text-terracotta-600">
            Qualified, but no slot was booked automatically — follow up manually to schedule.
          </div>
        )}

        {call.escalation_triggered && (
          <div className="rounded-xl bg-terracotta-500/10 px-4 py-3 text-sm text-terracotta-700">
            Escalated (condition {call.escalation_condition}): {call.escalation_reason}
          </div>
        )}

        {call.hubspot_deal_id && (
          <p className="text-xs text-charcoal-400">HubSpot deal id: {call.hubspot_deal_id}</p>
        )}
      </section>

      {call.summary && (
        <section className="rounded-2xl border border-sand-200 bg-sand-50/60 p-6 shadow-panel">
          <h2 className="mb-2 font-display text-lg text-charcoal-700">Summary</h2>
          <p className="text-sm text-charcoal-600">{call.summary}</p>
        </section>
      )}

      <section className="rounded-2xl border border-sand-200 bg-sand-50/60 p-6 shadow-panel">
        <h2 className="mb-4 font-display text-lg text-charcoal-700">Qualification</h2>
        <div className="flex flex-col gap-3">
          {CRITERIA.map((criterion, i) => {
            const key = `criterion_${i + 1}` as keyof typeof qualification;
            const state = qualification[key];
            return (
              <div key={criterion.id} className="flex flex-col gap-1 border-b border-sand-200 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-charcoal-600">
                    {i + 1}. {criterion.title}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${CRITERION_STATUS_STYLE[state.status]}`}
                  >
                    {state.status.replace("_", " ")}
                  </span>
                </div>
                {state.note && <p className="text-xs text-charcoal-400">{state.note}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {handoffNote && (
        <section className="rounded-2xl border border-sand-200 bg-sand-50/60 p-6 shadow-panel">
          <h2 className="mb-2 font-display text-lg text-charcoal-700">Handoff note</h2>
          <p className="text-sm text-charcoal-600">{handoffNote.reason}</p>
          <p className="mt-2 text-xs text-charcoal-400">
            Delivery channel: {handoffNote.channel} {handoffNote.delivered ? "(delivered)" : "(not yet wired up)"}
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-sand-200 bg-sand-50/60 p-6 shadow-panel">
        <h2 className="mb-4 font-display text-lg text-charcoal-700">Transcript</h2>
        {transcript.length === 0 ? (
          <p className="text-sm text-charcoal-400">No transcript available for this call.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {transcript.map((turn, i) => (
              <div key={i} className={`flex ${turn.role === "agent" ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                    turn.role === "agent" ? "bg-white text-charcoal-600" : "bg-terracotta-500/10 text-charcoal-700"
                  }`}
                >
                  <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-charcoal-400">
                    {turn.role === "agent" ? "Agent" : "Caller"} {turn.at ? `· ${turn.at}` : ""}
                  </p>
                  {turn.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-charcoal-400">{label}</span>
      <span className="text-sm text-charcoal-600">{children}</span>
    </div>
  );
}
