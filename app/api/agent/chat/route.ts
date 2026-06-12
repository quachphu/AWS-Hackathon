import {
  currentResponsesApiSettings,
  fallbackRemixResponse,
  getAgentModel,
  getOpenAIApiKey,
  getOpenAIBaseUrl,
  transcriptFromMessages,
  type RemixAgentMessage,
} from "@/lib/openai/remix-agent";
import { runInstagramAnalyticsAgent } from "@/lib/openai/instagram-analytics-agent";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    messages?: Array<{ role?: string; content?: unknown }>;
  };
  const messages = normalizeMessages(body.messages);
  const input = transcriptFromMessages(messages);
  const apiKey = getOpenAIApiKey();
  const model = getAgentModel();

  if (isInstagramAnalyticsRequest(input)) {
    try {
      const analytics = await runInstagramAnalyticsAgent();
      return openAIResponsesTextStream(analytics.program);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Instagram analytics failed";
      return openAIResponsesTextStream(`${fallbackRemixResponse(input)}\n\nInstagram analytics note: ${detail}`);
    }
  }

  if (!apiKey) {
    return openAIResponsesTextStream(fallbackRemixResponse(input));
  }

  try {
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
      return openAIResponsesTextStream(`${fallbackRemixResponse(input)}\n\nOpenAI stream note: ${detail}`);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "text/event-stream",
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "stream failed";
    return openAIResponsesTextStream(`${fallbackRemixResponse(input)}\n\nOpenAI stream note: ${detail}`);
  }
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

function openAIResponsesTextStream(text: string) {
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
