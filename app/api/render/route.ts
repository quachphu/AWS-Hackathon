import { Buffer } from "node:buffer";
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
 * Image and video need FAL_KEY + CLOUDINARY_URL. Missing either → that path
 * falls back to a mock.
 */

const hasImageKeys = () => !!process.env.FAL_KEY && !!process.env.CLOUDINARY_URL;
const hasVideoKeys = () => !!process.env.FAL_KEY && !!process.env.CLOUDINARY_URL;

// Jobs are encoded into the returned jobId so polling survives Render restarts
// or worker changes; the map is only an in-process fast path.

type TrackedJob =
  | { mode: "real"; job: VideoJob; shotId: string; draftId?: string }
  | { mode: "mock"; startedAt: number; shotId: string };
type RealTrackedJob = Extract<TrackedJob, { mode: "real" }>;

const videoJobs = new Map<string, TrackedJob>();
const TRACKED_JOB_PREFIX = "renderjob_";
const MOCK_VIDEO_MS = 8000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function encodeTrackedJob(tracked: TrackedJob): string {
  const payload = Buffer.from(JSON.stringify(tracked), "utf8").toString("base64url");
  return `${TRACKED_JOB_PREFIX}${payload}`;
}

function decodeTrackedJob(jobId: string): TrackedJob | null {
  if (!jobId.startsWith(TRACKED_JOB_PREFIX)) return null;

  try {
    const payload = jobId.slice(TRACKED_JOB_PREFIX.length);
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as TrackedJob | null;
    if (parsed?.mode === "mock") {
      return typeof parsed.startedAt === "number" && !!parsed.shotId ? parsed : null;
    }
    if (parsed?.mode === "real") {
      if (
        !parsed.job?.jobId ||
        !parsed.job?.statusUrl ||
        !parsed.job?.responseUrl ||
        !parsed.job?.provider ||
        typeof parsed.job.durationSeconds !== "number" ||
        !parsed.shotId
      ) {
        return null;
      }
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

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
          provider: "mock-fal-image",
          model,
          draft_id: draftId,
          shot_id: shotId,
          latency_ms: 1200,
          cost_usd: 0.003,
          ok: true,
        });
        return NextResponse.json({ url });
      }

      // REAL — Fal Seedream, live, mirrored to Cloudinary. Returns in seconds.
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
        const tracked: TrackedJob = { mode: "mock", startedAt: Date.now(), shotId };
        const jobId = encodeTrackedJob(tracked);
        videoJobs.set(jobId, tracked);
        return NextResponse.json({ jobId });
      }

      // REAL — Fal Seedance. Submit returns instantly; client polls via GET.
      // NEVER awaited to completion here — that's what GET ?jobId is for.
      const job = await submitVideo(prompt, { startImageUrl, durationSeconds });
      const tracked: RealTrackedJob = { mode: "real", job, shotId, draftId };
      const jobId = encodeTrackedJob(tracked);
      videoJobs.set(jobId, tracked);
      return NextResponse.json({ jobId, providerJobId: job.jobId });
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
  const tracked = videoJobs.get(jobId) ?? decodeTrackedJob(jobId);
  if (!tracked) {
    return NextResponse.json({ status: "failed", error: "unknown job" }, { status: 404 });
  }
  if (!videoJobs.has(jobId)) {
    videoJobs.set(jobId, tracked);
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
