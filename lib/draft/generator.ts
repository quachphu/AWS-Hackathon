import { generateObject } from "ai";
import { draftModel, PIONEER_MODEL, isGatewayConfigured } from "@/lib/gateway/client";
import { MOCK_FALLBACK_MODEL } from "@/lib/gateway/models";
import { draftContentSchema, type Draft } from "@/lib/schema";
import { mockDraft } from "@/lib/mock";

/**
 * A's lane — topic/transcript → structured ad draft, through the gateway.
 */

const SYSTEM = `You are an ad creative director. Turn the input into ONE short-form video ad concept.
Rules:
- 3 to 5 shots. Total duration across all shots MUST be ≤ 15 seconds.
- The hook lands in the first shot; the last shot carries the CTA.
- Every shot needs a self-contained image_prompt (subject, setting, lighting, style)
  and a motion-focused video_prompt (camera move, action).
- on_screen_text: short and punchy, or null when the shot needs none.`;

export type DraftInput = {
  source: "topic" | "transcript" | "url";
  content: string;
  /** Gateway model id. Defaults to PIONEER_MODEL (which falls back to base until trained). */
  model?: string;
};

export async function generateDraft(input: DraftInput): Promise<Draft> {
  const model = input.model ?? PIONEER_MODEL;

  // Mock-first: the route works before anyone has keys. Loud, so misconfig can't hide.
  if (!isGatewayConfigured) {
    console.warn("[draft] TRUEFOUNDRY_* env missing — serving mockDraft");
    return { ...mockDraft, meta: { model: MOCK_FALLBACK_MODEL, source: input.source } };
  }

  const { object } = await generateObject({
    model: draftModel(model),
    schema: draftContentSchema,
    system: SYSTEM,
    prompt: `Create the ad from this ${input.source}:\n\n${input.content}`,
  });

  return { ...object, meta: { model, source: input.source } };
}
