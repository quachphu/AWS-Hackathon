import { chatHistoryMode } from "@/lib/analytics/chat-history";
import { startMockFastinoTrainingJob } from "@/lib/analytics/fine-tuning";

export const dynamic = "force-dynamic";

export async function GET() {
  return train();
}

export async function POST() {
  return train();
}

async function train() {
  const job = await startMockFastinoTrainingJob();

  return Response.json({
    mode: chatHistoryMode(),
    job,
    note: "Mock Fastino/Pioneer job only. No real model training was launched.",
  });
}
