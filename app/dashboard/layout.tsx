import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { RefreshButton } from "@/components/dashboard/RefreshButton";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-sand-200 pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-terracotta-500">Aangan Studio</p>
          <h1 className="font-display text-3xl text-charcoal-700">Voice Agent Dashboard</h1>
          <DashboardNav />
        </div>
        <RefreshButton />
      </header>
      {children}
    </main>
  );
}
