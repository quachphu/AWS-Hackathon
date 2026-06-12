import { NextRequest, NextResponse } from "next/server";
import { publishAd } from "@/lib/composio/publish";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, hook, cta, videoUrl, imageUrl, targets } = body;

    if (!title || !hook || !cta) {
      return NextResponse.json(
        { error: "title, hook, and cta are required" },
        { status: 400 }
      );
    }

    const result = await publishAd(
      { title, hook, cta, videoUrl: videoUrl ?? null, imageUrl: imageUrl ?? null },
      targets ?? ["instagram"]
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
