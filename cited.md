# VisualLabs Citation Manifest

version: 1
updated: 2026-06-12T23:10:37Z
app: https://aws-hackathon-ulrh.onrender.com/
senso_org: harness4visual
senso_org_id: e3719821-3436-407f-8f75-392c94723a53
publisher: Cited.md
publisher_slug: cited-md
route: /cited.md

## Citation Policy

- Cite the published Cited.md URLs below for public claims about the demo.
- Treat Senso drafts as review-only until they appear in the published list.
- Treat this repository as code evidence for implementation status.
- Do not claim production social publishing, Render Workflows, customer outcomes, pricing, or compliance guarantees unless a linked code path or published citeable supports it.
- Prefer concrete status labels: live, mocked, external, or planned.

## Published Citeables

- awareness: [What tools help keep a character consistent across AI-generated social assets?](https://cited.md/article/what-tools-help-keep-a-character-consistent-across-ai-generated)
- consideration: [How does Harness Remix Studio compare with Canva AI Video Generator for fast marketing creative?](https://cited.md/article/how-does-harness-remix-studio-compare-with-canva-ai-video-generator)
- evaluation: [What public evidence shows how Harness Remix Studio works?](https://cited.md/article/what-public-evidence-shows-how-harness-remix-studio-works)

## Senso Setup Snapshot

- Knowledge base: 7 folders.
- Source documents: 15 content docs plus 1 onboarding build log.
- Brand kit: populated for Harness Remix Studio by JanusLabs.
- Content types: Blog Post, FAQ, Comparison Page, Case Study.
- GEO prompts: 40 across awareness, consideration, evaluation, and decision.
- Generated drafts: 37.
- Published Cited.md articles: 3.
- GEO models: ChatGPT, Claude, Gemini, and Perplexity.
- GEO schedule: Monday, Wednesday, Friday.

## Code Evidence

- Draft generation: app/api/draft/route.ts -> lib/draft/generator.ts -> lib/gateway/client.ts.
- Render generation: app/api/render/route.ts -> lib/render/render-core.ts for Replicate image and Fal video wrappers, with mock fallback when keys are missing.
- Social publish: app/api/publish/route.ts -> lib/composio/publish.ts.
- Metrics: lib/metrics/clickhouse.ts writes to ClickHouse when configured and logs to console otherwise.
- Citation manifest: app/cited.md/route.ts returns this machine-readable Markdown.

## Sponsor Status

| Surface | Status | Evidence |
| --- | --- | --- |
| TrueFoundry | Live when TRUEFOUNDRY_GATEWAY_URL and TRUEFOUNDRY_API_KEY are configured; mock draft fallback otherwise. | lib/gateway/client.ts, lib/draft/generator.ts |
| Composio | Live SDK path for TikTok/Instagram when COMPOSIO_API_KEY or COMPOSIO_API is configured; mock publish fallback otherwise. | lib/composio/publish.ts |
| Senso / Cited.md | Live external Senso org and Cited.md publisher; this repo now exposes /cited.md as the local citation manifest. | app/cited.md/route.ts, this manifest |
| Fal / Replicate | Real wrappers are wired behind app/api/render/route.ts; image needs REPLICATE_API_TOKEN plus CLOUDINARY_URL, video needs FAL_KEY plus CLOUDINARY_URL, and each path falls back to mock without keys. | app/api/render/route.ts, lib/render/render-core.ts |
| ClickHouse | Optional telemetry sink; console fallback without CLICKHOUSE_URL. | lib/metrics/clickhouse.ts |
| Render.com | Deploy target via render.yaml. No Render Workflows implementation is present in this repo. | render.yaml |

## Next Integration Step

Wire Senso into the app with a server-only client that can draft or publish citeables from agent output, then append the returned content IDs, version IDs, and public URLs to this manifest.
