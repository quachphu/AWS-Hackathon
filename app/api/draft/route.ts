import { NextResponse } from "next/server";
import { generateDraft, type DraftInput } from "@/lib/draft/generator";
import { logEvent } from "@/lib/metrics/clickhouse";

/**
 * A's lane.
 *
 * POST /api/draft  { source?: "topic" | "transcript" | "url", content: string, model?: string }
 * → Draft (lib/schema.ts)
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<DraftInput>;
  const source = body.source ?? "topic";
  const content = body.content?.trim();
  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const t0 = performance.now();
  try {
    const draft = await generateDraft({ source, content, model: body.model });
    await logEvent({
      phase: "draft",
      model: draft.meta.model,
      provider: "truefoundry",
      draft_id: draft.title, // good enough for the chart's countDistinct
      latency_ms: Math.round(performance.now() - t0),
      ok: true,
    });
    return NextResponse.json(draft);
  } catch (err) {
    console.error("[api/draft]", err);
    await logEvent({
      phase: "draft",
      model: body.model ?? "",
      provider: "truefoundry",
      latency_ms: Math.round(performance.now() - t0),
      ok: false,
    });
    return NextResponse.json({ error: "draft generation failed" }, { status: 500 });
  }
}
