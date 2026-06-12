import {
  chatHistoryMode,
  getChatHistoryEvents,
  recordChatHistoryEvent,
  type ChatHistoryInput,
} from "@/lib/analytics/chat-history";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 50);
  const events = await getChatHistoryEvents(Number.isFinite(limit) ? limit : 50);

  return Response.json({
    mode: chatHistoryMode(),
    events,
    count: events.length,
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ChatHistoryInput;
  const event = await recordChatHistoryEvent(body);

  return Response.json({
    ok: true,
    mode: chatHistoryMode(),
    event,
  });
}
