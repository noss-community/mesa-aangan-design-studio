import { getRecentCalls } from "@/lib/calls";
import { CallsTable } from "@/components/dashboard/CallsTable";

export const dynamic = "force-dynamic";

export default async function CallsPage() {
  let calls;
  let loadError: string | null = null;

  try {
    calls = await getRecentCalls();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not load calls.";
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-terracotta-500/30 bg-terracotta-500/5 p-6 text-sm text-charcoal-600">
        <p className="font-medium text-terracotta-600">Couldn&apos;t load calls yet.</p>
        <p className="mt-1 text-charcoal-500">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl text-charcoal-700">Calls</h2>
        <span className="text-xs text-charcoal-400">Most recent {calls!.length} · click a row for the full transcript</span>
      </div>
      <CallsTable calls={calls!} />
    </div>
  );
}
