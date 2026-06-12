-- B's lane — run once against ClickHouse Cloud (default database is fine).

CREATE TABLE IF NOT EXISTS generations (
  ts          DateTime DEFAULT now(),
  phase       LowCardinality(String),  -- draft | image | video | publish
  model       LowCardinality(String),  -- base vs pioneer id — the chart splits on this
  provider    LowCardinality(String),  -- truefoundry | replicate | fal | composio
  draft_id    String,
  shot_id     String,
  latency_ms  UInt32,
  cost_usd    Float64,
  ok          UInt8
)
ENGINE = MergeTree
ORDER BY ts;

-- THE money chart: cost per draft, base model vs Pioneer.
SELECT
  model,
  countDistinct(draft_id)          AS drafts,
  round(sum(cost_usd), 4)          AS total_cost_usd,
  round(sum(cost_usd) / drafts, 4) AS cost_per_draft_usd,
  round(avg(latency_ms))           AS avg_latency_ms
FROM generations
WHERE phase = 'draft' AND ok = 1
GROUP BY model
ORDER BY cost_per_draft_usd ASC;

-- Pre-seed (cut order #4): rows so the chart looks alive before real traffic. Run ON THE DEPLOY's
-- ClickHouse instance, not a local one. Tweak model ids to whatever is actually registered.
-- INSERT INTO generations (phase, model, provider, draft_id, latency_ms, cost_usd, ok) VALUES
--   ('draft', 'openai-main/gpt-4o-mini', 'truefoundry', 'seed-1', 2100, 0.0042, 1),
--   ('draft', 'pioneer/ad-drafter-v1',   'truefoundry', 'seed-2', 1400, 0.0011, 1);
