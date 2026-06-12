"use client";

import type { Draft, Shot } from "@/lib/schema";

/**
 * C's lane — storyboard surface.
 *
 * This is the plain-React-cards version (the documented bail-out if OpenUI fights
 * back, per CLAUDE.md). C layers OpenUI on top / replaces internals. Everyone else
 * integrates via props — do not edit this in another lane.
 */

export type RenderState = {
  stills: Record<string, string>; // shot id → image url
  videoUrl: string | null;
  videoStatus: "idle" | "rendering" | "done";
};

export function Storyboard({
  draft,
  render,
  onRenderVideo,
}: {
  draft: Draft;
  render: RenderState;
  onRenderVideo: () => void;
}) {
  const totalSeconds = draft.shots.reduce((sum, s) => sum + s.duration_s, 0);

  return (
    <section className="w-full space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>model: {draft.meta.model}</Badge>
          <Badge>{draft.pacing} pacing</Badge>
          <Badge>{totalSeconds}s total</Badge>
          <Badge>source: {draft.meta.source}</Badge>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">{draft.title}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <LabeledInput label="Hook" defaultValue={draft.hook} />
          <LabeledInput label="CTA" defaultValue={draft.cta} />
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {draft.shots.map((shot) => (
          <ShotCard key={shot.id} shot={shot} still={render.stills[shot.id]} />
        ))}
      </div>

      <VideoSlot render={render} onRenderVideo={onRenderVideo} />
    </section>
  );
}

function ShotCard({ shot, still }: { shot: Shot; still?: string }) {
  return (
    <article className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
      <div className="relative aspect-video bg-neutral-900">
        {still ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={still} alt={shot.image_prompt} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-3 text-center">
            <p className="animate-pulse text-xs text-neutral-500">rendering still…</p>
          </div>
        )}
        {shot.on_screen_text && (
          <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6 text-sm font-semibold text-white">
            {shot.on_screen_text}
          </p>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span className="font-mono">{shot.id}</span>
          <span>{shot.duration_s}s</span>
        </div>
        <p className="text-sm text-neutral-200">{shot.script}</p>
      </div>
    </article>
  );
}

function VideoSlot({
  render,
  onRenderVideo,
}: {
  render: RenderState;
  onRenderVideo: () => void;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-200">Hero video</h3>
        <button
          onClick={onRenderVideo}
          disabled={render.videoStatus !== "idle"}
          className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-900 transition hover:bg-white disabled:opacity-40"
        >
          {render.videoStatus === "rendering" ? "Rendering…" : "Render video"}
        </button>
      </div>
      {render.videoUrl ? (
        <video src={render.videoUrl} controls className="aspect-video w-full rounded-lg bg-black" />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-neutral-800">
          <p className="max-w-md px-4 text-center text-xs leading-relaxed text-neutral-500">
            {render.videoStatus === "rendering"
              ? "Job fired — polling. On stage: kick this off at the START of the demo, reveal at the climax."
              : "Video renders async (minutes, fails often). Never render live-awaited on stage — keep D's pre-baked clip in your back pocket."}
          </p>
        </div>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-0.5 text-xs text-neutral-300">
      {children}
    </span>
  );
}

function LabeledInput({ label, defaultValue }: { label: string; defaultValue: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <input
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-neutral-600"
      />
    </label>
  );
}
