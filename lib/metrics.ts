import { sql } from "./db";
import { computeCallCostInr, getRates } from "./rates";

export interface PerformanceMetrics {
  periodDays: number;
  medianFirstResponseSeconds: number | null;
  pctUnderSixtySeconds: number | null;
  overnightCallCount: number;
  qualifiedRatePct: number | null;
  totalCalls: number;
}

export interface EconomicsMetrics {
  avgCostPerCallInr: number | null;
  totalSpendThisMonthInr: number;
  consultationsBookedThisMonth: number;
  estimatedPipelineInr: number;
  roiMultiple: number | null;
  rates: Awaited<ReturnType<typeof getRates>>;
}

export async function getPerformanceMetrics(periodDays = 30): Promise<PerformanceMetrics> {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const [row] = await sql`
    select
      count(*)::int as total_calls,
      percentile_cont(0.5) within group (
        order by extract(epoch from (first_response_at - call_started_at))
      ) filter (where first_response_at is not null) as median_first_response_seconds,
      avg(
        case when extract(epoch from (first_response_at - call_started_at)) < 60 then 1.0 else 0.0 end
      ) filter (where first_response_at is not null) as pct_under_60,
      count(*) filter (
        where extract(hour from call_started_at at time zone 'Asia/Kolkata') >= 19
           or extract(hour from call_started_at at time zone 'Asia/Kolkata') < 10
      )::int as overnight_calls,
      avg(
        case when status in ('qualified', 'booked') then 1.0 else 0.0 end
      ) as qualified_rate
    from calls
    where call_started_at >= ${since.toISOString()}
  ` as unknown as Array<{
    total_calls: number;
    median_first_response_seconds: number | null;
    pct_under_60: number | null;
    overnight_calls: number;
    qualified_rate: number | null;
  }>;

  return {
    periodDays,
    totalCalls: row?.total_calls ?? 0,
    medianFirstResponseSeconds: row?.median_first_response_seconds ?? null,
    pctUnderSixtySeconds: row?.pct_under_60 !== null && row?.pct_under_60 !== undefined ? row.pct_under_60 * 100 : null,
    overnightCallCount: row?.overnight_calls ?? 0,
    qualifiedRatePct: row?.qualified_rate !== null && row?.qualified_rate !== undefined ? row.qualified_rate * 100 : null,
  };
}

export async function getEconomicsMetrics(): Promise<EconomicsMetrics> {
  const rates = await getRates();

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const rows = (await sql`
    select
      vaani_duration_seconds,
      gemini_tokens_used,
      status,
      booked_slot_start
    from calls
    where call_started_at >= ${monthStart.toISOString()}
  `) as unknown as Array<{
    vaani_duration_seconds: number;
    gemini_tokens_used: number;
    status: string;
    booked_slot_start: string | null;
  }>;

  let totalSpend = 0;
  let bookedCount = 0;
  for (const row of rows) {
    totalSpend += computeCallCostInr(
      { vaaniDurationSeconds: Number(row.vaani_duration_seconds), geminiTokensUsed: Number(row.gemini_tokens_used) },
      rates
    );
    if (row.status === "booked" || row.booked_slot_start) bookedCount += 1;
  }

  const avgCostPerCall = rows.length > 0 ? totalSpend / rows.length : null;
  const estimatedPipeline = bookedCount * rates.averageProjectValueInr;
  const roiMultiple = totalSpend > 0 ? Math.round((estimatedPipeline / totalSpend) * 10) / 10 : null;

  return {
    avgCostPerCallInr: avgCostPerCall,
    totalSpendThisMonthInr: totalSpend,
    consultationsBookedThisMonth: bookedCount,
    estimatedPipelineInr: estimatedPipeline,
    roiMultiple,
    rates,
  };
}
