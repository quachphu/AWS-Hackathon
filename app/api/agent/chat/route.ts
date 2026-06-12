import {
  currentResponsesApiSettings,
  fallbackRemixResponse,
  getAgentApiMode,
  getAgentModel,
  getAgentProvider,
  getOpenAIApiKey,
  getOpenAIBaseUrl,
  runRemixAgent,
  transcriptFromMessages,
  type RemixAgentMessage,
} from "@/lib/openai/remix-agent";
import { runInstagramAnalyticsAgent } from "@/lib/openai/instagram-analytics-agent";
import { latestUserPrompt, recordChatHistoryEvent } from "@/lib/analytics/chat-history";
import { runTrainingPipelineAgent } from "@/lib/openai/training-pipeline-agent";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    messages?: Array<{ role?: string; content?: unknown }>;
  };
  const messages = normalizeMessages(body.messages);
  const input = transcriptFromMessages(messages);
  const apiKey = getOpenAIApiKey();
  const model = getAgentModel();
  const provider = getAgentProvider();
  const prompt = latestUserPrompt(messages);

  if (isTrainingPipelineRequest(input)) {
    try {
      const pipeline = await runTrainingPipelineAgent();
      await recordChatHistoryEvent({
        sessionId: "openui-agent-demo",
        surface: "agent",
        eventType: "analytics_pull",
        role: "assistant",
        model: pipeline.model,
        provider,
        prompt,
        response: pipeline.summary,
        artifactType: "TrainingPipelineArtifact",
        artifactProgram: pipeline.program,
        qualityLabel: "training_pipeline",
        action: "render_training_pipeline_openui",
        mocked: pipeline.mocked || pipeline.clickhouseMode !== "clickhouse",
        live: pipeline.clickhouseMode === "clickhouse",
        metadata: {
          eventCount: pipeline.eventCount,
          recordCount: pipeline.recordCount,
          jobId: pipeline.job.jobId,
          pipeline: pipeline.job.pipeline,
        },
      });
      return openAIResponsesTextStream(pipeline.program);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "training pipeline failed";
      const text = `${fallbackRemixResponse(input)}\n\nTraining pipeline note: ${detail}`;
      return openAIResponsesTextStream(text, () =>
        recordChatHistoryEvent({
          sessionId: "openui-agent-demo",
          surface: "agent",
          eventType: "chat_turn",
          role: "assistant",
          model,
          provider,
          prompt,
          response: text,
          qualityLabel: "training_pipeline_error",
          action: "training_pipeline_error",
          mocked: true,
          live: false,
        })
      );
    }
  }

  if (isInstagramAnalyticsRequest(input)) {
    try {
      const analytics = await runInstagramAnalyticsAgent();
      await recordChatHistoryEvent({
        sessionId: "openui-agent-demo",
        surface: "agent",
        eventType: "analytics_pull",
        role: "assistant",
        model: analytics.model,
        provider: analytics.provider,
        prompt,
        response: analytics.summary,
        artifactType: "InstagramAnalyticsArtifact",
        artifactProgram: analytics.program,
        qualityLabel: "instagram_analytics",
        action: "render_instagram_openui",
        mocked: analytics.mocked || !analytics.live,
        live: analytics.live,
        metadata: {
          source: analytics.snapshot.source,
          agentApiMode: analytics.agentApiMode,
          toolCalled: analytics.toolCalled,
          username: analytics.snapshot.profile.username,
          posts: analytics.snapshot.posts.length,
        },
      });
      return openAIResponsesTextStream(analytics.program);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Instagram analytics failed";
      const text = `${fallbackRemixResponse(input)}\n\nInstagram analytics note: ${detail}`;
      return openAIResponsesTextStream(text, () =>
        recordChatHistoryEvent({
          sessionId: "openui-agent-demo",
          surface: "agent",
          eventType: "chat_turn",
          role: "assistant",
          model,
          provider,
          prompt,
          response: text,
          qualityLabel: "instagram_analytics_error",
          action: "instagram_analytics_error",
          mocked: true,
          live: false,
        })
      );
    }
  }

  if (!apiKey) {
    const text = fallbackRemixResponse(input);
    return openAIResponsesTextStream(text, () =>
      recordChatHistoryEvent({
        sessionId: "openui-agent-demo",
        surface: "agent",
        eventType: "chat_turn",
        role: "assistant",
        model,
        provider,
        prompt,
        response: text,
        artifactType: "RemixPromptArtifact",
        qualityLabel: "image_prompt",
        action: "agent_chat_fallback",
        mocked: true,
        live: false,
      })
    );
  }

  try {
    if (getAgentApiMode() === "chat_completions") {
      const result = await runRemixAgent(messages);
      return openAIResponsesTextStream(result.output, () =>
        recordChatHistoryEvent({
          sessionId: "openui-agent-demo",
          surface: "agent",
          eventType: "chat_turn",
          role: "assistant",
          model: result.model,
          provider: result.provider,
          prompt,
          response: result.output,
          artifactType: "RemixPromptArtifact",
          qualityLabel: "image_prompt",
          action: "agent_chat_agents_sdk",
          mocked: result.mocked,
          live: !result.mocked,
          metadata: {
            agentApiMode: result.agentApiMode,
          },
        })
      );
    }

    const upstream = await fetch(`${getOpenAIBaseUrl()}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: [
          "You are Harness Remix Director inside an OpenUI fullscreen chat.",
          "Help improve TikTok-first remix prompts and return concise production guidance.",
          "When useful, emit compact OpenUI-friendly language and mention artifact-worthy prompt details.",
          "Do not claim render or publish completion.",
        ].join("\n"),
        input,
        stream: true,
        ...currentResponsesApiSettings(model),
      }),
      signal: req.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => upstream.statusText);
      const text = `${fallbackRemixResponse(input)}\n\nOpenAI stream note: ${detail}`;
      return openAIResponsesTextStream(text, () =>
        recordChatHistoryEvent({
          sessionId: "openui-agent-demo",
          surface: "agent",
          eventType: "chat_turn",
          role: "assistant",
          model,
          provider,
          prompt,
          response: text,
          artifactType: "RemixPromptArtifact",
          qualityLabel: "image_prompt",
          action: "agent_chat_openai_error",
          mocked: true,
          live: false,
        })
      );
    }

    return new Response(streamWithHistory(upstream.body, (response) =>
      recordChatHistoryEvent({
        sessionId: "openui-agent-demo",
        surface: "agent",
        eventType: "chat_turn",
        role: "assistant",
        model,
        provider,
        prompt,
        response,
        artifactType: "RemixPromptArtifact",
        qualityLabel: "image_prompt",
        action: "agent_chat_response",
        mocked: false,
        live: true,
      })
    ), {
      status: upstream.status,
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "text/event-stream",
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "stream failed";
    const text = `${fallbackRemixResponse(input)}\n\nOpenAI stream note: ${detail}`;
    return openAIResponsesTextStream(text, () =>
      recordChatHistoryEvent({
        sessionId: "openui-agent-demo",
        surface: "agent",
        eventType: "chat_turn",
        role: "assistant",
        model,
        provider,
        prompt,
        response: text,
        artifactType: "RemixPromptArtifact",
        qualityLabel: "image_prompt",
        action: "agent_chat_exception",
        mocked: true,
        live: false,
      })
    );
  }
}

function isTrainingPipelineRequest(input: string) {
  const normalized = input.toLowerCase();
  return (
    (normalized.includes("clickhouse") ||
      normalized.includes("fastino") ||
      normalized.includes("pioneer") ||
      normalized.includes("fine-tun") ||
      normalized.includes("jsonl") ||
      normalized.includes("training")) &&
    (normalized.includes("chat") ||
      normalized.includes("history") ||
      normalized.includes("prompt") ||
      normalized.includes("analytics") ||
      normalized.includes("dataset"))
  );
}

function isInstagramAnalyticsRequest(input: string) {
  const normalized = input.toLowerCase();
  return (
    normalized.includes("instagram") &&
    (normalized.includes("analytics") ||
      normalized.includes("insight") ||
      normalized.includes("composio") ||
      normalized.includes("profile"))
  );
}

function normalizeMessages(messages: Array<{ role?: string; content?: unknown }> | undefined): RemixAgentMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .map((message) => {
      const role: RemixAgentMessage["role"] =
        message.role === "system" || message.role === "assistant" || message.role === "user"
          ? message.role
          : "user";

      return {
        role,
        content: contentToText(message.content),
      };
    })
    .filter((message) => message.content.trim());
}

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function openAIResponsesTextStream(text: string, onComplete?: (text: string) => void | Promise<unknown>) {
  const encoder = new TextEncoder();
  const itemId = `msg_${crypto.randomUUID()}`;
  const chunks = chunkText(text, 96);

  return new Response(
    new ReadableStream({
      start(controller) {
        enqueueResponseEvent(controller, encoder, {
          type: "response.output_item.added",
          item: { id: itemId, type: "message", role: "assistant" },
        });

        for (const chunk of chunks) {
          enqueueResponseEvent(controller, encoder, {
            type: "response.output_text.delta",
            item_id: itemId,
            delta: chunk,
          });
        }

        enqueueResponseEvent(controller, encoder, {
          type: "response.output_text.done",
          item_id: itemId,
        });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        if (onComplete) void onComplete(text);
      },
    }),
    {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "text/event-stream",
      },
    }
  );
}

function streamWithHistory(body: ReadableStream<Uint8Array>, onComplete: (text: string) => void | Promise<unknown>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let captured = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        if (buffer) captured += parseResponseTextFromSse(buffer);
        controller.close();
        void onComplete(captured);
        return;
      }

      controller.enqueue(value);
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        captured += parseResponseTextFromSse(block);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

function parseResponseTextFromSse(block: string) {
  const dataLine = block
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice(6)
    .trim();

  if (!dataLine || dataLine === "[DONE]") return "";

  try {
    const event = JSON.parse(dataLine) as { type?: string; delta?: unknown };
    return event.type === "response.output_text.delta" && typeof event.delta === "string" ? event.delta : "";
  } catch {
    return "";
  }
}

function enqueueResponseEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: Record<string, unknown>
) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

function chunkText(text: string, size: number) {
  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }

  return chunks.length > 0 ? chunks : [""];
}
