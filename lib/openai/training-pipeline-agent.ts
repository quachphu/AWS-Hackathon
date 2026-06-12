import { Agent, run, setDefaultOpenAIKey } from "@openai/agents";
import { getTrainingPipelineSummary, type FastinoTrainingJob } from "@/lib/analytics/fine-tuning";
import { currentAgentModelSettings, getAgentModel, getOpenAIApiKey } from "@/lib/openai/remix-agent";
import type { ChatHistoryEvent } from "@/lib/analytics/chat-history";
import type { FineTuneRecord } from "@/lib/analytics/fine-tuning";

export type TrainingPipelineAgentResult = {
  live: boolean;
  mocked: boolean;
  model: string;
  summary: string;
  recommendations: string[];
  program: string;
  eventCount: number;
  recordCount: number;
  clickhouseMode: string;
  job: FastinoTrainingJob;
};

const TRAINING_AGENT_INSTRUCTIONS = [
  "You are a hackathon analytics engineer explaining a mock-first ClickHouse to Fastino/Pioneer training loop.",
  "Use only the supplied event and dataset counts.",
  "Return strict JSON with keys summary and recommendations.",
  "recommendations must be an array of exactly three short strings.",
  "Do not claim real fine-tuning happened; Fastino/Pioneer is a mock handoff unless explicitly marked live.",
].join("\n");

export async function runTrainingPipelineAgent(): Promise<TrainingPipelineAgentResult> {
  const pipeline = await getTrainingPipelineSummary();
  const model = getAgentModel();
  const apiKey = getOpenAIApiKey();
  let mocked = true;
  let summary = pipeline.summary;
  let recommendations = fallbackRecommendations(pipeline.records);

  if (apiKey) {
    try {
      setDefaultOpenAIKey(apiKey);
      const agent = new Agent({
        name: "Harness ClickHouse Fastino Planner",
        instructions: TRAINING_AGENT_INSTRUCTIONS,
        model,
        modelSettings: currentAgentModelSettings(model),
      });
      const result = await run(agent, compactPipelineInput(pipeline), { maxTurns: 2 });
      const parsed = parseAgentJson(String(result.finalOutput ?? ""));
      summary = parsed.summary || summary;
      recommendations = parsed.recommendations.length > 0 ? parsed.recommendations.slice(0, 3) : recommendations;
      mocked = false;
    } catch {
      mocked = true;
    }
  }

  return {
    live: pipeline.mode === "clickhouse",
    mocked,
    model,
    summary,
    recommendations,
    program: buildTrainingPipelineProgram({
      summary,
      recommendations,
      events: pipeline.events,
      records: pipeline.records,
      job: pipeline.job,
      mode: pipeline.mode,
    }),
    eventCount: pipeline.events.length,
    recordCount: pipeline.records.length,
    clickhouseMode: pipeline.mode,
    job: pipeline.job,
  };
}

function compactPipelineInput(pipeline: Awaited<ReturnType<typeof getTrainingPipelineSummary>>) {
  return JSON.stringify({
    clickhouseMode: pipeline.mode,
    eventCount: pipeline.events.length,
    recordCount: pipeline.records.length,
    job: {
      pipeline: pipeline.job.pipeline,
      status: pipeline.job.status,
      trainRecords: pipeline.job.trainRecords,
      evalRecords: pipeline.job.evalRecords,
      metrics: pipeline.job.metrics,
    },
    recentEvents: pipeline.events.slice(0, 5).map((event) => ({
      surface: event.surface,
      eventType: event.eventType,
      qualityLabel: event.qualityLabel,
      artifactType: event.artifactType,
      live: event.live,
      mocked: event.mocked,
    })),
  });
}

function buildTrainingPipelineProgram(input: {
  summary: string;
  recommendations: string[];
  events: ChatHistoryEvent[];
  records: FineTuneRecord[];
  job: FastinoTrainingJob;
  mode: string;
}) {
  const metrics = [
    { label: "Events", value: input.events.length.toString(), detail: `${input.mode} storage` },
    { label: "JSONL records", value: input.records.length.toString(), detail: "prompt corpus" },
    { label: "Train split", value: input.job.trainRecords.toString(), detail: "mock Fastino" },
    { label: "Eval split", value: input.job.evalRecords.toString(), detail: "prompt QA" },
    {
      label: "Quality",
      value: `${Math.round(input.job.metrics.promptQuality * 100)}%`,
      detail: "mock judge",
    },
  ];
  const records = input.records.slice(0, 4).map((record) => ({
    id: record.id,
    surface: record.metadata.surface,
    qualityLabel: record.metadata.qualityLabel || "chat",
    artifactType: record.metadata.artifactType || "none",
    score: record.metadata.score,
    prompt: record.messages.find((message) => message.role === "user")?.content.slice(0, 180) ?? "",
  }));
  const steps = [
    "Extract chat turns and OpenUI artifact metadata with an LLM-shaped deterministic pipeline.",
    "Store append-only events in ClickHouse when configured; use memory/demo fallback locally.",
    "Export JSONL records for a Pioneer/Fastino small prompt model.",
    "Keep rollback to the current OpenAI prompt-generation path.",
  ];

  return `root = TrainingPipelineArtifact(${JSON.stringify("ClickHouse to Fastino prompt loop")}, ${JSON.stringify(
    input.summary
  )}, ${JSON.stringify(input.mode)}, ${JSON.stringify(input.job.pipeline)}, ${JSON.stringify(
    input.job.status
  )}, ${JSON.stringify(metrics)}, ${JSON.stringify(records)}, ${JSON.stringify([
    ...input.recommendations,
    ...steps,
  ])})`;
}

function fallbackRecommendations(records: FineTuneRecord[]) {
  return [
    `Use the ${records.length} exported records as a smoke-test corpus before real Fastino training.`,
    "Prefer visual specificity, platform signal, and artifact approval as prompt-quality labels.",
    "Keep ClickHouse append-only and leave the current OpenAI prompt path as rollback.",
  ];
}

function parseAgentJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as { summary?: unknown; recommendations?: unknown };
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.filter((item): item is string => typeof item === "string")
        : [],
    };
  } catch {
    return { summary: "", recommendations: [] };
  }
}
