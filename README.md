# VisualLabs - Sponsor-Powered AI Ad Production Line

## Demo walkthrough

![VisualLabs full walkthrough](docs/assets/visual-labs-full-flow.gif)

Flow: home page -> Studio / Remix -> prompt refinement -> image render -> dry-run publish -> live analytics -> ClickHouse/Fastino training export.

Generated with [HomenShum/feature-walkthrough-gif](https://github.com/HomenShum/feature-walkthrough-gif).

## Devpost walkthrough

**VisualLabs** is a sponsor-powered AI ad production line. It turns a topic, transcript, or social video idea into a complete short-form ad workflow: structured ad draft, improved image prompts, live image rendering, async video rendering, analytics, cost tracking, Composio publishing handoff, and a ClickHouse-to-Fastino/Pioneer training export loop.

**Try it out:** [aws-hackathon-ulrh.onrender.com](https://aws-hackathon-ulrh.onrender.com/)

Core idea:

> Creators should not have to jump between trend research, prompting, image generation, video rendering, analytics, and publishing tools. VisualLabs turns that whole workflow into one observable production line.

Instead of building just another image/video generator, we focused on the production harness around creative generation: the model drafts the ad, the UI turns it into an editable remix workspace, renders flow through governed infrastructure, costs are logged, analytics come back into chat, and high-quality prompts can be exported for a future small prompt model.

### Inspiration

Making a video ad still means juggling disconnected tools and never knowing what it actually cost until the invoice lands. A creator or marketer may use one tool for trends, another for prompts, another for images, another for video, another for analytics, and another for publishing. That means the feedback loop is slow, expensive, and hard to measure.

### What it does

VisualLabs starts with a creator prompt, imported Instagram Reels link, or transcript-style idea. The system then helps produce a short-form ad concept with a hook, CTA, pacing, and visual direction. From there, the creator can:

1. **Chat with the remix agent** - the right-side remix chat behaves like a creative director. It improves prompts, preserves character consistency, rewrites hooks, and decides the next production action.
2. **Inspect OpenUI artifacts** - generated prompts, analytics, and training-loop updates appear as compact chat artifacts that can expand into a review panel.
3. **Generate live stills** - the image button calls the render API from the current prompt and swaps the result into the image stage.
4. **Queue video rendering** - video is designed as an async submit-and-poll job so the demo does not block on long provider latency.
5. **Track costs and model comparisons** - generation events are logged so the product can compare base model vs. Pioneer/tuned-model economics.
6. **Publish through an action layer** - Composio is the social publish connector; the demo also supports a dry-run path so judges can see the workflow without firing a real post.
7. **Pull analytics back into chat** - Composio Instagram analytics can be summarized by the OpenAI agent and rendered through OpenUI.
8. **Export training data** - successful prompt/image pairs and chat history become JSONL records for the mocked Fastino/Pioneer small prompt-model pipeline.

### Why we built it

Short-form creative teams have the same repeated pain:

- Trend discovery happens in one place.
- Prompting happens somewhere else.
- Image generation and video rendering are slow and fragile.
- Analytics are disconnected from generation.
- Publishing is another manual step.
- No one can explain the cost per draft or whether a smaller specialized model could do the same work.

VisualLabs compresses that into one workflow:

```txt
Senso/context signal
  -> TrueFoundry gateway
  -> Fastino/Pioneer drafting model
  -> OpenUI remix workspace and artifacts
  -> image + video render pipeline
  -> ClickHouse cost and event warehouse
  -> Composio analytics/publishing handoff
  -> Render deployment
```

The goal was not only to create a good-looking demo, but to show a production-shaped AI system where every sponsor tool has a real role in the workflow.

### Sponsor stack

**Senso AI - context and trend intelligence**
Senso represents the front of the workflow: the place where source context, customer signal, and trend understanding can enter the system. In the demo story, it helps identify what should be remixed or produced.

**TrueFoundry - AI gateway and model routing**
TrueFoundry sits in front of model calls as the governed gateway layer. Pioneer is one of the models behind that gateway, so the gateway and the model complement each other instead of competing for the same role.

**Fastino / Pioneer - specialized drafting model**
Pioneer is the drafting-model path. It turns a topic or transcript into schema-valid ad structure: title, hook, CTA, pacing, shots, image prompts, video prompts, and metadata.

**OpenUI - default UI, artifacts, analytics, and generated UI**
OpenUI is load-bearing in the frontend. It renders prompt artifacts, Instagram analytics artifacts, training-pipeline artifacts, and production-console panels from repo-owned OpenUI Lang programs and component libraries.

**ClickHouse - cost and event warehouse**
ClickHouse receives generation, chat-history, render, export, and training-loop events. When ClickHouse is not configured, the app degrades to local/mock logging so the demo remains reliable.

**Composio - publish and analytics action layer**
Composio closes the loop with Instagram publish and analytics tools. Real social actions require explicit user intent; the demo path can dry-run publish so it stays safe on stage.

**Render - deployment**
Render hosts the live app and gives judges a public URL instead of a localhost-only walkthrough.

### How we built it

We built the app as a Next.js 16 vertical slice with API routes for the important production steps. The build intentionally avoids product auth, a transactional app database, billing, and admin screens because those do not help the three-minute hackathon demo.

The core surfaces are:

- `components/landing/HackathonLandingPage.tsx` - product landing page and sponsor/judging story.
- `components/openui/VisualRemixStudio.tsx` - creator-facing remix workspace, import, library, analytics, chat, render, publish, and export flow.
- `components/openui/OpenUIAgentFullscreen.tsx` - `/agent`, kept as the OpenUI streaming and agent-response test surface.
- `components/openui/visual-openui-library.tsx` - OpenUI artifacts for remix prompts, Instagram analytics, and the ClickHouse/Fastino training loop.
- `app/api/draft`, `app/api/render`, `app/api/publish`, `app/api/agent/*`, and `app/api/analytics/*` - API routes for drafting, rendering, publishing, analytics, and training export.

Core technical flow:

```txt
User enters a topic or imported source link
  -> /api/ingest or /api/draft
  -> TrueFoundry gateway / OpenAI-compatible model path
  -> base model or Fastino/Pioneer model
  -> schema-valid draft or refined render prompt
  -> OpenUI remix workspace renders the result
  -> /api/render kind="image"
  -> Replicate Seedream or mock image path
  -> /api/render kind="video"
  -> Fal async job or mock video path
  -> /api/publish
  -> Composio publish or dry-run fallback
  -> /api/analytics/history + /api/analytics/export
  -> ClickHouse events and Fastino/Pioneer JSONL records
```

The repo is intentionally mock-first. The app can run with zero keys and progressively light up real services lane by lane. `/api/draft` serves a mock draft, `/api/render` serves placeholder stills and a stand-in clip, `/api/publish` can dry-run, and telemetry degrades safely when ClickHouse is not configured.

### Challenges we ran into

**Keeping scope under control**
We cut auth, a transactional database, Stripe, admin pages, long video chaining, production rate limiting, and full social account management. The point of the demo is the production pipeline, not business scaffolding.

**Making every sponsor tool feel load-bearing**
It is easy to build a media generation demo and mention sponsor tools as checkboxes. We wanted the opposite: every sponsor appears as a necessary step in the production line.

**Keeping the demo reliable**
Image generation can be a live stage moment. Video generation can take too long or fail, so the route supports async polling and a mock fallback clip.

**Building mock-first**
The team worked against frozen contracts and mock outputs so frontend, rendering, model, metrics, and publishing could move in parallel.

### Accomplishments that we're proud of

We are proud that this is not just a static mock. Even with zero keys, the app still runs end-to-end with deterministic fallbacks. With keys configured, the same contracts light up real model calls, image rendering, video jobs, telemetry, analytics, and publish handoff.

We are also proud of the OpenUI integration. OpenUI is used for chat artifacts, analytics artifacts, generated panels, and the agent testing surface, not just a decorative widget.

Finally, the cost and training-loop instrumentation is part of the product. ClickHouse events and exported JSONL records answer the real buyer question: can a cheaper specialized model produce useful creative output with lower cost or better latency?

### What we learned

A good AI product demo needs two stories at once:

1. **The user story** - the creator gets a remix studio that feels familiar and productive.
2. **The system story** - judges see a governed pipeline where models, renderers, analytics, and actions are coordinated.

We also learned that async video needs choreography. Image generation can be the live moment; video should be queued early and revealed later.

### What's next for VisualLabs

- Connect real Senso AI context inputs for trend/source selection.
- Add TikTok analytics ingestion into ClickHouse.
- Expand OpenUI artifacts into storyboard, analytics, and judge-readiness artifacts.
- Add a real approval gate before Composio publish.
- Promote the Fastino/Pioneer tuned model after evals show lower cost or better latency.
- Store successful generations as training/eval examples for continuous model improvement.

### Built with

- Senso AI - context and signal layer
- TrueFoundry - AI gateway and model routing
- Fastino / Pioneer - specialized drafting model
- OpenUI - remix UI, artifacts, analytics, and generated panels
- ClickHouse - generation/event/cost telemetry
- Composio - Instagram analytics and social publishing action layer
- Render - deployment
- Next.js 16
- React 19
- Tailwind v4
- OpenAI Agents SDK
- Replicate
- Fal
- Cloudinary

### Three-minute demo script

1. Open VisualLabs and show the landing page product vision.
2. Enter the Studio / Remix workspace.
3. Import or paste a short-form video/source idea.
4. Ask the remix agent to improve the prompt.
5. Open or point to the OpenUI prompt artifact.
6. Generate a still image live.
7. Start or reveal the async video render path.
8. Pull Instagram analytics through Composio and render the OpenUI analytics artifact.
9. Prepare a dry-run publish through Composio.
10. Show the ClickHouse/Fastino training export behavior and close on the sponsor pipeline: Senso -> TrueFoundry -> Fastino/Pioneer -> OpenUI -> ClickHouse -> Composio -> Render.

Submitted to [Harness Engineering Hack](https://harness-hack.devpost.com/).

Sponsor-powered ad production line: **topic/transcript → structured draft (Pioneer via TrueFoundry) → images (Replicate) → video (Fal) → published (Composio)** — instrumented for cost in **ClickHouse** the whole way.

**Required reading:** [CLAUDE.md](CLAUDE.md) (what we're building, cut order, demo choreography) · [CONTRIBUTION.md](CONTRIBUTION.md) (lanes, git flow, mock-first discipline).

## Quickstart

```bash
cp .env.example .env.local   # fill what your lane owns
npm install
npm run dev                  # http://localhost:3000
```

**The app runs with ZERO keys.** `/api/draft` serves the mock draft, `/api/render` serves placeholder stills and a stand-in clip, metrics log to console. Fill keys lane by lane and the real thing replaces the mock behind the same contract — the UI never changes.

`npm run build` must pass before you merge. `main` always builds.

## Lanes (see CONTRIBUTION.md for the full map)

| Owner | Branch | Lane |
| --- | --- | --- |
| **A — model & gateway** | `a-draft-gen` | `lib/gateway/`, `lib/draft/`, `app/api/draft/`, `lib/schema.ts` (**frozen at minute 20**) |
| **B — render & data** | `b-image-render` | `lib/render/` (lift from VisualLabs), `lib/metrics/`, `app/api/render/` |
| **C — frontend & demo** | `c-storyboard` | `app/page.tsx`, `components/`, deploy (`render.yaml`) |
| **D — integration & demo lead** | `d-composio` | `lib/composio/`, glue, fallback assets, demo script |

## The seam

- [`lib/schema.ts`](lib/schema.ts) — the frozen draft contract (zod + types). Everything imports this.
- [`lib/mock.ts`](lib/mock.ts) — the draft object everyone builds against until real upstreams land. Blocked on someone? You skipped the mock.
- API contracts are documented in [`app/api/draft/route.ts`](app/api/draft/route.ts) and [`app/api/render/route.ts`](app/api/render/route.ts) — keep the contracts, swap the internals.

## Deploy

Render blueprint in [`render.yaml`](render.yaml). C deploys **in the first hour**, empty shell or not, and every meaningful merge goes to the shared deploy. Judges hit a URL, not localhost.
