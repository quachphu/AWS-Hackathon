/**
 * D's lane — Composio publish action (Slack approval gate / social post).
 *
 * FIRST TO CUT under pressure (CLAUDE.md cut order). Nothing imports this except
 * the publish step, so cutting it never breaks the pipeline.
 *
 * Setup: `npm i @composio/core` (verify current SDK name against Composio docs),
 * key goes in COMPOSIO_API_KEY.
 */

export type PublishInput = {
  title: string;
  hook: string;
  cta: string;
  videoUrl: string | null;
};

export async function publishAd(input: PublishInput): Promise<{ ok: boolean; detail: string }> {
  if (!process.env.COMPOSIO_API_KEY) {
    console.warn("[composio] COMPOSIO_API_KEY missing — mock publish");
    return { ok: true, detail: `mock-published "${input.title}" (no COMPOSIO_API_KEY)` };
  }

  // TODO(D): send to the Slack approval channel via Composio, return the message link.
  throw new Error("publishAd not implemented yet — D's lane");
}
