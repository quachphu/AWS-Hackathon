import { NextResponse } from "next/server";
import {
  pollRenderVideo,
  renderImage,
  submitRenderVideo,
} from "@/lib/render/render-service";

/**
 * Render endpoint - real wrappers with mock fallback so the app still runs
 * with zero keys.
 *
 *   POST { kind: "image", shotId, prompt } -> { url }
 *   POST { kind: "video", shotId, prompt } -> { jobId }
 *   GET  ?jobId=...                        -> { status, url? }
 */
export async function POST(req: Request) {
  const { kind, shotId, prompt, draftId, model, startImageUrl, durationSeconds } =
    await req.json().catch(() => ({}));

  if (!kind || !shotId || !prompt) {
    return NextResponse.json({ error: "kind, shotId, prompt are required" }, { status: 400 });
  }

  try {
    if (kind === "image") {
      const result = await renderImage({
        shotId,
        prompt,
        draftId,
        model,
        startImageUrl,
      });
      return NextResponse.json({ url: result.url });
    }

    if (kind === "video") {
      const result = await submitRenderVideo({
        shotId,
        prompt,
        draftId,
        model,
        startImageUrl,
        durationSeconds,
      });
      return NextResponse.json({
        jobId: result.jobId,
        providerJobId: result.providerJobId,
      });
    }

    return NextResponse.json({ error: `unknown kind: ${kind}` }, { status: 400 });
  } catch (err) {
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

  try {
    const result = await pollRenderVideo(jobId);
    if (result.status === "failed" && result.error === "unknown job") {
      return NextResponse.json(result, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { status: "failed", error: err instanceof Error ? err.message : "poll failed" },
      { status: 500 }
    );
  }
}
