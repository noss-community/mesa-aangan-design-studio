"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastRefreshed, setLastRefreshed] = useState<string>(() =>
    new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
  );

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-charcoal-400">Updated {lastRefreshed}</span>
      <button
        onClick={() =>
          startTransition(() => {
            router.refresh();
            setLastRefreshed(new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }));
          })
        }
        disabled={isPending}
        className="rounded-full border border-terracotta-500/30 bg-terracotta-500/10 px-4 py-1.5 text-sm font-medium text-terracotta-600 transition hover:bg-terracotta-500/20 disabled:opacity-50"
      >
        {isPending ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
