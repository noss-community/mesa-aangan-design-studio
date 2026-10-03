"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/calls", label: "Calls" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-3 flex gap-1">
      {TABS.map((tab) => {
        const active = tab.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              active ? "bg-terracotta-500/15 text-terracotta-600" : "text-charcoal-400 hover:text-charcoal-600"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
