import { z } from "zod";

/**
 * THE SCHEMA CONTRACT (see CLAUDE.md) — A owns this file.
 *
 * FREEZES at minute 20. Changing it after that breaks three people at once —
 * if it truly must change, announce in chat first.
 *
 * Everyone builds against `mockDraft` (lib/mock.ts) until their real upstream lands.
 */

export const shotSchema = z.object({
  id: z.string().describe('stable id: "shot_1", "shot_2", ...'),
  order: z.number().int().min(1),
  duration_s: z
    .number()
    .min(2)
    .max(6)
    .describe("seconds for this shot — total across ALL shots must stay ≤ 15"),
  script: z.string().describe("voiceover / spoken line for this shot"),
  image_prompt: z
    .string()
    .describe(
      "self-contained prompt for a text-to-image model: subject, setting, lighting, style"
    ),
  video_prompt: z
    .string()
    .describe(
      "motion-focused prompt for a video model: camera move, action, energy"
    ),
  on_screen_text: z
    .string()
    .nullable()
    .describe("short overlay text, or null when this shot needs none"),
});

/** What the LLM generates — meta is stamped server-side, never by the model. */
export const draftContentSchema = z.object({
  title: z.string().describe("ad concept name"),
  hook: z.string().describe("first 1–2s line; must grab instantly"),
  cta: z.string().describe("closing call-to-action"),
  pacing: z.enum(["fast", "medium", "slow"]),
  shots: z.array(shotSchema).min(3).max(5),
});

export const draftSchema = draftContentSchema.extend({
  meta: z.object({
    model: z
      .string()
      .describe("which model drafted this (base vs pioneer) — ClickHouse splits cost on this"),
    source: z.enum(["topic", "transcript", "url"]),
  }),
});

export type Shot = z.infer<typeof shotSchema>;
export type DraftContent = z.infer<typeof draftContentSchema>;
export type Draft = z.infer<typeof draftSchema>;
