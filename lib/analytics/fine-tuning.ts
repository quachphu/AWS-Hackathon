import {
  chatHistoryMode,
  getChatHistoryEvents,
  recordChatHistoryEvent,
  type ChatHistoryEvent,
} from "@/lib/analytics/chat-history";

export type FineTuneRecord = {
  id: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  metadata: {
    source: string;
    surface: string;
    qualityLabel: string;
    artifactType: string;
    model: string;
    live: boolean;
    mocked: boolean;
    score: number;
  };
};

export type FastinoTrainingJob = {
  jobId: string;
  status: "mock_queued" | "mock_complete";
  pipeline: "pioneer-fastino-mock";
  modelTarget: string;
  records: number;
  trainRecords: number;
  evalRecords: number;
  metrics: {
    promptQuality: number;
    visualSpecificity: number;
    safetyPassRate: number;
  };
  datasetPreview: FineTuneRecord[];
};

const SYSTEM_PROMPT =
  "You are a small prompt-generation model. Convert creator analytics and remix context into concise, high-specificity image generation prompts.";

export async function getFineTuneDataset(limit = 100) {
  const events = await getChatHistoryEvents(limit);
  return buildFineTuneDataset(events);
}

export function buildFineTuneDataset(events: ChatHistoryEvent[]): FineTuneRecord[] {
  const records = events
    .filter((event) => event.prompt || event.response || event.artifactProgram)
    .map((event) => eventToRecord(event));

  return records;
}

export function recordsToJsonl(records: FineTuneRecord[]) {
  return records.map((record) => JSON.stringify(record)).join("\n");
}

export async function startMockFastinoTrainingJob(limit = 100): Promise<FastinoTrainingJob> {
  const records = await getFineTuneDataset(limit);
  const job = createMockFastinoTrainingJob(records);

  await recordChatHistoryEvent({
    surface: "analytics",
    eventType: "training_job",
    role: "system",
    model: job.modelTarget,
    provider: "pioneer-fastino-mock",
    prompt: "Start mock Fastino/Pioneer prompt-model training from exported ClickHouse chat history.",
    response: `Mock training completed with ${job.trainRecords} train and ${job.evalRecords} eval records.`,
    artifactType: "TrainingPipelineArtifact",
    qualityLabel: "training",
    action: "mock_fastino_training",
    mocked: true,
    live: false,
    metadata: job,
  });

  return job;
}

export async function getTrainingPipelineSummary() {
  const events = await getChatHistoryEvents(100);
  const records = buildFineTuneDataset(events);
  const job = createMockFastinoTrainingJob(records);

  return {
    mode: chatHistoryMode(),
    events,
    records,
    job,
    summary: `${events.length} chat/history events produced ${records.length} fine-tuning records. ClickHouse mode is ${chatHistoryMode()}; Fastino/Pioneer is mocked for the hackathon demo.`,
  };
}

function createMockFastinoTrainingJob(records: FineTuneRecord[]): FastinoTrainingJob {
  const evalRecords = records.length > 0 ? Math.max(1, Math.ceil(records.length * 0.2)) : 0;
  const trainRecords = Math.max(0, records.length - evalRecords);

  return {
    jobId: `fastino_mock_${Date.now().toString(36)}`,
    status: "mock_complete",
    pipeline: "pioneer-fastino-mock",
    modelTarget: process.env.PIONEER_MODEL || "pioneer/fastino-image-prompt-v0",
    records: records.length,
    trainRecords,
    evalRecords,
    metrics: {
      promptQuality: 0.88,
      visualSpecificity: 0.91,
      safetyPassRate: 1,
    },
    datasetPreview: records.slice(0, 3),
  };
}

function eventToRecord(event: ChatHistoryEvent): FineTuneRecord {
  const context = [
    event.sourceUrl ? `Source URL: ${event.sourceUrl}` : "",
    event.qualityLabel ? `Quality label: ${event.qualityLabel}` : "",
    event.artifactType ? `Artifact type: ${event.artifactType}` : "",
    event.action ? `User action: ${event.action}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const userContent = [context, event.prompt || "Generate a stronger image prompt from this remix context."]
    .filter(Boolean)
    .join("\n\n");
  const assistantContent =
    event.response ||
    event.artifactProgram ||
    "Generate a high-specificity image prompt with character consistency, scene details, lighting, and platform-fit constraints.";

  return {
    id: event.eventId,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
      { role: "assistant", content: assistantContent },
    ],
    metadata: {
      source: event.sourceUrl || event.provider || "demo",
      surface: event.surface,
      qualityLabel: event.qualityLabel,
      artifactType: event.artifactType,
      model: event.model,
      live: event.live,
      mocked: event.mocked,
      score: scoreEvent(event),
    },
  };
}

function scoreEvent(event: ChatHistoryEvent) {
  let score = 60;
  if (event.live) score += 10;
  if (event.artifactType) score += 10;
  if (event.response.length > 120) score += 10;
  if (
    event.qualityLabel === "image_prompt" ||
    event.qualityLabel === "good_image_prompt" ||
    event.qualityLabel === "analytics"
  ) {
    score += 5;
  }
  return Math.min(99, score);
}
