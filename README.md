# Ad Factory

## Demo walkthrough

![VisualLabs full walkthrough](docs/assets/visual-labs-full-flow.gif)

Flow: home page -> Studio / Remix -> prompt refinement -> image render -> dry-run publish -> live analytics -> ClickHouse/Fastino training export.

Generated with [HomenShum/feature-walkthrough-gif](https://github.com/HomenShum/feature-walkthrough-gif).

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
