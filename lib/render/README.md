# lib/render — B's lane

Lift VisualLabs `lib/render/` here **wholesale**. Reuse, do not rebuild — the
queue / status-polling / Blob-mirror is the most dangerous code to rewrite under a clock.

What lands here:

- **Replicate wrapper (image)** — returns in seconds → safe to run live on stage
- **Fal wrapper (video)** — async: fire job, poll status. NEVER awaited inline on stage
- **Blob mirror** — provider URLs expire; mirror EVERY artifact to Vercel Blob

**Cut from the port (per CLAUDE.md), do not bring these over:**

- chained-extension for >15s clips (single ≤15s clip only)
- MAX-tier resolution gating (one resolution)
- refund / error-category ledger

Wire it behind `app/api/render/route.ts` — the mock in there documents the
request/response contract C is already building against. **Keep the contract,
swap the internals.** Log every render through `lib/metrics/clickhouse.ts`.

Deps already installed: `replicate`, `@fal-ai/client`, `@vercel/blob`.
