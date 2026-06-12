import { NextResponse } from "next/server";
import { mockVideoUrl } from "@/lib/mock";
import { logEvent } from "@/lib/metrics/clickhouse";
import {
  generateImage,
  submitVideo,
  pollVideo,
  type VideoJob,
} from "@/lib/render/render-core";

/**
 * Render endpoint — real wrappers (lib/render/render-core.ts) with a mock
 * fallback so the app still runs with zero keys (CONTRIBUTION.md). The contract
 * C builds against is unchanged — only the internals are real now:
 *
 *   POST { kind: "image", shotId, prompt }  → { url }     (fast — run live on stage)
 *   POST { kind: "video", shotId, prompt }  → { jobId }   (async — fire…)
 *   GET  ?jobId=...                         → { status: "pending" | "done" | "failed", url? }   (…and poll)
 *
 * Optional body fields { draftId, model, startImageUrl, durationSeconds } are
 * accepted but not required — draftId/model flow through to ClickHouse for a
 * richer money chart; startImageUrl seeds video off a shot's generated still.
 *
 * Image needs REPLICATE_API_TOKEN + CLOUDINARY_URL; video needs FAL_KEY +
 * CLOUDINARY_URL. Missing either → that path falls back to a mock.
 */

const hasImageKeys = () =>
  !!process.env.REPLICATE_API_TOKEN && !!process.env.CLOUDINARY_URL;
const hasVideoKeys = () => !!process.env.FAL_KEY && !!process.env.CLOUDINARY_URL;

// jobId → handle. In-memory is fine: Render runs one long-lived process, so the
// map survives between the submit and the polls. A restart loses jobs (fine for
// a demo). Real Fal jobs carry the statusUrl/responseUrl pollVideo needs; mock
// jobs just carry a start time.
type TrackedJob =
  | { mode: "real"; job: VideoJob; shotId: string; draftId?: string }
  | { mode: "mock"; startedAt: number; shotId: string };

const videoJobs = new Map<string, TrackedJob>();
const MOCK_VIDEO_MS = 8000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  const { kind, shotId, prompt, draftId, model, startImageUrl, durationSeconds } =
    await req.json().catch(() => ({}));
  if (!kind || !shotId || !prompt) {
    return NextResponse.json({ error: "kind, shotId, prompt are required" }, { status: 400 });
  }

  try {
    if (kind === "image") {
      // MOCK fallback — keeps the app runnable with zero keys.
      if (!hasImageKeys()) {
        await sleep(1200); // pretend latency so the UI's loading states stay honest
        const url = `https://picsum.photos/seed/${encodeURIComponent(shotId)}-${prompt.length}/768/432`;
        await logEvent({
          phase: "image",
          provider: "mock-replicate",
          model,
          draft_id: draftId,
          shot_id: shotId,
          latency_ms: 1200,
          cost_usd: 0.003,
          ok: true,
        });
        return NextResponse.json({ url });
      }

      // REAL — Replicate Seedream, live, mirrored to Cloudinary. Returns in seconds.
      const t0 = Date.now();
      const result = await generateImage(prompt, {
        referenceImageUrls: startImageUrl ? [startImageUrl] : undefined,
      });
      await logEvent({
        phase: "image",
        provider: result.provider,
        model,
        draft_id: draftId,
        shot_id: shotId,
        latency_ms: Date.now() - t0,
        cost_usd: result.costUsd,
        ok: true,
      });
      return NextResponse.json({ url: result.url });
    }

    if (kind === "video") {
      // MOCK fallback.
      if (!hasVideoKeys()) {
        const jobId = `mockjob_${shotId}_${Date.now()}`;
        videoJobs.set(jobId, { mode: "mock", startedAt: Date.now(), shotId });
        return NextResponse.json({ jobId });
      }

      // REAL — Fal Seedance. Submit returns instantly; client polls via GET.
      // NEVER awaited to completion here — that's what GET ?jobId is for.
      const job = await submitVideo(prompt, { startImageUrl, durationSeconds });
      videoJobs.set(job.jobId, { mode: "real", job, shotId, draftId });
      return NextResponse.json({ jobId: job.jobId });
    }

    return NextResponse.json({ error: `unknown kind: ${kind}` }, { status: 400 });
  } catch (err) {
    await logEvent({
      phase: kind === "video" ? "video" : "image",
      shot_id: shotId,
      draft_id: draftId,
      ok: false,
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "render failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }
  const tracked = videoJobs.get(jobId);
  if (!tracked) {
    return NextResponse.json({ status: "failed", error: "unknown job" }, { status: 404 });
  }

  // MOCK job — fake the elapsed-time gate.
  if (tracked.mode === "mock") {
    if (Date.now() - tracked.startedAt < MOCK_VIDEO_MS) {
      return NextResponse.json({ status: "pending" });
    }
    return NextResponse.json({ status: "done", url: mockVideoUrl });
  }

  // REAL job — one poll tick against Fal; on "ready" it's already mirrored to Cloudinary.
  try {
    const r = await pollVideo(tracked.job);
    if (r.state === "ready") {
      await logEvent({
        phase: "video",
        provider: tracked.job.provider,
        draft_id: tracked.draftId,
        shot_id: tracked.shotId,
        cost_usd: r.costUsd,
        ok: true,
      });
      return NextResponse.json({ status: "done", url: r.url });
    }
    if (r.state === "failed") {
      await logEvent({
        phase: "video",
        provider: tracked.job.provider,
        draft_id: tracked.draftId,
        shot_id: tracked.shotId,
        ok: false,
      });
      return NextResponse.json({ status: "failed", error: r.errorMessage });
    }
    return NextResponse.json({ status: "pending" }); // queued | running
  } catch (err) {
    // Transient poll error — report failed so the client stops; the pre-baked
    // clip is the demo safety net, not an infinite retry loop.
    return NextResponse.json(
      { status: "failed", error: err instanceof Error ? err.message : "poll failed" },
      { status: 500 }
    );
  }
}
