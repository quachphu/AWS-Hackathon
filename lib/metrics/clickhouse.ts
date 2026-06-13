import { createClient } from "@clickhouse/client";

/**
 * B's lane — ClickHouse telemetry. Every generation (draft / image / video / publish)
 * logs one row; the money chart reads from it. DDL + chart query: lib/metrics/schema.sql.
 *
 * Mock-first: without CLICKHOUSE_* env this logs to console. It NEVER throws —
 * telemetry must never take down the demo path.
 */

export type GenEvent = {
  phase: "draft" | "image" | "video" | "publish" | "ingest";
  model?: string; // base vs pioneer id — the chart splits cost on this
  provider?: string; // truefoundry | fal | composio
  draft_id?: string;
  shot_id?: string;
  latency_ms?: number;
  cost_usd?: number;
  ok?: boolean;
};

const client = process.env.CLICKHOUSE_URL
  ? createClient({
      url: process.env.CLICKHOUSE_URL,
      username: process.env.CLICKHOUSE_USER ?? "default",
      password: process.env.CLICKHOUSE_PASSWORD,
    })
  : null;

export async function logEvent(e: GenEvent): Promise<void> {
  const row = {
    phase: e.phase,
    model: e.model ?? "",
    provider: e.provider ?? "",
    draft_id: e.draft_id ?? "",
    shot_id: e.shot_id ?? "",
    latency_ms: e.latency_ms ?? 0,
    cost_usd: e.cost_usd ?? 0,
    ok: e.ok === false ? 0 : 1,
  };

  if (!client) {
    console.log("[metrics:console]", JSON.stringify(row));
    return;
  }

  try {
    await client.insert({ table: "generations", values: [row], format: "JSONEachRow" });
  } catch (err) {
    console.error("[metrics] insert failed (non-fatal)", err);
  }
}

/**
 * THE money chart — cost per draft, base model vs Pioneer (lib/metrics/schema.sql).
 * Read by /api/metrics for C's cost chart. Without CLICKHOUSE_* it returns a small
 * mock so the UI still has two bars to draw with zero keys; never throws.
 */
export type CostRow = {
  model: string;
  drafts: number;
  total_cost_usd: number;
  cost_per_draft_usd: number;
  avg_latency_ms: number;
};

const MOCK_CHART: CostRow[] = [
  { model: "pioneer/ad-drafter-v1", drafts: 8, total_cost_usd: 0.0096, cost_per_draft_usd: 0.0012, avg_latency_ms: 1380 },
  { model: "openai/chat-latest", drafts: 8, total_cost_usd: 0.0344, cost_per_draft_usd: 0.0043, avg_latency_ms: 2180 },
];

export async function getCostChart(): Promise<CostRow[]> {
  if (!client) return MOCK_CHART;
  try {
    const rs = await client.query({
      query: `
        SELECT model,
               countDistinct(draft_id)          AS drafts,
               round(sum(cost_usd), 4)          AS total_cost_usd,
               round(sum(cost_usd) / drafts, 4) AS cost_per_draft_usd,
               round(avg(latency_ms))           AS avg_latency_ms
        FROM generations
        WHERE phase = 'draft' AND ok = 1
        GROUP BY model
        ORDER BY cost_per_draft_usd ASC`,
      format: "JSONEachRow",
    });
    // UInt64 (drafts) comes back as a string in JSONEachRow — coerce everything to numbers.
    const rows = (await rs.json()) as Record<string, unknown>[];
    return rows.map((r) => ({
      model: String(r.model),
      drafts: Number(r.drafts),
      total_cost_usd: Number(r.total_cost_usd),
      cost_per_draft_usd: Number(r.cost_per_draft_usd),
      avg_latency_ms: Number(r.avg_latency_ms),
    }));
  } catch (err) {
    console.error("[metrics] chart query failed (non-fatal)", err);
    return [];
  }
}
