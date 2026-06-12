import { generateObject, generateText } from "ai";
import { draftModel, BASE_MODEL, PIONEER_MODEL, isGatewayConfigured } from "@/lib/gateway/client";
import { draftContentSchema, type Draft, type DraftContent } from "@/lib/schema";
import { mockDraft } from "@/lib/mock";

/**
 * A's lane — topic/transcript → structured ad draft, through the gateway.
 *
 * Two paths:
 *  - base model  → generateObject (schema enforced per-request via tool/JSON mode)
 *  - tuned model → plain generateText + zod validate (+1 repair retry): the format
 *    lives in the trained weights, and Pioneer's endpoint has no structured-output
 *    mode. The shorter prompt is part of the cost story.
 */

const SYSTEM = `You are an ad creative director. Turn the input into ONE short-form video ad concept.
Rules:
- 3 to 5 shots. Total duration across all shots MUST be ≤ 15 seconds.
- The hook lands in the first shot; the last shot carries the CTA.
- Every shot needs a self-contained image_prompt (subject, setting, lighting, style)
  and a motion-focused video_prompt (camera move, action).
- on_screen_text: short and punchy, or null when the shot needs none.`;

// MUST byte-match SYSTEM in scripts/generate-training-data.mjs — the tuned model
// saw exactly this string during training. Change them together or not at all.
const SYSTEM_TUNED = `You draft short video ads. Reply with ONLY a JSON object: {"title","hook","cta","pacing":"fast|medium|slow","shots":[{"id","order","duration_s","script","image_prompt","video_prompt","on_screen_text"|null}]}. 3-5 shots, durations sum <= 15 seconds.`;

/** $ per 1M tokens as billed through the gateway — keyed by gateway model id. */
const PRICES: Record<string, { in: number; out: number }> = {
  [BASE_MODEL]: { in: 2.5, out: 10 }, // GPT-4o-class teacher
  ...(PIONEER_MODEL !== BASE_MODEL && { [PIONEER_MODEL]: { in: 0.2, out: 0.2 } }), // Qwen3-4B on Pioneer
};

function costUsd(model: string, inTok = 0, outTok = 0): number {
  const p = PRICES[model] ?? { in: 1, out: 3 }; // unknown id: rough default, never zero
  return (inTok * p.in + outTok * p.out) / 1_000_000;
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in model output");
  return JSON.parse(text.slice(start, end + 1));
}

export type DraftInput = {
  source: "topic" | "transcript" | "url";
  content: string;
  /** Gateway model id. Defaults to PIONEER_MODEL (falls back to base until trained). */
  model?: string;
  /** Force a path; by default the tuned model uses "trained-json", others "schema". */
  mode?: "schema" | "trained-json";
};

export type DraftResult = {
  draft: Draft;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
};

export async function generateDraft(input: DraftInput): Promise<DraftResult> {
  const model = input.model ?? PIONEER_MODEL;

  // Mock-first: the route works before anyone has keys. Loud, so misconfig can't hide.
  if (!isGatewayConfigured) {
    console.warn("[draft] TRUEFOUNDRY_* env missing — serving mockDraft");
    return {
      draft: { ...mockDraft, meta: { model: "mock-fallback", source: input.source } },
      cost_usd: 0,
      input_tokens: 0,
      output_tokens: 0,
    };
  }

  const mode =
    input.mode ?? (model === PIONEER_MODEL && PIONEER_MODEL !== BASE_MODEL ? "trained-json" : "schema");

  let content: DraftContent;
  let inTok = 0;
  let outTok = 0;

  if (mode === "schema") {
    const { object, usage } = await generateObject({
      model: draftModel(model),
      schema: draftContentSchema,
      system: SYSTEM,
      prompt: `Create the ad from this ${input.source}:\n\n${input.content}`,
    });
    content = object;
    inTok = usage.inputTokens ?? 0;
    outTok = usage.outputTokens ?? 0;
  } else {
    const first = await generateText({
      model: draftModel(model),
      system: SYSTEM_TUNED,
      prompt: input.content, // bare topic — matches the training distribution
    });
    inTok = first.usage.inputTokens ?? 0;
    outTok = first.usage.outputTokens ?? 0;
    try {
      content = draftContentSchema.parse(extractJson(first.text));
    } catch (err) {
      // One repair round-trip, then give up loudly.
      const repair = await generateText({
        model: draftModel(model),
        system: SYSTEM_TUNED,
        prompt: `${input.content}\n\nYour previous reply was invalid (${String(err).slice(0, 120)}). Reply again with ONLY the corrected JSON object.`,
      });
      inTok += repair.usage.inputTokens ?? 0;
      outTok += repair.usage.outputTokens ?? 0;
      content = draftContentSchema.parse(extractJson(repair.text));
    }
  }

  return {
    draft: { ...content, meta: { model, source: input.source } },
    cost_usd: costUsd(model, inTok, outTok),
    input_tokens: inTok,
    output_tokens: outTok,
  };
}
