import { createOpenAI } from "@ai-sdk/openai";

/**
 * A's lane — TrueFoundry gateway client.
 *
 * TrueFoundry sits IN FRONT of every model call (OpenAI-compatible base URL swap);
 * Pioneer is one of the models BEHIND it. They don't compete for a slot.
 *
 * Never import a provider SDK directly for drafting — all LLM traffic routes
 * through here so the gateway's cost/latency telemetry stays complete.
 */
export const gateway = createOpenAI({
  baseURL: process.env.TRUEFOUNDRY_GATEWAY_URL,
  apiKey: process.env.TRUEFOUNDRY_API_KEY,
});

/** Base model id as registered behind the gateway — one side of the cost comparison. */
export const BASE_MODEL = process.env.BASE_MODEL || "openai-main/gpt-4o-mini";

/** Tuned Pioneer model id behind the gateway — swap in via env once training finishes.
 *  `||` not `??`: an empty PIONEER_MODEL= line in .env.local must fall back to base. */
export const PIONEER_MODEL = process.env.PIONEER_MODEL || BASE_MODEL;

export const isGatewayConfigured = Boolean(
  process.env.TRUEFOUNDRY_GATEWAY_URL && process.env.TRUEFOUNDRY_API_KEY
);

/** Chat-completions surface — the OpenAI-compatible endpoint gateways expose. */
export function draftModel(modelId: string) {
  return gateway.chat(modelId);
}
