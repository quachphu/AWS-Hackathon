// scripts/seed-chart.mjs — pre-seed the cost chart so it looks alive for the demo
// (cut order #4 in CLAUDE.md). Run against the DEPLOY's ClickHouse, not just local:
//
//   node --env-file=.env.local scripts/seed-chart.mjs
//
// Idempotent: clears prior seed rows (draft_id LIKE 'seed-%') before inserting, so
// re-running never double-counts. Real draft rows (non-'seed-' ids) are untouched.
// Model labels mirror what A's draft route logs, so seeded + real rows merge cleanly.

import { createClient } from "@clickhouse/client";

const client = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER ?? "default",
  password: process.env.CLICKHOUSE_PASSWORD,
});

const BASE = process.env.BASE_MODEL || "openai/chat-latest";
const PIONEER = process.env.PIONEER_MODEL || "pioneer/ad-drafter-v1";
const N = 8; // drafts per model

// Deterministic rows — no randomness, so the chart is identical every reseed.
// Pioneer is the cheaper, faster tuned model: that's the whole story the chart sells.
const rows = [];
for (let i = 1; i <= N; i++) {
  rows.push({
    phase: "draft", model: BASE, provider: "truefoundry",
    draft_id: `seed-base-${i}`, shot_id: "",
    latency_ms: 2000 + (i % 4) * 90, cost_usd: 0.0040 + (i % 3) * 0.0004, ok: 1,
  });
  rows.push({
    phase: "draft", model: PIONEER, provider: "truefoundry",
    draft_id: `seed-pioneer-${i}`, shot_id: "",
    latency_ms: 1300 + (i % 4) * 50, cost_usd: 0.0010 + (i % 3) * 0.0001, ok: 1,
  });
}

try {
  // Clear prior seeds first, synchronously (mutations_sync=2 waits for completion)
  // so the fresh insert that follows is never swept up by the delete.
  await client.command({
    query: "ALTER TABLE generations DELETE WHERE draft_id LIKE 'seed-%'",
    clickhouse_settings: { mutations_sync: "2" },
  });
  await client.insert({ table: "generations", values: rows, format: "JSONEachRow" });

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
  console.log(`Seeded ${rows.length} draft rows (${N} per model).`);
  console.table(await rs.json());
} catch (e) {
  console.error("Seed failed:", e.message || e);
  process.exitCode = 1;
} finally {
  await client.close();
}
