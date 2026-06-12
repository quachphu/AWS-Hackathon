import { Agent, run, setDefaultOpenAIKey } from "@openai/agents";

export type RemixAgentMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type RemixAgentResult = {
  output: string;
  model: string;
  mocked: boolean;
};

const DEFAULT_AGENT_MODEL = "gpt-5.4-mini";

const REMIX_AGENT_INSTRUCTIONS = [
  "You are Harness Remix Director, a concise creative agent for a hackathon demo UI.",
  "Given a remix request, respond like a VisualLabs remix chat assistant.",
  "Return one practical response with: a stronger image/video prompt, a short rationale, and explicit next action.",
  "Do not claim anything has been published or rendered. Composio TikTok publishing requires a separate explicit click.",
  "Keep the answer under 180 words unless the user asks for more.",
].join("\n");

export function getOpenAIApiKey() {
  return process.env.OPENAI_API_KEY ?? process.env.OPEN_AI_API ?? "";
}

export function getOpenAIBaseUrl() {
  return (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
}

export function getAgentModel() {
  return process.env.OPENAI_AGENT_MODEL ?? DEFAULT_AGENT_MODEL;
}

export function currentAgentModelSettings(model = getAgentModel()) {
  if (!model.startsWith("gpt-5")) {
    return { maxTokens: 700, store: false };
  }

  return {
    maxTokens: 700,
    store: false,
    reasoning: { effort: "none" as const },
    text: { verbosity: "medium" as const },
  };
}

export function currentResponsesApiSettings(model = getAgentModel()) {
  const settings = currentAgentModelSettings(model);
  const { maxTokens, ...rest } = settings;

  return {
    ...rest,
    max_output_tokens: maxTokens,
  };
}

export async function runRemixAgent(messages: RemixAgentMessage[]): Promise<RemixAgentResult> {
  const model = getAgentModel();
  const apiKey = getOpenAIApiKey();
  const input = transcriptFromMessages(messages);

  if (!apiKey) {
    return {
      output: fallbackRemixResponse(input),
      model,
      mocked: true,
    };
  }

  try {
    setDefaultOpenAIKey(apiKey);
    const agent = new Agent({
      name: "Harness Remix Director",
      instructions: REMIX_AGENT_INSTRUCTIONS,
      model,
      modelSettings: currentAgentModelSettings(model),
    });
    const result = await run(agent, input, { maxTurns: 2 });

    return {
      output: String(result.finalOutput ?? fallbackRemixResponse(input)),
      model,
      mocked: false,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "agent run failed";
    return {
      output: `${fallbackRemixResponse(input)}\n\nLocal agent note: ${detail}`,
      model,
      mocked: true,
    };
  }
}

export function transcriptFromMessages(messages: RemixAgentMessage[]) {
  const cleaned = messages
    .filter((message) => message.content.trim())
    .slice(-8)
    .map((message) => `${message.role.toUpperCase()}: ${message.content.trim()}`)
    .join("\n\n");

  return cleaned || "USER: Improve this remix for a TikTok-first hackathon demo.";
}

export function fallbackRemixResponse(input: string) {
  const seed = input.length > 20 ? input.slice(-220) : input;

  return [
    "Tighten the remix around one visual beat: a locked character hitting a late-night breakthrough at the laptop.",
    "",
    `Prompt pass: ${seed}`,
    "",
    "Next action: generate the image first, inspect the character consistency, then queue video only after the prompt lands.",
  ].join("\n");
}
