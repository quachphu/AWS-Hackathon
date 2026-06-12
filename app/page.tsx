import { OpenUIStudio } from "@/components/openui/OpenUIStudio";

import { useState } from "react";
import type { Draft } from "@/lib/schema";
import { Storyboard, type RenderState, type PublishState } from "@/components/Storyboard";

/**
 * C's lane — others integrate INTO this via components, not by editing it (CONTRIBUTION.md).
 *
 * The whole demo flow already runs here on mocks: topic → /api/draft → storyboard →
 * /api/render stills → async video. Lanes swap their real internals in behind the
 * same calls.
 */
export default function Home() {
  const [topic, setTopic] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [render, setRender] = useState<RenderState>({
    stills: {},
    videoUrl: null,
    videoStatus: "idle",
  });
  const [error, setError] = useState<string | null>(null);
  const [publishState, setPublishState] = useState<PublishState>({ status: "idle" });

  async function handleDraft() {
    if (!topic.trim() || drafting) return;
    setDrafting(true);
    setError(null);
    setDraft(null);
    setRender({ stills: {}, videoUrl: null, videoStatus: "idle" });
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "topic", content: topic }),
      });
      if (!res.ok) throw new Error(`draft failed (${res.status})`);
      const d: Draft = await res.json();
      setDraft(d);
      void renderStills(d); // images generate "live into the shot cards"
    } catch (e) {
      setError(e instanceof Error ? e.message : "draft failed");
    } finally {
      setDrafting(false);
    }
  }

  async function renderStills(d: Draft) {
    await Promise.all(
      d.shots.map(async (shot) => {
        const res = await fetch("/api/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "image", shotId: shot.id, prompt: shot.image_prompt }),
        });
        if (!res.ok) return;
        const { url } = await res.json();
        setRender((r) => ({ ...r, stills: { ...r.stills, [shot.id]: url } }));
      })
    );
  }

  async function handlePublish(targets: ("tiktok" | "instagram")[]) {
    if (!draft || publishState.status === "publishing") return;
    setPublishState({ status: "publishing" });
    try {
      const firstStill = render.stills[draft.shots[0]?.id] ?? null;
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          hook: draft.hook,
          cta: draft.cta,
          videoUrl: render.videoUrl,
          imageUrl: firstStill,
          targets,
        }),
      });
      const data = await res.json();
      setPublishState({
        status: data.ok ? "done" : "error",
        detail: data.detail ?? data.error,
      });
    } catch (e) {
      setPublishState({ status: "error", detail: (e as Error).message });
    }
  }

  async function handleRenderVideo() {
    if (!draft || render.videoStatus !== "idle") return;
    const hero = draft.shots[0];
    setRender((r) => ({ ...r, videoStatus: "rendering" }));
    const res = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "video", shotId: hero.id, prompt: hero.video_prompt }),
    });
    if (!res.ok) {
      setRender((r) => ({ ...r, videoStatus: "idle" }));
      return;
    }
    const { jobId } = await res.json();
    const poll = setInterval(async () => {
      const status = await fetch(`/api/render?jobId=${jobId}`).then((r) => r.json());
      if (status.status === "done") {
        clearInterval(poll);
        setRender((r) => ({ ...r, videoUrl: status.url, videoStatus: "done" }));
      } else if (status.status === "failed") {
        clearInterval(poll);
        setRender((r) => ({ ...r, videoStatus: "idle" }));
      }
    }, 2000);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Ad Factory</h1>
        <p className="max-w-2xl text-sm text-neutral-400">
          Topic → structured draft → stills → video → published. One governed pipeline,
          instrumented for cost the whole way.
        </p>
      </header>

      <div className="flex gap-2">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleDraft()}
          placeholder="What's the ad about? (e.g. a cold brew brand for people who hate the 2pm crash)"
          className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 outline-none transition focus:border-neutral-600"
        />
        <button
          onClick={handleDraft}
          disabled={drafting || !topic.trim()}
          className="rounded-xl bg-neutral-100 px-5 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-white disabled:opacity-40"
        >
          {drafting ? "Drafting…" : "Draft ad"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {draft ? (
        <Storyboard
          draft={draft}
          render={render}
          onRenderVideo={handleRenderVideo}
          publishState={publishState}
          onPublish={handlePublish}
        />
      ) : (
        <p className="text-sm text-neutral-600">
          {drafting ? "Drafting through the gateway…" : "No draft yet — enter a topic above."}
        </p>
      )}
    </main>
  );
}
