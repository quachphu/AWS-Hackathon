# CONTRIBUTION.md — how the four of us work without stepping on each other

CLAUDE.md is **what** we're building and who owns which slice. This is **how** we collaborate in a 5-hour window without merge hell, blocked teammates, or a broken `main` at hour 4. Read it once; the rules are short on purpose.

The single guiding principle: **nobody waits on anybody.** Everything below exists to keep all four of us building in parallel against the frozen schema.

---

## File ownership map (this is what prevents merge conflicts)

Each role owns a directory. Stay in your lane; if you need something in someone else's lane, ping them or mock it.

| Owner | Directories / files | 
| --- | --- |
| **A — Model & gateway** | `lib/draft/` (generator), `lib/gateway/` (TrueFoundry client), `app/api/draft/` |
| **B — Render & data** | `lib/render/` (lifted), `lib/metrics/` (ClickHouse), `app/api/render/`, chart query |
| **C — Frontend & demo** | `app/page.tsx`, `components/`, OpenUI surface, deploy config |
| **D — Integration & demo lead** | `lib/composio/`, glue/wiring, fallback assets, demo script |

**Shared danger zones — coordinate before touching:**
- `lib/schema.ts` (the draft type everyone imports) — **A owns it, and it FREEZES after minute 20.** Changing it after that breaks three people at once. If it truly must change, announce in chat first.
- `app/page.tsx` — **C owns.** Others integrate *into* it via components, not by editing it directly.
- `.env.example` — append-only. Adding a var? Add the line, don't reorder.

---

## Git flow (trunk-based, fast merges)

We do NOT do heavyweight PR review in a 5-hour build. We do small, frequent, fast merges.

- **Branch per task**, named `role-thing`: `a-draft-gen`, `b-image-render`, `c-storyboard`, `d-composio`.
- **Commit small and often.** A commit that "wires the image call" beats a commit that "does rendering."
- **`git pull --rebase origin main` before you push.** Always. Stale branches are how you get conflicts.
- **Merge to `main` the moment a piece works** — don't sit on a branch for two hours. Small merges = small conflicts.
- **`main` must always build.** If your merge breaks the build, you fix it immediately or revert. A broken `main` blocks all four of us and the deploy.
- No force-pushing to `main`. Ever.

**If two of you conflict on a merge:** whoever's change is smaller rebases onto the other. If it's genuinely tangled, **C (demo lead for `main` health) breaks the tie** — speed wins over elegance.

---

## Mock-first discipline (the thing that actually lets us parallelize)

The schema is frozen at minute 20. From that point, **every role builds against a hardcoded mock of the draft object**, not against each other's live code.

- C builds the storyboard against a mock draft JSON — doesn't wait for A's generator.
- B wires render wrappers against mock `image_prompt`/`video_prompt` strings — doesn't wait for A either.
- A swaps the real generator in late; if the schema held, it just works.
- D wires Composio against a mock "finished ad" object.

Keep a `lib/mock.ts` exporting one valid draft object. Everyone imports it until their real upstream lands. **If you find yourself blocked waiting for someone, you skipped the mock — go make one.**

---

## Definition of done (per task)

A task is done when:
1. It works against the mock OR real data.
2. It's merged to `main` and `main` still builds.
3. It's visible on the **shared deploy** (not just localhost).

"Works on my machine" is worth zero points. Judges hit a URL.

---

## Deploy discipline

- **Deploy to Render in the first hour**, empty shell or not. A late first-deploy is the classic hackathon death.
- Push to the shared deploy **early and often** — every meaningful merge.
- **C owns deploy health.** If the deploy is red, that's a stop-everything event.
- Pre-seed ClickHouse and pre-bake the hero video **on the deploy**, not locally — the demo runs off the deployed URL.

---

## Secrets

- **Never commit `.env.local`.** It's gitignored; keep it that way.
- Share keys via one pinned chat message or a shared note — not in commits, not in screenshots.
- Each provider key is owned by whoever owns that lane (A: gateway/Pioneer; B: Replicate/Fal/ClickHouse; D: Composio). That person gets it working first, then shares.

---

## Communication cadence

Sync at the timeline waypoints from CLAUDE.md — short, standing, 60 seconds each:

- **0:20** — schema frozen? everyone has it? GO.
- **1:00** — draft coming back through the gateway? image render confirmed working?
- **2:30** — storyboard rendering? video async path proven? **fallback clip baked?**
- **3:30** — everything on the deploy? cost chart populating?
- **4:00** — feature freeze. From here it's only: fix, pre-seed, rehearse.

Between syncs: **announce blockers loudly the moment they happen.** A 5-minute "I'm stuck on X" beats 40 minutes of silent struggle. The point of D existing is to unstick people — use them.

---

## Code-style rules (anti-bikeshed)

- **No premature abstraction.** Two copies of similar code is fine for 5 hours. A clever shared helper that three people have to learn is not.
- **No new dependencies without a reason a judge would care about.** Every `npm install` is a risk.
- **No refactoring someone else's working code** to your taste. If it works and it's merged, leave it.
- **TypeScript: don't fight the types.** `any` with a `// TODO` is acceptable under the clock. Shipping beats strict.
- Match what's there. Don't reformat files you didn't write.

---

## Feature freeze at 4:00

Hard line. After 4:00, **no new features merge to `main`** — full stop. The last hour is deploy, pre-seed the chart, pre-bake the hero video, and rehearse the choreography. The most common way good hackathon projects lose is a last-minute "quick addition" that breaks the demo at 4:55.

If it's not in `main` by 4:00, it's not in the demo. Be at peace with that.
