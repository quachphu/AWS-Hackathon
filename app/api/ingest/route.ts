import { NextResponse } from "next/server";
import { ingestTikTok, isTikTokUrl } from "@/lib/ingest/tiktok";
import { logEvent } from "@/lib/metrics/clickhouse";

/**
 * TikTok URL → transcript, so a draft can be built FROM a real video.
 *
 *   POST /api/ingest  { url }  → { transcript, method, caption? }
 *
 * Two-step flow for the frontend:
 *   1. POST /api/ingest { url }                                   → { transcript }
 *   2. POST /api/draft  { source: "transcript", content: transcript }
 *
 * Apify subtitles → LLM fallback (TrueFoundry gateway) → mock. Never throws on a
 * missing key; logs one ClickHouse "ingest" row so the cost story covers scraping too.
 */
export const maxDuration = 300; // Apify actor cold-starts can take ~30s

export async function POST(req: Request) {
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url?.trim()) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  if (!isTikTokUrl(url)) {
    return NextResponse.json({ error: "only TikTok URLs are supported" }, { status: 400 });
  }

  const t0 = performance.now();
  try {
    const result = await ingestTikTok(url);
    await logEvent({
      phase: "ingest",
      provider: result.provider,
      latency_ms: Math.round(performance.now() - t0),
      ok: true,
    });
    return NextResponse.json({
      transcript: result.transcript,
      method: result.method,
      caption: result.caption,
    });
  } catch (err) {
    await logEvent({
      phase: "ingest",
      latency_ms: Math.round(performance.now() - t0),
      ok: false,
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ingest failed" },
      { status: 500 }
    );
  }
}
