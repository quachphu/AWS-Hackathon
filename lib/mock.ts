import type { Draft } from "@/lib/schema";

/**
 * THE mock everyone builds against until their real upstream lands (CONTRIBUTION.md).
 * If you find yourself blocked waiting on someone, you skipped the mock — import this.
 */
export const mockDraft: Draft = {
  title: "Aurora Cold Brew — Smooth Energy",
  hook: "Still drinking yesterday's coffee?",
  cta: "Aurora Cold Brew. Find your smooth.",
  pacing: "fast",
  shots: [
    {
      id: "shot_1",
      order: 1,
      duration_s: 3,
      script: "7am. The alarm wins again. Yesterday's coffee stares back, cold and defeated.",
      image_prompt:
        "dim early-morning kitchen, a sad half-empty mug of stale coffee on the counter, harsh alarm-clock glow, cinematic moody lighting, shallow depth of field",
      video_prompt:
        "slow push-in on a stale mug of coffee in a dim kitchen as cold morning light creeps across the counter, cinematic",
      on_screen_text: "7:00 AM. Again.",
    },
    {
      id: "shot_2",
      order: 2,
      duration_s: 4,
      script: "There's a better way to wake up. Cold-brewed for 18 hours, never bitter.",
      image_prompt:
        "glass bottle of cold brew coffee with condensation on a sunlit marble counter, deep amber liquid, soft window light, premium product photography",
      video_prompt:
        "condensation drips down a chilled cold brew bottle as sunlight flares through the glass, slow orbiting camera",
      on_screen_text: "18-hour cold brew",
    },
    {
      id: "shot_3",
      order: 3,
      duration_s: 4,
      script: "Smooth energy that carries you through the 2pm wall — no crash, no jitters.",
      image_prompt:
        "confident person mid-stride through a bright modern office holding an iced coffee, golden hour glow through tall windows, editorial style",
      video_prompt:
        "tracking shot following a person striding through a bright office holding an iced cold brew, smooth energetic camera motion",
      on_screen_text: "No crash. No jitters.",
    },
    {
      id: "shot_4",
      order: 4,
      duration_s: 3,
      script: "Aurora Cold Brew. Find your smooth.",
      image_prompt:
        "hero shot of a cold brew bottle on a pedestal, aurora-colored gradient backdrop, studio lighting, minimal premium ad style",
      video_prompt:
        "slow heroic dolly-in on a bottle on a pedestal as aurora-colored light sweeps across the backdrop",
      on_screen_text: "Find your smooth.",
    },
  ],
  meta: { model: "mock", source: "topic" },
};

/** Placeholder stills keyed by shot id — what mock /api/render serves until B's wrappers land. */
export const mockStills: Record<string, string> = Object.fromEntries(
  mockDraft.shots.map((s) => [s.id, `https://picsum.photos/seed/${s.id}/768/432`])
);

/** Stand-in clip until B's Fal wrapper / D's pre-baked fallback lands. */
export const mockVideoUrl = "https://www.w3schools.com/html/mov_bbb.mp4";
