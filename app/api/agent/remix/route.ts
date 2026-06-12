import { NextResponse } from "next/server";
import { runRemixAgent, type RemixAgentMessage } from "@/lib/openai/remix-agent";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    messages?: RemixAgentMessage[];
    prompt?: string;
  };

  const messages =
    Array.isArray(body.messages) && body.messages.length > 0
      ? body.messages
      : body.prompt
        ? [{ role: "user" as const, content: body.prompt }]
        : [];

  if (messages.length === 0) {
    return NextResponse.json({ error: "messages or prompt is required" }, { status: 400 });
  }

  const result = await runRemixAgent(messages);
  return NextResponse.json(result);
}
