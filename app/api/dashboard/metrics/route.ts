import { NextRequest, NextResponse } from "next/server";
import { getEconomicsMetrics, getPerformanceMetrics } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always recompute — economics rates must reflect the latest config

export async function GET(req: NextRequest) {
  const periodDays = Number(req.nextUrl.searchParams.get("periodDays") ?? "30") || 30;

  try {
    const [performance, economics] = await Promise.all([
      getPerformanceMetrics(periodDays),
      getEconomicsMetrics(),
    ]);
    return NextResponse.json({ performance, economics, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Dashboard metrics error:", err);
    return NextResponse.json({ error: "failed to compute metrics" }, { status: 500 });
  }
}
