import { Buffer } from "node:buffer";
import { mockVideoUrl } from "@/lib/mock";
import { logEvent } from "@/lib/metrics/clickhouse";
import {
  generateImage,
  pollVideo,
  submitVideo,
  type VideoJob,
} from "@/lib/render/render-core";

export type RenderAspectRatio = "9:16" | "16:9" | "1:1";

export type RenderImageInput = {
  shotId: string;
  prompt: string;
  draftId?: string;
  model?: string;
  startImageUrl?: string;
  aspectRatio?: RenderAspectRatio;
};

export type SubmitVideoInput = RenderImageInput & {
  durationSeconds?: number;
};

export type RenderImageResult = {
  url: string;
  provider: string;
  mocked: boolean;
};

export type SubmitVideoResult = {
  jobId: string;
  providerJobId?: string;
  provider: string;
  mocked: boolean;
};

export type PollVideoResult =
  | { status: "pending"; provider?: string; mocked: boolean }
  | { status: "done"; url: string; provider?: string; mocked: boolean }
  | { status: "failed"; error: string; provider?: string; mocked: boolean };

type TrackedJob =
  | { mode: "real"; job: VideoJob; shotId: string; draftId?: string }
  | { mode: "mock"; startedAt: number; shotId: string };

type RealTrackedJob = Extract<TrackedJob, { mode: "real" }>;

const videoJobs = new Map<string, TrackedJob>();
const TRACKED_JOB_PREFIX = "renderjob_";
const MOCK_VIDEO_MS = 8000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const hasRenderKeys = () => !!process.env.FAL_KEY && !!process.env.CLOUDINARY_URL;

export async function renderImage(input: RenderImageInput): Promise<RenderImageResult> {
  const t0 = Date.now();

  try {
    if (!hasRenderKeys()) {
      await sleep(1200);
      const url = `https://picsum.photos/seed/${encodeURIComponent(input.shotId)}-${input.prompt.length}/768/432`;
      await logEvent({
        phase: "image",
        provider: "mock-fal-image",
        model: input.model,
        draft_id: input.draftId,
        shot_id: input.shotId,
        latency_ms: 1200,
        cost_usd: 0.003,
        ok: true,
      });
      return { url, provider: "mock-fal-image", mocked: true };
    }

    const result = await generateImage(input.prompt, {
      referenceImageUrls: input.startImageUrl ? [input.startImageUrl] : undefined,
      aspectRatio: input.aspectRatio,
    });
    await logEvent({
      phase: "image",
      provider: result.provider,
      model: input.model,
      draft_id: input.draftId,
      shot_id: input.shotId,
      latency_ms: Date.now() - t0,
      cost_usd: result.costUsd,
      ok: true,
    });
    return { url: result.url, provider: result.provider, mocked: false };
  } catch (error) {
    await logEvent({
      phase: "image",
      model: input.model,
      draft_id: input.draftId,
      shot_id: input.shotId,
      latency_ms: Date.now() - t0,
      ok: false,
    });
    throw error;
  }
}

export async function submitRenderVideo(input: SubmitVideoInput): Promise<SubmitVideoResult> {
  if (!hasRenderKeys()) {
    const tracked: TrackedJob = { mode: "mock", startedAt: Date.now(), shotId: input.shotId };
    const jobId = encodeTrackedJob(tracked);
    videoJobs.set(jobId, tracked);
    return { jobId, provider: "mock-fal-video", mocked: true };
  }

  const job = await submitVideo(input.prompt, {
    startImageUrl: input.startImageUrl,
    durationSeconds: input.durationSeconds,
    aspectRatio: input.aspectRatio,
  });
  const tracked: RealTrackedJob = {
    mode: "real",
    job,
    shotId: input.shotId,
    draftId: input.draftId,
  };
  const jobId = encodeTrackedJob(tracked);
  videoJobs.set(jobId, tracked);
  return { jobId, providerJobId: job.jobId, provider: job.provider, mocked: false };
}

export async function pollRenderVideo(jobId: string): Promise<PollVideoResult> {
  const tracked = videoJobs.get(jobId) ?? decodeTrackedJob(jobId);
  if (!tracked) return { status: "failed", error: "unknown job", mocked: true };

  if (!videoJobs.has(jobId)) {
    videoJobs.set(jobId, tracked);
  }

  if (tracked.mode === "mock") {
    if (Date.now() - tracked.startedAt < MOCK_VIDEO_MS) {
      return { status: "pending", provider: "mock-fal-video", mocked: true };
    }
    return { status: "done", url: mockVideoUrl, provider: "mock-fal-video", mocked: true };
  }

  const result = await pollVideo(tracked.job);
  if (result.state === "ready") {
    await logEvent({
      phase: "video",
      provider: tracked.job.provider,
      draft_id: tracked.draftId,
      shot_id: tracked.shotId,
      cost_usd: result.costUsd,
      ok: true,
    });
    return { status: "done", url: result.url, provider: tracked.job.provider, mocked: false };
  }

  if (result.state === "failed") {
    await logEvent({
      phase: "video",
      provider: tracked.job.provider,
      draft_id: tracked.draftId,
      shot_id: tracked.shotId,
      ok: false,
    });
    return {
      status: "failed",
      error: result.errorMessage,
      provider: tracked.job.provider,
      mocked: false,
    };
  }

  return { status: "pending", provider: tracked.job.provider, mocked: false };
}

function encodeTrackedJob(tracked: TrackedJob): string {
  const payload = Buffer.from(JSON.stringify(tracked), "utf8").toString("base64url");
  return `${TRACKED_JOB_PREFIX}${payload}`;
}

function decodeTrackedJob(jobId: string): TrackedJob | null {
  if (!jobId.startsWith(TRACKED_JOB_PREFIX)) return null;

  try {
    const payload = jobId.slice(TRACKED_JOB_PREFIX.length);
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TrackedJob | null;

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
  } catch {
    return null;
  }

  return null;
}
