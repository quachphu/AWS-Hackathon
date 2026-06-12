import { NextResponse } from "next/server";
import { runRemixAgent, type RemixAgentMessage } from "@/lib/openai/remix-agent";
import { latestUserPrompt, recordChatHistoryEvent } from "@/lib/analytics/chat-history";

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
  const prompt = latestUserPrompt(messages);
  await recordChatHistoryEvent({
    sessionId: "visual-remix-demo",
    surface: "remix",
    eventType: "chat_turn",
    role: "assistant",
    model: result.model,
    provider: "openai",
    prompt,
    response: result.output,
    artifactType: "RemixPromptArtifact",
    qualityLabel: "image_prompt",
    action: "remix_chat_response",
    mocked: result.mocked,
    live: !result.mocked,
    metadata: { messageCount: messages.length },
  });

  return NextResponse.json(result);
}
