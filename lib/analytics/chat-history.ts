import { createClient } from "@clickhouse/client";
import { getRuntimeModelConfig } from "@/lib/gateway/models";

export type ChatSurface = "remix" | "agent" | "instagram" | "analytics";

export type ChatHistoryEvent = {
  eventId: string;
  sessionId: string;
  surface: ChatSurface;
  eventType: "chat_turn" | "analytics_pull" | "artifact_render" | "dataset_export" | "training_job";
  role: "user" | "assistant" | "system";
  model: string;
  provider: string;
  sourceUrl: string;
  prompt: string;
  response: string;
  artifactType: string;
  artifactProgram: string;
  qualityLabel: string;
  action: string;
  mocked: boolean;
  live: boolean;
  metadata: Record<string, unknown>;
  ts: string;
};

export type ChatHistoryInput = Partial<Omit<ChatHistoryEvent, "eventId" | "ts">> & {
  eventId?: string;
  ts?: string;
};

type StoredChatHistoryRow = {
  ts: string;
  event_id: string;
  session_id: string;
  surface: ChatSurface;
  event_type: ChatHistoryEvent["eventType"];
  role: ChatHistoryEvent["role"];
  model: string;
  provider: string;
  source_url: string;
  prompt: string;
  response: string;
  artifact_type: string;
  artifact_program: string;
  quality_label: string;
  action: string;
  mocked: number;
  live: number;
  metadata_json: string;
};

const MAX_TEXT_LENGTH = 6000;
const client = process.env.CLICKHOUSE_URL
  ? createClient({
      url: process.env.CLICKHOUSE_URL,
      username: process.env.CLICKHOUSE_USER ?? "default",
      password: process.env.CLICKHOUSE_PASSWORD,
    })
  : null;

const globalStore = globalThis as typeof globalThis & {
  __harnessChatHistoryEvents?: ChatHistoryEvent[];
};

function memoryEvents() {
  globalStore.__harnessChatHistoryEvents ??= [];
  return globalStore.__harnessChatHistoryEvents;
}

export function chatHistoryMode() {
  return client ? "clickhouse" : "memory";
}

export async function recordChatHistoryEvent(input: ChatHistoryInput): Promise<ChatHistoryEvent> {
  const event = normalizeEvent(input);

  if (!client) {
    memoryEvents().unshift(event);
    return event;
  }

  try {
    await client.insert({
      table: "chat_events",
      values: [toStoredRow(event)],
      format: "JSONEachRow",
    });
  } catch (error) {
    console.error("[chat-history] ClickHouse insert failed (non-fatal)", error);
    memoryEvents().unshift(event);
  }

  return event;
}

export async function getChatHistoryEvents(limit = 50): Promise<ChatHistoryEvent[]> {
  if (!client) {
    const events = memoryEvents();
    return events.length > 0 ? events.slice(0, limit) : seedChatHistoryEvents().slice(0, limit);
  }

  try {
    const result = await client.query({
      query: `
        SELECT
          toString(ts) AS ts,
          event_id,
          session_id,
          surface,
          event_type,
          role,
          model,
          provider,
          source_url,
          prompt,
          response,
          artifact_type,
          artifact_program,
          quality_label,
          action,
          mocked,
          live,
          metadata_json
        FROM chat_events
        ORDER BY ts DESC
        LIMIT {limit:UInt32}
      `,
      query_params: { limit },
      format: "JSONEachRow",
    });
    const rows = await result.json<StoredChatHistoryRow>();
    return rows.map(fromStoredRow);
  } catch (error) {
    console.error("[chat-history] ClickHouse read failed (non-fatal)", error);
    const events = memoryEvents();
    return events.length > 0 ? events.slice(0, limit) : seedChatHistoryEvents().slice(0, limit);
  }
}

export function latestUserPrompt(messages: Array<{ role?: string; content?: string }>) {
  return [...messages].reverse().find((message) => message.role === "user" && message.content?.trim())?.content ?? "";
}

export function extractSourceUrl(text: string) {
  const match = text.match(/https?:\/\/[^\s)"']+/i);
  if (!match) return "";

  try {
    const url = new URL(match[0]);
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return match[0].slice(0, 500);
  }
}

export function redactForAnalytics(value: string) {
  return value
    .replace(/sk-[A-Za-z0-9_-]{16,}/g, "[redacted-openai-key]")
    .replace(/ak_[A-Za-z0-9_-]{12,}/g, "[redacted-composio-key]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/([?&](?:token|key|secret|api_key)=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, MAX_TEXT_LENGTH);
}

function normalizeEvent(input: ChatHistoryInput): ChatHistoryEvent {
  const prompt = redactForAnalytics(input.prompt ?? "");
  const response = redactForAnalytics(input.response ?? "");
  const artifactProgram = redactForAnalytics(input.artifactProgram ?? "");
  const sourceUrl = input.sourceUrl ? extractSourceUrl(input.sourceUrl) : extractSourceUrl(prompt);

  return {
    eventId: input.eventId ?? crypto.randomUUID(),
    sessionId: redactForAnalytics(input.sessionId ?? "demo-session"),
    surface: input.surface ?? "remix",
    eventType: input.eventType ?? "chat_turn",
    role: input.role ?? "assistant",
    model: redactForAnalytics(input.model ?? ""),
    provider: redactForAnalytics(input.provider ?? ""),
    sourceUrl,
    prompt,
    response,
    artifactType: redactForAnalytics(input.artifactType ?? ""),
    artifactProgram,
    qualityLabel: redactForAnalytics(input.qualityLabel ?? deriveQualityLabel(prompt, response)),
    action: redactForAnalytics(input.action ?? ""),
    mocked: input.mocked ?? false,
    live: input.live ?? false,
    metadata: sanitizeMetadata(input.metadata ?? {}),
    ts: input.ts ?? new Date().toISOString(),
  };
}

function deriveQualityLabel(prompt: string, response: string) {
  const combined = `${prompt} ${response}`.toLowerCase();
  if (combined.includes("instagram") || combined.includes("analytics")) return "analytics";
  if (combined.includes("render prompt") || combined.includes("image")) return "image_prompt";
  if (combined.includes("video") || combined.includes("tiktok")) return "short_video";
  return "chat";
}

function sanitizeMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => {
      if (typeof value === "string") return [key, redactForAnalytics(value)];
      if (typeof value === "number" || typeof value === "boolean" || value == null) return [key, value];
      return [key, redactForAnalytics(JSON.stringify(value)).slice(0, 1000)];
    })
  );
}

function toStoredRow(event: ChatHistoryEvent): StoredChatHistoryRow {
  return {
    ts: event.ts,
    event_id: event.eventId,
    session_id: event.sessionId,
    surface: event.surface,
    event_type: event.eventType,
    role: event.role,
    model: event.model,
    provider: event.provider,
    source_url: event.sourceUrl,
    prompt: event.prompt,
    response: event.response,
    artifact_type: event.artifactType,
    artifact_program: event.artifactProgram,
    quality_label: event.qualityLabel,
    action: event.action,
    mocked: event.mocked ? 1 : 0,
    live: event.live ? 1 : 0,
    metadata_json: JSON.stringify(event.metadata),
  };
}

function fromStoredRow(row: StoredChatHistoryRow): ChatHistoryEvent {
  return {
    eventId: row.event_id,
    sessionId: row.session_id,
    surface: row.surface,
    eventType: row.event_type,
    role: row.role,
    model: row.model,
    provider: row.provider,
    sourceUrl: row.source_url,
    prompt: row.prompt,
    response: row.response,
    artifactType: row.artifact_type,
    artifactProgram: row.artifact_program,
    qualityLabel: row.quality_label,
    action: row.action,
    mocked: row.mocked === 1,
    live: row.live === 1,
    metadata: parseMetadata(row.metadata_json),
    ts: row.ts,
  };
}

function parseMetadata(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function seedChatHistoryEvents(): ChatHistoryEvent[] {
  const modelConfig = getRuntimeModelConfig();

  return [
    normalizeEvent({
      eventId: "seed-instagram-analytics",
      sessionId: "seed-demo",
      surface: "instagram",
      eventType: "analytics_pull",
      model: modelConfig.agent.modelId,
      provider: "composio",
      prompt: "Pull live Instagram analytics from Composio and render the OpenUI artifact.",
      response:
        "Profile @homenshum is a MEDIA_CREATOR with 1,308 followers. The strongest recent reel produced 1,255 views and 546 reach.",
      artifactType: "InstagramAnalyticsArtifact",
      qualityLabel: "analytics",
      action: "openui_artifact_preview",
      mocked: false,
      live: true,
      metadata: { followers: 1308, topViews: 1255, topReach: 546 },
      ts: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    }),
    normalizeEvent({
      eventId: "seed-remix-prompt",
      sessionId: "seed-demo",
      surface: "remix",
      eventType: "chat_turn",
      model: modelConfig.agent.modelId,
      provider: modelConfig.agent.provider,
      prompt:
        "Remix this imported video source: https://www.tiktok.com/@visual/video/123. Transcribe the hook and generate an image prompt.",
      response:
        "A locked character leans into laptop light in a late-night hackathon room. Keep the flame cap, silver chain, teal-amber grade, and breakthrough expression.",
      artifactType: "RemixPromptArtifact",
      qualityLabel: "image_prompt",
      action: "generate_image_prompt",
      mocked: false,
      live: true,
      metadata: { sourcePlatform: "tiktok", promptScore: 91 },
      ts: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
    }),
  ];
}
