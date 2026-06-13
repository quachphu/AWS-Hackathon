import { NextRequest, NextResponse } from "next/server";
import {
  preparePublishDryRun,
  publishAd,
  type PublishTarget,
} from "@/lib/composio/publish";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, hook, cta, videoUrl, imageUrl, targets, dryRun } = body;
    const publishTargets = normalizePublishTargets(targets);

    if (!title || !hook || !cta) {
      return NextResponse.json(
        { error: "title, hook, and cta are required" },
        { status: 400 }
      );
    }

    if (dryRun) {
      const result = await preparePublishDryRun(
        { title, hook, cta, videoUrl: videoUrl ?? null, imageUrl: imageUrl ?? null },
        publishTargets,
        {
          sessionId: "visual-remix-demo",
          surface: "remix",
        }
      );

      return NextResponse.json(result);
    }

    const result = await publishAd(
      { title, hook, cta, videoUrl: videoUrl ?? null, imageUrl: imageUrl ?? null },
      publishTargets
    );

    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch (e) {
    console.error("[api/publish]", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

function normalizePublishTargets(targets: unknown): PublishTarget[] {
  if (!Array.isArray(targets)) return ["instagram"];

  const normalized = targets.filter((target): target is PublishTarget =>
    target === "instagram" || target === "tiktok"
  );
  return normalized.length > 0 ? normalized : ["instagram"];
}
