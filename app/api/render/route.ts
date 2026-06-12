import { NextResponse } from "next/server";
import { mockVideoUrl } from "@/lib/mock";
import { logEvent } from "@/lib/metrics/clickhouse";

/**
 * MOCK render endpoint — B swaps the internals for the lifted VisualLabs wrappers
 * (lib/render/). The contract below is what C builds against. Keep the contract,
 * swap the internals.
 *
 *   POST { kind: "image", shotId, prompt }  → { url }           (fast — run live on stage)
 *   POST { kind: "video", shotId, prompt }  → { jobId }         (async — fire…)
 *   GET  ?jobId=...                         → { status: "pending" | "done" | "failed", url? }   (…and poll)
 */

const videoJobs = new Map<string, number>(); // jobId → started-at (mock only)
const MOCK_VIDEO_MS = 8000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  const { kind, shotId, prompt } = await req.json().catch(() => ({}));
  if (!kind || !shotId || !prompt) {
    return NextResponse.json({ error: "kind, shotId, prompt are required" }, { status: 400 });
  }

  if (kind === "image") {
    await sleep(1200); // pretend latency so the UI's loading states stay honest
    const url = `https://picsum.photos/seed/${encodeURIComponent(shotId)}-${prompt.length}/768/432`;
    await logEvent({
      phase: "image",
      provider: "mock-replicate",
      shot_id: shotId,
      latency_ms: 1200,
      cost_usd: 0.003,
      ok: true,
    });
    return NextResponse.json({ url });
  }

  if (kind === "video") {
    const jobId = `mockjob_${shotId}_${Date.now()}`;
    videoJobs.set(jobId, Date.now());
    await logEvent({ phase: "video", provider: "mock-fal", shot_id: shotId, cost_usd: 0.15, ok: true });
    return NextResponse.json({ jobId });
  }

  return NextResponse.json({ error: `unknown kind: ${kind}` }, { status: 400 });
}

export async function GET(req: Request) {
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }
  const started = videoJobs.get(jobId);
  if (!started) {
    return NextResponse.json({ status: "failed", error: "unknown job" }, { status: 404 });
  }
  if (Date.now() - started < MOCK_VIDEO_MS) {
    return NextResponse.json({ status: "pending" });
  }
  return NextResponse.json({ status: "done", url: mockVideoUrl });
}
