import { NextRequest, NextResponse } from "next/server";
import { recordChatHistoryEvent } from "@/lib/analytics/chat-history";
import { publishAd } from "@/lib/composio/publish";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, hook, cta, videoUrl, imageUrl, targets, dryRun } = body;
    const publishTargets = targets ?? ["instagram"];

    if (!title || !hook || !cta) {
      return NextResponse.json(
        { error: "title, hook, and cta are required" },
        { status: 400 }
      );
    }

    if (dryRun) {
      const result = {
        ok: true,
        dryRun: true,
        detail: `dry-run post prepared for "${title}" to ${publishTargets.join(", ")}`,
        tiktok: publishTargets.includes("tiktok") ? { publish_id: "dry_run_pub_id" } : undefined,
        instagram: publishTargets.includes("instagram") ? { media_id: "dry_run_media_id" } : undefined,
      };

      await recordChatHistoryEvent({
        sessionId: "visual-remix-demo",
        surface: "remix",
        eventType: "artifact_render",
        role: "assistant",
        model: "composio-dry-run",
        provider: "composio",
        prompt: `${hook}\n\n${cta}`,
        response: result.detail,
        artifactType: "PublishDraft",
        qualityLabel: "publish_draft",
        action: "dry_run_publish",
        mocked: true,
        live: false,
        metadata: { title, targets: publishTargets, hasVideo: !!videoUrl, hasImage: !!imageUrl },
      });

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
