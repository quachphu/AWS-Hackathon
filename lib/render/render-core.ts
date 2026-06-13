// render-core.ts — fire-and-poll render core for the hackathon build.
//
// Carved out of VisualLabs lib/render/ (queue.ts was 1,355 lines; this is the
// ~5% that earns demo points). Everything cut per CLAUDE.md: chained-extension
// for >15s clips, MAX-tier gating, the refund/error-category ledger, recovery,
// productions/cast anchoring, credits, quota, DB rows, Sentry.
//
// What's left is the whole job: submit → poll → mirror to Cloudinary → return a URL.
//
// DEPENDENCIES: only `cloudinary`. No DB, no auth, no app context.
// ENV: FAL_KEY (image + video), CLOUDINARY_URL (mirror).
//
// CONTRACT for the rest of the team:
//   - generateImage()  → LIVE. Returns a Cloudinary URL in seconds. Call it inline.
//   - submitVideo()    → ASYNC. Returns a job handle. Never await it on stage.
//   - pollVideo()      → poll the handle until { state: "ready", url }.
//   Every returned `url` is a permanent Cloudinary CDN URL — provider URLs
//   expire in minutes, so C and D should only ever hold the Cloudinary URL.
//
// NOTE: the cloudinary SDK parses CLOUDINARY_URL *at import time* and throws on
// an empty/invalid value — so it's imported lazily inside the mirror, after the
// env check. That keeps the mock path (no keys) from ever loading it.

// ---------------------------------------------------------------------------
// Cost (for ClickHouse — B's money chart reads this).
// Rough provider rates; confirm against Fal dashboards before the
// demo. Returned on every render so the logging layer has a number to insert.
// ---------------------------------------------------------------------------
const IMAGE_COST_USD = 0.04; // Fal Seedream 4.5, 2K, per image
const VIDEO_COST_USD_PER_SEC = 0.12; // Seedance 2.0, 720p, per second

// ---------------------------------------------------------------------------
// Cloudinary mirror — replaces the VisualLabs Blob mirror (we host on Render,
// not Vercel). Provider artifact URLs expire
// in minutes; this re-hosts them on Cloudinary's CDN so a returned URL is safe
// to store and show. Cloudinary fetches the provider URL server-side, so we
// don't download the bytes ourselves - one call does the whole mirror.
//
// ENV: CLOUDINARY_URL = cloudinary://<api_key>:<api_secret>@<cloud_name>
// The SDK auto-reads CLOUDINARY_URL on import; we guard + lazy-import it here so
// an empty placeholder never crashes the module on the mock path.
// ---------------------------------------------------------------------------
async function mirrorToCloudinary(args: {
  sourceUrl: string;
  publicId: string; // no extension — Cloudinary derives it from the asset
  resourceType: "image" | "video";
}): Promise<{ url: string }> {
  if (!process.env.CLOUDINARY_URL) {
    throw new Error("CLOUDINARY_URL is not set");
  }
  const { v2: cloudinary } = await import("cloudinary");
  cloudinary.config({ secure: true });
  const res = await cloudinary.uploader.upload(args.sourceUrl, {
    resource_type: args.resourceType,
    public_id: args.publicId,
    overwrite: true,
  });
  if (!res.secure_url) {
    throw new Error(`Cloudinary mirror returned no secure_url for ${args.sourceUrl}`);
  }
  return { url: res.secure_url };
}

const FAL_RUN_BASE = "https://fal.run";
const FAL_QUEUE_BASE = "https://queue.fal.run";

function falAuth(): string {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not set");
  return `Key ${key}`;
}

// ===========================================================================
// IMAGE — Fal Seedream 4.5. LIVE / synchronous.
// Returns in a few seconds. This is the one you run live on stage.
// ===========================================================================

const SEEDREAM_TEXT_TO_IMAGE_ENDPOINT = "fal-ai/bytedance/seedream/v4.5/text-to-image";
const SEEDREAM_EDIT_ENDPOINT = "fal-ai/bytedance/seedream/v4.5/edit";
export const IMAGE_PROVIDER = `fal/${SEEDREAM_TEXT_TO_IMAGE_ENDPOINT}`;

interface FalImageResponse {
  images?: Array<{ url?: string }>;
  seed?: number;
}

export interface ImageResult {
  url: string; // permanent Cloudinary URL
  provider: string;
  costUsd: number;
}

export async function generateImage(
  prompt: string,
  opts: { referenceImageUrls?: string[]; aspectRatio?: "9:16" | "16:9" | "1:1" } = {}
): Promise<ImageResult> {
  const refs = (opts.referenceImageUrls ?? []).slice(0, 10);
  const endpoint = refs.length ? SEEDREAM_EDIT_ENDPOINT : SEEDREAM_TEXT_TO_IMAGE_ENDPOINT;
  const body: Record<string, unknown> = {
    prompt,
    image_size: imageSizeForAspectRatio(opts.aspectRatio ?? "9:16"),
    num_images: 1,
    max_images: 1,
    sync_mode: false,
    enable_safety_checker: true,
  };
  if (refs.length) body.image_urls = refs;

  const res = await fetch(`${FAL_RUN_BASE}/${endpoint}`, {
    method: "POST",
    headers: { Authorization: falAuth(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Seedream submit failed (${res.status}): ${txt.slice(0, 300)}`);
  }
  const result = (await res.json()) as FalImageResponse;
  const outputUrl = result.images?.find((image) => image.url)?.url;
  if (!outputUrl) throw new Error("Seedream completed without an image url");

  const { url } = await mirrorToCloudinary({
    sourceUrl: outputUrl,
    publicId: `ad-factory/images/fal-${result.seed ?? Date.now()}-${Math.random().toString(16).slice(2)}`,
    resourceType: "image",
  });
  return { url, provider: IMAGE_PROVIDER, costUsd: IMAGE_COST_USD };
}

function imageSizeForAspectRatio(aspectRatio: "9:16" | "16:9" | "1:1") {
  if (aspectRatio === "16:9") return "landscape_16_9";
  if (aspectRatio === "1:1") return "square_hd";
  return "portrait_16_9";
}

// ===========================================================================
// VIDEO — Fal Seedance 2.0. ASYNC. Submit returns a handle; poll separately.
// NEVER await this inline on stage — kick it off at the demo start, reveal
// at the climax, keep a pre-baked clip in your back pocket.
// ===========================================================================

const SEEDANCE_ENDPOINT = "bytedance/seedance-2.0/reference-to-video";
export const VIDEO_PROVIDER = `fal/${SEEDANCE_ENDPOINT}`;

export interface VideoJob {
  jobId: string;
  statusUrl: string;
  responseUrl: string;
  provider: string;
  durationSeconds: number; // carried so pollVideo can price the result
}

export async function submitVideo(
  prompt: string,
  opts: {
    durationSeconds?: number;
    aspectRatio?: "9:16" | "16:9" | "1:1";
    resolution?: "480p" | "720p" | "1080p";
    startImageUrl?: string; // first-frame seed (e.g. the shot's generated still)
  } = {}
): Promise<VideoJob> {
  const durationSeconds = opts.durationSeconds ?? 5;
  const body: Record<string, unknown> = {
    prompt: opts.startImageUrl
      ? `Open the shot from @Image1 and use it as the visual reference for subject, style, and composition.\n\n${prompt}`
      : prompt,
    duration: String(durationSeconds),
    aspect_ratio: opts.aspectRatio ?? "9:16",
    resolution: opts.resolution ?? "720p",
    generate_audio: false,
  };
  if (opts.startImageUrl) body.image_urls = [opts.startImageUrl];

  const res = await fetch(`${FAL_QUEUE_BASE}/${SEEDANCE_ENDPOINT}`, {
    method: "POST",
    headers: { Authorization: falAuth(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Seedance submit failed (${res.status}): ${txt.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    request_id?: string;
    status_url?: string;
    response_url?: string;
  };
  if (!json.request_id || !json.status_url || !json.response_url) {
    throw new Error("Seedance submit missing request_id/status_url/response_url");
  }
  return {
    jobId: json.request_id,
    statusUrl: json.status_url,
    responseUrl: json.response_url,
    provider: VIDEO_PROVIDER,
    durationSeconds,
  };
}

export type VideoPollResult =
  | { state: "queued" | "running" }
  | { state: "ready"; url: string; costUsd: number }
  | { state: "failed"; errorMessage: string };

// Call this on an interval from the client (or a route) until state==="ready".
// One tick = one status check; on COMPLETED it mirrors to Cloudinary, prices.
export async function pollVideo(job: VideoJob): Promise<VideoPollResult> {
  const statusRes = await fetch(job.statusUrl, { headers: { Authorization: falAuth() } });
  if (!statusRes.ok) {
    const txt = await statusRes.text().catch(() => "");
    throw new Error(`Seedance status failed (${statusRes.status}): ${txt.slice(0, 200)}`);
  }
  const status = (await statusRes.json()) as { status?: string };

  if (status.status === "FAILED") {
    return { state: "failed", errorMessage: "Seedance reported FAILED" };
  }
  if (status.status !== "COMPLETED") {
    return { state: status.status === "IN_PROGRESS" ? "running" : "queued" };
  }

  // COMPLETED → fetch the result, mirror to Cloudinary.
  const resultRes = await fetch(job.responseUrl, { headers: { Authorization: falAuth() } });
  if (!resultRes.ok) {
    const txt = await resultRes.text().catch(() => "");
    throw new Error(`Seedance result failed (${resultRes.status}): ${txt.slice(0, 200)}`);
  }
  const result = (await resultRes.json()) as { video?: { url?: string } };
  const providerUrl = result.video?.url;
  if (!providerUrl) throw new Error("Seedance completed without a video url");

  const { url } = await mirrorToCloudinary({
    sourceUrl: providerUrl,
    publicId: `ad-factory/videos/${job.jobId}`,
    resourceType: "video",
  });
  return {
    state: "ready",
    url,
    costUsd: job.durationSeconds * VIDEO_COST_USD_PER_SEC,
  };
}
