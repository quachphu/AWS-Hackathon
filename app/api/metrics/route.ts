import { NextResponse } from "next/server";
import { getCostChart } from "@/lib/metrics/clickhouse";

/**
 * B's lane — the money chart endpoint C fetches.
 *
 *   GET /api/metrics → { chart: CostRow[] }   base-vs-Pioneer cost per draft, cheapest first
 *
 * Always live (no caching) so it reflects ClickHouse as rows land. Degrades to a
 * mock chart when CLICKHOUSE_* is unset, so C's UI always has something to draw.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const chart = await getCostChart();
  return NextResponse.json({ chart });
}
