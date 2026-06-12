import { chatHistoryMode, recordChatHistoryEvent } from "@/lib/analytics/chat-history";
import { getFineTuneDataset, recordsToJsonl } from "@/lib/analytics/fine-tuning";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "json";
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const records = await getFineTuneDataset(Number.isFinite(limit) ? limit : 100);
  const jsonl = recordsToJsonl(records);

  await recordChatHistoryEvent({
    surface: "analytics",
    eventType: "dataset_export",
    role: "system",
    model: process.env.PIONEER_MODEL || "pioneer/fastino-image-prompt-v0",
    provider: "clickhouse",
    prompt: "Export chat history into Fastino/Pioneer JSONL training records.",
    response: `Exported ${records.length} JSONL records from ${chatHistoryMode()} history.`,
    qualityLabel: "dataset_export",
    action: format === "jsonl" ? "download_jsonl" : "preview_dataset",
    mocked: chatHistoryMode() !== "clickhouse",
    live: chatHistoryMode() === "clickhouse",
    metadata: { records: records.length, format },
  });

  if (format === "jsonl") {
    return new Response(jsonl, {
      headers: {
        "Content-Disposition": 'attachment; filename="fastino-prompt-dataset.jsonl"',
        "Content-Type": "application/x-ndjson; charset=utf-8",
      },
    });
  }

  return Response.json({
    mode: chatHistoryMode(),
    records,
    jsonl,
    count: records.length,
  });
}
