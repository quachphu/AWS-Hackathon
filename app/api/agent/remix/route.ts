import { NextResponse } from "next/server";
import {
  runRemixAgent,
  type RemixAgentMessage,
  type RemixAgentMode,
} from "@/lib/openai/remix-agent";

const REMIX_MODES: RemixAgentMode[] = ["source", "image", "video"];

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    messages?: RemixAgentMessage[];
    prompt?: string;
    mode?: string;
  };

  const mode = REMIX_MODES.find((value) => value === body.mode);

  const messages =
    Array.isArray(body.messages) && body.messages.length > 0
      ? body.messages
      : body.prompt
        ? [{ role: "user" as const, content: body.prompt }]
        : [];

  if (messages.length === 0) {
    return NextResponse.json({ error: "messages or prompt is required" }, { status: 400 });
  }

  const result = await runRemixAgent(messages, mode);
  return NextResponse.json(result);
}
