# CLAUDE.md — Harness Hack build brief

**Required reading before anyone writes code.** This is a 4-person, ~5-hour build from scratch. Read it once, agree on the schema (below), then go.

> **Agent note:** Next.js 16 conventions differ from older training data — see [AGENTS.md](AGENTS.md), which points at the bundled docs in `node_modules/next/dist/docs/`.

---

## What we're building

A **sponsor-powered ad production line**: topic/transcript → structured ad draft → generated images → generated video → published, instrumented for cost the whole way.

The one-sentence pitch: *"A small model writes the ad, gets cheaper and better on our own traffic, and the whole production line — drafting, rendering, publishing — runs through one governed, observable pipeline."*

**The narrative discipline:** the *sponsors are the production line*; the video/images are what rolls off it. Image/video gen is our visual sell but earns **zero sponsor points** — so the pipeline around it (Pioneer drafts, TrueFoundry routes, ClickHouse costs, OpenUI shows, Composio ships) must always read as load-bearing. If a judge sees a cool video tool that calls one sponsor as a checkbox, we lost.

---

## Hard constraints

- **~5 hours. Solo bottlenecks kill teams.** Spread the spine (see roles).
- **From scratch.** This is NOT the JanusLabs app. We are rebuilding ONE vertical slice.
- **DELETE by default.** No auth, no DB of record, no Stripe, no rate-limiting, no admin, no `proxy.ts` guards. Hardcode the user. Every time you reach for business scaffolding, ask: *will a judge see this in the 2-minute demo?* If no, don't build it.
- **The render wrappers are the ONE exception** — we lift `lib/render/` wholesale (see below). That's our core feature, not scaffolding.

---

## Tech stack

| Layer | Choice | Notes |
| --- | --- | --- |
| App | Next.js 16, single page + 2–3 API routes | Stripped to studs. No auth, no DB of record. |
| UI | React 19 / Tailwind v4 / TS | Home turf. |
| Render wrappers | **Lifted from JanusLabs `lib/render/`** | Replicate (image) + Fal (video), queue, status polling, Blob mirror. **Reuse, do not rebuild.** |
| Draft glue | AI SDK (structured output) | Routing goes through the gateway, not direct providers. |

**Cut from the render layer (do NOT port these):** chained-extension for >15s clips (single ≤15s clip only — the ffmpeg-concat path is a time sink), MAX-tier resolution gating, refund/error-category ledger. One resolution, one short clip, fire-and-poll.

---

## Sponsor stack — where the points are

| Sponsor | Role in OUR build | Priority |
| --- | --- | --- |
| **Pioneer** | The drafting model. transcript/topic → structured shots + image/video prompts. Tuned, cheaper drop-in vs. base model. | **Spine** |
| **TrueFoundry** | Gateway in front of every model call. OpenAI-compatible base-URL swap. Replaces direct provider clients; gives cost/latency observability for free. | **Spine** |
| **ClickHouse** | Logs every generation + render cost. Powers the one money chart. | **Spine** |
| **OpenUI** | Renders the draft as an interactive storyboard (stills + video slot + editable hook/CTA). The visual wow. | **High** |
| **Composio** | The publish action — Slack approval gate / social post. Loop-closer. | **Cut-first** |
| **Render** | Deploy. ~15 min, free points. | Garnish |

**How TrueFoundry and Pioneer relate (say this exactly right, judges will probe it):** they do NOT compete for the same slot. The gateway sits *in front*; Pioneer is one of the models *behind* it. TrueFoundry routes the drafting call → to our Pioneer endpoint. Pioneer's cost data hands off to ClickHouse via the gateway's telemetry.

**Irreducible core if everything burns:** TrueFoundry + Pioneer draft → live image → OpenUI storyboard → deployed on Render, with a **pre-baked video** as the closer.

---

## THE SCHEMA CONTRACT — agree on this in the first 20 minutes

This is the seam between the pipeline, the render wrappers, and the OpenUI surface. Lock it before anyone goes deep so everyone can build against a mock and integrate late. **It lives in code at `lib/schema.ts` (zod + inferred types) — that file is the source of truth.** Proposed shape — adjust together, then freeze:

```jsonc
{
  "title": "string",                 // ad concept name
  "hook": "string",                  // first 1–2s line
  "cta": "string",                   // closing call-to-action
  "pacing": "fast | medium | slow",
  "shots": [
    {
      "id": "shot_1",
      "order": 1,
      "duration_s": 3,               // keep total ≤15s for the single-clip cap
      "script": "string",            // on-screen / voiceover line for this shot
      "image_prompt": "string",      // → Replicate image wrapper
      "video_prompt": "string",      // → Fal video wrapper
      "on_screen_text": "string|null" // null when the text-toggle is off
    }
  ],
  "meta": {
    "model": "string",               // which model drafted this (base vs pioneer)
    "source": "topic | transcript | url"
  }
}
```

**Rules:** `image_prompt` and `video_prompt` must always be present per shot (render wrappers read them directly). Total `duration_s` across shots stays ≤15. `meta.model` is what lets ClickHouse split base-vs-Pioneer cost. Everyone mocks this object until the real generator lands.

---

## Roles (4 members)

Nobody owns two spine items alone. The schema lets you all work in parallel against a mock.

**A — Model & gateway.** TrueFoundry gateway setup (base URL + key), draft generation against the schema, Pioneer training (**kick off at minute zero, runs in background**), owns the base-vs-tuned comparison capture.

**B — Render & data.** Lift and wire `lib/render/` into the new repo, image gen (live) + video gen (async), ClickHouse logging + the cost-per-draft chart query.

**C — Frontend & demo.** OpenUI storyboard surface, cost-chart UI, Render deploy. **Owns the demo throughout, not at 4:30** — the person who built the UI knows where the bodies are buried.

**D — Integration & demo lead / safety net.** Composio end-to-end, the seams between everyone's pieces, the **pre-baked fallback video**, the 2-minute script. Writes no core feature — in a 5-hour build, being the glue and the safety net is a real job, not a spare seat.

---

## Timeline (~5h)

| Time | What |
| --- | --- |
| 0:00–0:20 | **Before app code:** A kicks off Pioneer fine-tune. B fires a *test* video render to confirm provider + clock real latency, copies `lib/render/` over. Everyone provisions: ClickHouse Cloud, Render, TrueFoundry key. **Lock the schema.** |
| 0:20–1:00 | Scaffold page + API. Gateway → base model → structured draft (with per-shot image/video prompts). |
| 1:00–2:00 | Image gen end-to-end: draft → prompts → provider → displayed. Mostly config (reusing wrappers). |
| 2:00–2:45 | Video: async render from one shot, poll, display. **Pre-bake a fallback clip now.** |
| 2:45–3:30 | OpenUI storyboard: cards w/ stills, hook/CTA fields, video slot. |
| 3:30–4:00 | ClickHouse logging + cost chart. Swap in Pioneer if trained; capture base-vs-Pioneer. |
| 4:00–4:30 | Deploy on Render. Pre-seed the chart. Pre-bake the hero video. |
| 4:30–5:00 | Rehearse choreography. Buffer — something will break. |

---

## Cut order under pressure

Drop in this order, no debate:
1. **Composio publish** (first to go)
2. **Pioneer live-loop** → keep the cold-start "cheaper tuned model vs. base" story instead
3. **Live video** → fall back to pre-baked clip
4. **Live ClickHouse chart** → pre-seed it so it looks alive

**Never cut:** image gen, OpenUI surface, the deploy. If OpenUI Lang fights you for >45 min, bail to plain React cards — don't let it sink the build.

---

## Landmines / don't-do-this

- **Don't rebuild rendering.** The queue/polling/Blob-mirror is the most dangerous code to rewrite under a clock. Lift it.
- **Never render video live on stage.** Image = live (returns in seconds). Video = async/pre-baked (minutes, fails often). Kick the hero render off at the *start* of the demo, reveal at the climax, keep a pre-rendered clip in your back pocket.
- **Don't re-add JanusLabs scaffolding from muscle memory.** Auth, real DB, Stripe — none of it earns points.
- **Don't claim TrueFoundry depth we don't use.** We use the LLM-gateway core (routing + cost). We are NOT using MCP Gateway / Agent Gateway. Don't overclaim.
- **Don't let the render chase pull Pioneer + the cost chart out of the demo.** Those are two of our sponsor judges. Video is the wow; the sponsor pipeline is the point.
- **Push to the shared deploy early and often.** "Works on my machine" is worthless when judges hit a URL.

---

## Demo choreography (the 2-minute close)

1. Enter a topic → Pioneer drafts a structured ad (show the storyboard populating via OpenUI).
2. Images generate live into the shot cards.
3. *"And here's the cost"* → ClickHouse chart, base-model vs. Pioneer-tuned, cheaper per draft.
4. Reveal the finished video (kicked off at the start, now ready).
5. Agent ships it through Composio → Slack approval gate.

One flow. Four sponsor judges seeing their product as load-bearing. One story.

---

## Setup / env

```bash
# .env.local — keep it lean, no business scaffolding
TRUEFOUNDRY_GATEWAY_URL=    # OpenAI-compatible base URL
TRUEFOUNDRY_API_KEY=
BASE_MODEL=                 # base model id behind the gateway (cost comparison)
PIONEER_MODEL=              # model id registered behind the gateway
CLICKHOUSE_URL=
CLICKHOUSE_PASSWORD=
REPLICATE_API_TOKEN=        # image
FAL_KEY=                    # video
COMPOSIO_API_KEY=           # publish action (cut-first)
BLOB_READ_WRITE_TOKEN=      # mirror rendered artifacts (provider URLs are ephemeral)
```

Provider URLs expire — mirror every render to Blob, same as JanusLabs did. That carry-over IS worth keeping.
