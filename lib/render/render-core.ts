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
// ENV: REPLICATE_API_TOKEN (image), FAL_KEY (video), CLOUDINARY_URL (mirror).
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
// Rough provider rates; confirm against Replicate/Fal dashboards before the
// demo. Returned on every render so the logging layer has a number to insert.
// ---------------------------------------------------------------------------
const IMAGE_COST_USD = 0.03; // Seedream 4.5, 2K, per image
const VIDEO_COST_USD_PER_SEC = 0.12; // Seedance 2.0, 720p, per second

// ---------------------------------------------------------------------------
// Cloudinary mirror — replaces the VisualLabs Blob mirror (we host on Render,
// not Vercel). Provider artifact URLs (replicate.delivery / fal.media) expire
// in minutes; this re-hosts them on Cloudinary's CDN so a returned URL is safe
// to store and show. Cloudinary fetches the provider URL server-side, so we
// don't download the bytes ourselves — one call does the whole mirror.
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ===========================================================================
// IMAGE — Replicate Seedream 4.5. LIVE / synchronous (submit + poll inline).
// Returns in a few seconds. This is the one you run live on stage.
// ===========================================================================

const REPLICATE_BASE = "https://api.replicate.com/v1";
const SEEDREAM_MODEL = "bytedance/seedream-4.5";
export const IMAGE_PROVIDER = `replicate/${SEEDREAM_MODEL}`;

interface ReplicatePrediction {
  id?: string;
  status?: "starting" | "processing" | "succeeded" | "failed" | "canceled" | string;
  output?: string | string[] | null;
  error?: string | null;
}

function replicateAuth(): string {
  const key = process.env.REPLICATE_API_TOKEN;
  if (!key) throw new Error("REPLICATE_API_TOKEN is not set");
  return `Bearer ${key}`;
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
  // 1. Submit
  const input: Record<string, unknown> = {
    prompt,
    size: "2K",
    aspect_ratio: opts.aspectRatio ?? "9:16",
  };
  const refs = (opts.referenceImageUrls ?? []).slice(0, 10);
  if (refs.length) input.image_input = refs;

  const submit = await fetch(
    `${REPLICATE_BASE}/models/${SEEDREAM_MODEL}/predictions`,
    {
      method: "POST",
      headers: { Authorization: replicateAuth(), "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
    }
  );
  if (!submit.ok) {
    const txt = await submit.text().catch(() => "");
    throw new Error(`Seedream submit failed (${submit.status}): ${txt.slice(0, 300)}`);
  }
  const created = (await submit.json()) as ReplicatePrediction;
  if (!created.id) throw new Error("Seedream submit returned no prediction id");

  // 2. Poll (~2s interval, 2 min cap — images return in seconds)
  const statusUrl = `${REPLICATE_BASE}/predictions/${created.id}`;
  const deadline = Date.now() + 2 * 60 * 1000;
  let outputUrl: string | null = null;
  while (Date.now() < deadline) {
    const res = await fetch(statusUrl, { headers: { Authorization: replicateAuth() } });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Seedream poll failed (${res.status}): ${txt.slice(0, 200)}`);
    }
    const pred = (await res.json()) as ReplicatePrediction;
    if (pred.status === "succeeded") {
      outputUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output ?? null;
      break;
    }
    if (pred.status === "failed" || pred.status === "canceled") {
      throw new Error(`Seedream ${pred.status}: ${pred.error ?? "no detail"}`);
    }
    await sleep(2_000);
  }
  if (!outputUrl) throw new Error("Seedream polling timed out");

  // 3. Mirror to Cloudinary (provider URL expires) and return
  const { url } = await mirrorToCloudinary({
    sourceUrl: outputUrl,
    publicId: `ad-factory/images/${created.id}`,
    resourceType: "image",
  });
  return { url, provider: IMAGE_PROVIDER, costUsd: IMAGE_COST_USD };
}

// ===========================================================================
// VIDEO — Fal Seedance 2.0. ASYNC. Submit returns a handle; poll separately.
// NEVER await this inline on stage — kick it off at the demo start, reveal
// at the climax, keep a pre-baked clip in your back pocket.
// ===========================================================================

const FAL_QUEUE_BASE = "https://queue.fal.run";
const SEEDANCE_ENDPOINT = "bytedance/seedance-2.0/reference-to-video";
export const VIDEO_PROVIDER = `fal/${SEEDANCE_ENDPOINT}`;

function falAuth(): string {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not set");
  return `Key ${key}`;
}

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
