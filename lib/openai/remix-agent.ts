import { Agent, run, setDefaultOpenAIClient, setOpenAIAPI } from "@openai/agents";
import OpenAI from "openai";
import { harnessedAgentTools } from "@/lib/openai/harnessed-agent-tools";

export type RemixAgentMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type RemixAgentResult = {
  output: string;
  model: string;
  mocked: boolean;
  provider: "truefoundry" | "openai";
  agentApiMode: "chat_completions" | "responses";
};

const DEFAULT_AGENT_MODEL = "gpt-5.4-mini";

const REMIX_AGENT_INSTRUCTIONS = [
  "You are the Harnessed Agent for VisualLabs, a concise creative-production agent inside a hackathon demo UI.",
  "Given a remix request, respond like a VisualLabs agent that can refine prompts and operate the safe production harness.",
  "Use render_image only when the user asks to generate or render an image.",
  "Use submit_video when the user asks to queue a video render; report the returned jobId and use poll_video only when the user asks to check that job.",
  "Use prepare_publish_dry_run for publish/post requests unless the user explicitly asks for a live publish path. Live publishing is not available through this chat tool.",
  "Use export_training_dataset when the user asks for JSONL, fine-tuning, Fastino/Pioneer, training export, or self-improvement data.",
  "If the user asks to import a source video, explain that the Import page calls /api/ingest with Apify today; do not claim source import happened unless a future import tool exists.",
  "When a tool returns JSON, summarize the result with the important URL, jobId, status, or dataset count.",
  "For normal remix requests, return one practical response with a stronger image/video prompt, a short rationale, and explicit next action.",
  "Keep the answer under 180 words unless the user asks for more.",
].join("\n");

export function getOpenAIApiKey() {
  if (isTrueFoundryGatewayConfigured()) return process.env.TRUEFOUNDRY_API_KEY ?? "";
  return process.env.OPENAI_API_KEY ?? process.env.OPEN_AI_API ?? "";
}

export function getOpenAIBaseUrl() {
  if (isTrueFoundryGatewayConfigured()) {
    return process.env.TRUEFOUNDRY_GATEWAY_URL!.replace(/\/$/, "");
  }

  return (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
}

export function getAgentModel() {
  if (isTrueFoundryGatewayConfigured()) {
    return (
      process.env.TRUEFOUNDRY_AGENT_MODEL ??
      process.env.BASE_MODEL ??
      process.env.PIONEER_MODEL ??
      process.env.OPENAI_AGENT_MODEL ??
      DEFAULT_AGENT_MODEL
    );
  }

  return process.env.OPENAI_AGENT_MODEL ?? DEFAULT_AGENT_MODEL;
}

export function isTrueFoundryGatewayConfigured() {
  return Boolean(process.env.TRUEFOUNDRY_GATEWAY_URL && process.env.TRUEFOUNDRY_API_KEY);
}

export function getAgentProvider(): "truefoundry" | "openai" {
  return isTrueFoundryGatewayConfigured() ? "truefoundry" : "openai";
}

export function getAgentApiMode(): "chat_completions" | "responses" {
  const configured = process.env.OPENAI_AGENTS_API;
  if (configured === "chat_completions" || configured === "responses") return configured;
  return isTrueFoundryGatewayConfigured() ? "chat_completions" : "responses";
}

export function configureOpenAIAgentsSdk() {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) return false;

  setOpenAIAPI(getAgentApiMode());
  setDefaultOpenAIClient(
    new OpenAI({
      apiKey,
      baseURL: getOpenAIBaseUrl(),
    })
  );
  return true;
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
  const provider = getAgentProvider();
  const agentApiMode = getAgentApiMode();
  const configured = configureOpenAIAgentsSdk();
  const input = transcriptFromMessages(messages);

  if (!configured) {
    return {
      output: fallbackRemixResponse(input),
      model,
      mocked: true,
      provider,
      agentApiMode,
    };
  }

  try {
    const agent = new Agent({
      name: "VisualLabs Harnessed Agent",
      instructions: REMIX_AGENT_INSTRUCTIONS,
      model,
      modelSettings: currentAgentModelSettings(model),
      tools: harnessedAgentTools,
      toolUseBehavior: "run_llm_again",
    });
    const result = await run(agent, input, { maxTurns: 6 });

    return {
      output: String(result.finalOutput ?? fallbackRemixResponse(input)),
      model,
      mocked: false,
      provider,
      agentApiMode,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "agent run failed";
    return {
      output: `${fallbackRemixResponse(input)}\n\nLocal agent note: ${detail}`,
      model,
      mocked: true,
      provider,
      agentApiMode,
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
