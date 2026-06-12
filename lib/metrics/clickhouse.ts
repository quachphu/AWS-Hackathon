import { createClient } from "@clickhouse/client";

/**
 * B's lane — ClickHouse telemetry. Every generation (draft / image / video / publish)
 * logs one row; the money chart reads from it. DDL + chart query: lib/metrics/schema.sql.
 *
 * Mock-first: without CLICKHOUSE_* env this logs to console. It NEVER throws —
 * telemetry must never take down the demo path.
 */

export type GenEvent = {
  phase: "draft" | "image" | "video" | "publish";
  model?: string; // base vs pioneer id — the chart splits cost on this
  provider?: string; // truefoundry | replicate | fal | composio
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
