"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createLibrary, defineComponent } from "@openuidev/react-lang";
import { z } from "zod";
import type { Draft } from "@/lib/schema";
import type { DraftModelConfig, DraftModelOption } from "@/lib/gateway/models";

export const DraftModelConfigContext = createContext<DraftModelConfig | null>(null);

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  body: string;
  modelId: string;
};

type DraftTrace = {
  id: string;
  source: string;
  requestedModel: string;
  responseModel?: string;
  status: "pending" | "done" | "error";
  latencyMs?: number;
  detail?: string;
};

const navItemSchema = z.object({
  label: z.string(),
  section: z.string(),
  active: z.boolean().optional(),
  detail: z.string().optional(),
});

const shotSchema = z.object({
  id: z.string(),
  duration: z.number(),
  script: z.string(),
  imagePrompt: z.string(),
  videoPrompt: z.string(),
  text: z.string().nullable().optional(),
});

const metricSchema = z.object({
  label: z.string(),
  value: z.string(),
  detail: z.string(),
  tone: z.enum(["good", "warn", "neutral", "bad"]),
});

const barSchema = z.object({
  label: z.string(),
  value: z.number(),
});

const requirementSchema = z.object({
  label: z.string(),
  status: z.enum(["pass", "mock", "fail", "unknown"]),
  evidence: z.string(),
});

const pipelineStepSchema = z.object({
  label: z.string(),
  detail: z.string(),
  state: z.string(),
});

const AppFrame = defineComponent({
  name: "AppFrame",
  description: "Full desktop demo shell with navigation and OpenUI-rendered children.",
  props: z.object({
    product: z.string(),
    subtitle: z.string(),
    nav: z.array(navItemSchema),
    children: z.array(z.any()),
  }),
  component: ({ props, renderNode }) => (
    <div className="min-h-screen bg-[#f6f1eb] text-[#221914]">
      <div className="grid min-h-screen grid-cols-[236px_minmax(0,1fr)]">
        <aside className="flex min-h-screen flex-col border-r border-[#ddd4c9] bg-[#eee7df] px-4 py-5">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6a47]">
              Harness
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">{props.product}</h1>
          </div>
          <nav className="space-y-1.5">
            {props.nav.map((item) => (
              <div
                key={item.section}
                className={[
                  "rounded-lg px-3 py-2 text-sm transition",
                  item.active
                    ? "bg-[#221914] text-white"
                    : "text-[#6f6258] hover:bg-white/70 hover:text-[#221914]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{item.label}</span>
                  {item.active ? <span className="h-1.5 w-1.5 rounded-full bg-[#e29152]" /> : null}
                </div>
                {item.detail ? (
                  <p className={item.active ? "mt-0.5 text-xs text-white/60" : "mt-0.5 text-xs text-[#9c9187]"}>
                    {item.detail}
                  </p>
                ) : null}
              </div>
            ))}
          </nav>
          <div className="mt-auto rounded-lg border border-[#ddd4c9] bg-white/55 p-3 text-xs text-[#6f6258]">
            <p className="font-medium text-[#221914]">Demo identity</p>
            <p className="mt-1">One hardcoded project. Composio owns TikTok OAuth. ClickHouse stays append-only.</p>
          </div>
        </aside>
        <main className="min-w-0 px-6 py-5">
          <div className="mb-4 flex items-center justify-between rounded-lg border border-[#ddd4c9] bg-white/70 px-4 py-3">
            <p className="max-w-3xl text-sm text-[#6f6258]">{props.subtitle}</p>
            <span className="rounded-full border border-[#e1c6ad] bg-[#fff6ee] px-3 py-1 text-xs font-medium text-[#9a582c]">
              OpenUI renderer
            </span>
          </div>
          <div className="space-y-5">{props.children.map((child, index) => <div key={index}>{renderNode(child)}</div>)}</div>
        </main>
      </div>
    </div>
  ),
});

const SectionHeader = defineComponent({
  name: "SectionHeader",
  description: "Demo section title with chips and explanatory body copy.",
  props: z.object({
    eyebrow: z.string(),
    title: z.string(),
    body: z.string(),
    chips: z.array(z.string()),
  }),
  component: ({ props }) => (
    <section className="rounded-lg border border-[#ddd4c9] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b76735]">{props.eyebrow}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">{props.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6f6258]">{props.body}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {props.chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-[#e5d8ca] bg-[#fbf8f4] px-3 py-1 text-xs font-medium text-[#7b6f65]"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    </section>
  ),
});

const CreatorWorkspace = defineComponent({
  name: "CreatorWorkspace",
  description: "Interactive creator surface that drafts against the existing API and renders stills/video.",
  props: z.object({
    title: z.string(),
    sourceLabel: z.string(),
    defaultTopic: z.string(),
    hook: z.string(),
    cta: z.string(),
    model: z.string(),
    mediaUrl: z.string(),
    shots: z.array(shotSchema),
  }),
  component: CreatorWorkspaceComponent,
});

function CreatorWorkspaceComponent({
  props,
}: {
  props: {
    title: string;
    sourceLabel: string;
    defaultTopic: string;
    hook: string;
    cta: string;
    model: string;
    mediaUrl: string;
    shots: z.infer<typeof shotSchema>[];
  };
}) {
  const modelConfig = useContext(DraftModelConfigContext);
  const initialRequestModel = modelConfig?.defaultModelId ?? props.model;
  const initialResponseModel = modelConfig
    ? modelConfig.gatewayConfigured
      ? initialRequestModel
      : modelConfig.fallbackModelId
    : props.model;
  const initialDraft: Draft = {
    title: props.title,
    hook: props.hook,
    cta: props.cta,
    pacing: "fast",
    shots: props.shots.map((shot, index) => ({
      id: shot.id,
      order: index + 1,
      duration_s: shot.duration,
      script: shot.script,
      image_prompt: shot.imagePrompt,
      video_prompt: shot.videoPrompt,
      on_screen_text: shot.text ?? null,
    })),
    meta: { model: initialResponseModel, source: "topic" },
  };

  const [topic, setTopic] = useState(props.defaultTopic);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [selectedModel, setSelectedModel] = useState(initialRequestModel);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    {
      id: "initial-user",
      role: "user",
      body: props.defaultTopic,
      modelId: initialRequestModel,
    },
    {
      id: "initial-assistant",
      role: "assistant",
      body: `${props.hook} ${props.cta}`,
      modelId: initialResponseModel,
    },
  ]);
  const [traces, setTraces] = useState<DraftTrace[]>(() => [
    {
      id: "initial",
      source: "topic",
      requestedModel: initialRequestModel,
      responseModel: initialResponseModel,
      status: "done",
      detail: "stored default",
    },
  ]);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stills, setStills] = useState<Record<string, string>>({});
  const [videoStatus, setVideoStatus] = useState<"idle" | "rendering" | "done">("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [publishState, setPublishState] = useState<{
    status: "idle" | "publishing" | "done" | "error";
    detail?: string;
  }>({ status: "idle" });
  const videoPollRef = useRef<number | null>(null);
  const submittedDraftRef = useRef(false);

  useEffect(() => {
    return () => {
      if (videoPollRef.current !== null) {
        window.clearInterval(videoPollRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!modelConfig || submittedDraftRef.current) return;

    const responseModel = modelConfig.gatewayConfigured
      ? modelConfig.defaultModelId
      : modelConfig.fallbackModelId;

    setSelectedModel(modelConfig.defaultModelId);
    setDraft((current) => ({ ...current, meta: { ...current.meta, model: responseModel } }));
    setChatMessages((current) =>
      current.map((message) =>
        message.id === "initial-user"
          ? { ...message, modelId: modelConfig.defaultModelId }
          : message.id === "initial-assistant"
            ? { ...message, modelId: responseModel }
            : message
      )
    );
    setTraces((current) =>
      current.map((trace) =>
        trace.id === "initial"
          ? {
              ...trace,
              requestedModel: modelConfig.defaultModelId,
              responseModel,
            }
          : trace
      )
    );
  }, [modelConfig]);

  async function handleDraft() {
    if (!topic.trim() || drafting) return;
    const requestedModel = selectedModel || modelConfig?.defaultModelId || props.model;
    const traceId = `draft-${Date.now()}`;
    const startedAt = performance.now();

    submittedDraftRef.current = true;
    setDrafting(true);
    setError(null);
    setStills({});
    setVideoUrl(null);
    setVideoStatus("idle");
    setPublishState({ status: "idle" });
    if (videoPollRef.current !== null) {
      window.clearInterval(videoPollRef.current);
      videoPollRef.current = null;
    }
    setChatMessages((current) =>
      [
        ...current,
        {
          id: `${traceId}-user`,
          role: "user" as const,
          body: topic,
          modelId: requestedModel,
        },
      ].slice(-6)
    );
    setTraces((current) =>
      [
        {
          id: traceId,
          source: "topic",
          requestedModel,
          status: "pending" as const,
          detail: "/api/draft",
        },
        ...current,
      ].slice(0, 6)
    );

    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "topic", content: topic, model: requestedModel }),
      });
      if (!res.ok) throw new Error(`draft failed (${res.status})`);
      const nextDraft = (await res.json()) as Draft;
      setDraft(nextDraft);
      setChatMessages((current) =>
        [
          ...current,
          {
            id: `${traceId}-assistant`,
            role: "assistant" as const,
            body: `${nextDraft.hook} ${nextDraft.cta}`,
            modelId: nextDraft.meta.model,
          },
        ].slice(-6)
      );
      setTraces((current) =>
        current.map((trace) =>
          trace.id === traceId
            ? {
                ...trace,
                responseModel: nextDraft.meta.model,
                status: "done",
                latencyMs: Math.round(performance.now() - startedAt),
              }
            : trace
        )
      );
      void renderStills(nextDraft);
    } catch (e) {
      const message = e instanceof Error ? e.message : "draft failed";
      setError(message);
      setTraces((current) =>
        current.map((trace) =>
          trace.id === traceId
            ? {
                ...trace,
                status: "error",
                latencyMs: Math.round(performance.now() - startedAt),
                detail: message,
              }
            : trace
        )
      );
    } finally {
      setDrafting(false);
    }
  }

  async function renderStills(nextDraft: Draft) {
    await Promise.all(
      nextDraft.shots.map(async (shot) => {
        const res = await fetch("/api/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "image", shotId: shot.id, prompt: shot.image_prompt }),
        });
        if (!res.ok) return;
        const { url } = (await res.json()) as { url: string };
        setStills((current) => ({ ...current, [shot.id]: url }));
      })
    );
  }

  async function handleRenderVideo() {
    if (videoStatus !== "idle") return;
    const hero = draft.shots[0];
    if (!hero) return;

    if (videoPollRef.current !== null) {
      window.clearInterval(videoPollRef.current);
      videoPollRef.current = null;
    }

    setVideoStatus("rendering");
    const res = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "video", shotId: hero.id, prompt: hero.video_prompt }),
    });
    if (!res.ok) {
      setVideoStatus("idle");
      return;
    }

    const { jobId } = (await res.json()) as { jobId: string };
    const poll = window.setInterval(async () => {
      const status = (await fetch(`/api/render?jobId=${jobId}`).then((r) => r.json())) as {
        status: "pending" | "done" | "failed";
        url?: string;
      };
      if (status.status === "done") {
        window.clearInterval(poll);
        videoPollRef.current = null;
        setVideoUrl(status.url ?? null);
        setVideoStatus("done");
      } else if (status.status === "failed") {
        window.clearInterval(poll);
        videoPollRef.current = null;
        setVideoStatus("idle");
      }
    }, 2000);
    videoPollRef.current = poll;
  }

  async function handlePublish(targets: ("tiktok" | "instagram")[]) {
    if (publishState.status === "publishing") return;

    setPublishState({ status: "publishing" });
    try {
      const firstStill = stills[draft.shots[0]?.id ?? ""] ?? null;
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          hook: draft.hook,
          cta: draft.cta,
          videoUrl,
          imageUrl: firstStill,
          targets,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; detail?: string; error?: string };
      setPublishState({
        status: data.ok ? "done" : "error",
        detail: data.detail ?? data.error ?? "publish request failed",
      });
    } catch (e) {
      setPublishState({
        status: "error",
        detail: e instanceof Error ? e.message : "publish request failed",
      });
    }
  }

  const totalSeconds = draft.shots.reduce((sum, shot) => sum + shot.duration_s, 0);
  const publishBusy = publishState.status === "publishing";
  const firstStill = stills[draft.shots[0]?.id ?? ""];
  const modelOptions = modelOptionsWithSelection(modelConfig?.models ?? [], selectedModel);
  const gatewayStatus = modelConfig?.gatewayConfigured
    ? "gateway configured"
    : `fallback ${modelConfig?.fallbackModelId ?? draft.meta.model}`;

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-lg border border-[#ddd4c9] bg-[#17110d] p-4 text-white shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#d9a074]">{props.sourceLabel}</p>
            <h3 className="mt-1 text-xl font-semibold">{draft.title}</h3>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
            {draft.meta.model} / {totalSeconds}s
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(250px,360px)_1fr]">
          <div className="mx-auto w-full max-w-[320px] rounded-[28px] border border-white/15 bg-black p-3 shadow-2xl">
            <div
              className="relative aspect-[9/16] overflow-hidden rounded-[20px] bg-cover bg-center"
              style={{ backgroundImage: `url(${stills[draft.shots[0]?.id ?? ""] ?? props.mediaUrl})` }}
            >
              <div className="absolute inset-x-0 top-0 flex justify-between bg-gradient-to-b from-black/65 to-transparent p-4 text-xs">
                <span>OpenUI Remix</span>
                <span>{videoStatus === "done" ? "video ready" : "storyboard"}</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/65 to-transparent p-4">
                <p className="text-lg font-semibold leading-tight">{draft.hook}</p>
                <p className="mt-2 text-xs text-white/70">{draft.cta}</p>
              </div>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {draft.shots.map((shot) => (
                <article key={shot.id} className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-white/50">
                    <span className="font-mono">{shot.id}</span>
                    <span>{shot.duration_s}s</span>
                  </div>
                  <div
                    className="mb-3 aspect-video rounded-md bg-cover bg-center"
                    style={{ backgroundImage: `url(${stills[shot.id] ?? `https://picsum.photos/seed/${shot.id}/768/432`})` }}
                  />
                  <p className="text-sm leading-5 text-white/82">{shot.script}</p>
                  {shot.on_screen_text ? (
                    <p className="mt-2 text-xs font-semibold text-[#f2b079]">{shot.on_screen_text}</p>
                  ) : null}
                </article>
              ))}
            </div>
            <div className="mt-auto rounded-lg border border-white/10 bg-white/[0.06] p-3">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void renderStills(draft)}
                  className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-[#17110d] hover:bg-[#fff2e8]"
                >
                  Render stills
                </button>
                <button
                  onClick={() => void handleRenderVideo()}
                  disabled={videoStatus !== "idle"}
                  className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-45"
                >
                  {videoStatus === "rendering" ? "Polling video" : videoStatus === "done" ? "Video ready" : "Render video"}
                </button>
              </div>
              {videoUrl ? (
                <video src={videoUrl} controls className="mt-3 aspect-video w-full rounded-md bg-black" />
              ) : null}
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-white">Publish via Composio</h4>
                  <p className="mt-1 text-xs text-white/55">
                    {videoUrl
                      ? "Video ready for TikTok or Instagram."
                      : firstStill
                        ? "A still is ready for Instagram; render video for TikTok."
                        : "Render stills or video before publishing."}
                  </p>
                </div>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                  /api/publish
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void handlePublish(["instagram"])}
                  disabled={publishBusy || !firstStill}
                  className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-45"
                >
                  Instagram
                </button>
                <button
                  onClick={() => void handlePublish(["tiktok"])}
                  disabled={publishBusy || !videoUrl}
                  className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-45"
                >
                  TikTok
                </button>
                <button
                  onClick={() => void handlePublish(["instagram", "tiktok"])}
                  disabled={publishBusy || !firstStill}
                  className="rounded-md bg-[#d98045] px-3 py-2 text-xs font-semibold text-white hover:bg-[#ef965a] disabled:opacity-45"
                >
                  {publishBusy ? "Publishing" : "Publish all"}
                </button>
              </div>
              {publishState.status !== "idle" ? (
                <p
                  className={[
                    "mt-2 text-xs",
                    publishState.status === "done" ? "text-emerald-300" : "",
                    publishState.status === "error" ? "text-red-300" : "",
                    publishState.status === "publishing" ? "text-white/55" : "",
                  ].join(" ")}
                >
                  {publishState.status === "publishing" ? "Sending to Composio..." : publishState.detail}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <aside className="rounded-lg border border-[#ddd4c9] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Chat composer</h3>
          <span className="rounded-full bg-[#f5e6d8] px-2 py-0.5 text-xs text-[#a35d2f]">/api/draft</span>
        </div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#8d8177]" htmlFor="draft-model">
          Model
        </label>
        <select
          id="draft-model"
          value={selectedModel}
          onChange={(event) => setSelectedModel(event.target.value)}
          className="mb-3 h-10 w-full rounded-lg border border-[#ddd4c9] bg-[#fbf8f4] px-3 text-sm outline-none focus:border-[#c77842]"
        >
          {modelOptions.map((model) => (
            <option key={model.id} value={model.id}>
              {modelOptionLabel(model)}
            </option>
          ))}
        </select>
        <textarea
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          className="min-h-32 w-full resize-none rounded-lg border border-[#ddd4c9] bg-[#fbf8f4] p-3 text-sm outline-none focus:border-[#c77842]"
        />
        <button
          onClick={() => void handleDraft()}
          disabled={drafting || !topic.trim()}
          className="mt-3 w-full rounded-lg bg-[#221914] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3a2b22] disabled:opacity-45"
        >
          {drafting ? "Drafting through gateway" : "Draft ad"}
        </button>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        <div className="mt-4 space-y-3 border-t border-[#eee5dc] pt-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8d8177]">Chat history</h4>
            <span className="max-w-[190px] truncate rounded-full bg-[#f5e6d8] px-2 py-0.5 text-xs text-[#9a582c]">
              {gatewayStatus}
            </span>
          </div>
          {chatMessages.map((message) => (
            <PromptBubble
              key={message.id}
              label={message.role === "user" ? "User" : "Assistant"}
              body={message.body}
              modelId={message.modelId}
              tone={message.role}
            />
          ))}
        </div>
        <div className="mt-4 space-y-2 border-t border-[#eee5dc] pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8d8177]">Traces</h4>
          {traces.map((trace) => (
            <div key={trace.id} className="rounded-lg border border-[#eee5dc] bg-[#fbf8f4] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#221914]">{trace.status}</span>
                <span className="text-xs text-[#8d8177]">
                  {trace.latencyMs === undefined ? trace.detail : `${trace.latencyMs}ms`}
                </span>
              </div>
              <TraceModelRow label="request" value={trace.requestedModel} />
              <TraceModelRow label="response" value={trace.responseModel ?? "pending"} />
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}

function PromptBubble({
  label,
  body,
  modelId,
  tone,
}: {
  label: string;
  body: string;
  modelId: string;
  tone: "user" | "assistant";
}) {
  return (
    <div className={tone === "user" ? "rounded-lg bg-[#c86f33] p-3 text-white" : "rounded-lg bg-[#f0ece7] p-3 text-[#221914]"}>
      <div className="flex items-center justify-between gap-2">
        <p className={tone === "user" ? "text-xs font-semibold text-white/70" : "text-xs font-semibold text-[#8d8177]"}>
          {label}
        </p>
        <span
          className={[
            "min-w-0 max-w-[170px] truncate rounded-full px-2 py-0.5 text-xs",
            tone === "user" ? "bg-white/15 text-white/80" : "bg-white text-[#7b6f65]",
          ].join(" ")}
          title={modelId}
        >
          {modelId}
        </span>
      </div>
      <p className="mt-1 text-sm leading-5">{body}</p>
    </div>
  );
}

function TraceModelRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <span className="text-[#8d8177]">{label}</span>
      <span className="min-w-0 max-w-[230px] truncate font-mono text-[#221914]" title={value}>
        {value}
      </span>
    </div>
  );
}

function modelOptionsWithSelection(models: DraftModelOption[], selectedModel: string) {
  if (!selectedModel || models.some((model) => model.id === selectedModel)) return models;

  return [
    {
      id: selectedModel,
      label: "Selected",
      roles: [] as DraftModelOption["roles"],
      isDefault: false,
    },
    ...models,
  ];
}

function modelOptionLabel(model: DraftModelOption) {
  const label = model.roles.length > 0 ? model.roles.map(modelRoleLabel).join(" + ") : model.label;
  return `${label}: ${model.id}`;
}

function modelRoleLabel(role: DraftModelOption["roles"][number]) {
  return role === "pioneer" ? "Pioneer" : "Base";
}

const PanelGrid = defineComponent({
  name: "PanelGrid",
  description: "Responsive grid for OpenUI analytics and dev-loop panels.",
  props: z.object({
    children: z.array(z.any()),
  }),
  component: ({ props, renderNode }) => (
    <section className="grid gap-5 xl:grid-cols-3">
      {props.children.map((child, index) => (
        <div key={index}>{renderNode(child)}</div>
      ))}
    </section>
  ),
});

const AnalyticsPanel = defineComponent({
  name: "AnalyticsPanel",
  description: "Analytics card with KPI metrics and simple bar comparison.",
  props: z.object({
    title: z.string(),
    insight: z.string(),
    metrics: z.array(metricSchema),
    bars: z.array(barSchema),
  }),
  component: ({ props }) => (
    <article className="h-full rounded-lg border border-[#ddd4c9] bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold">{props.title}</h3>
        <p className="mt-1 text-sm leading-5 text-[#6f6258]">{props.insight}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {props.metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border border-[#eee5dc] bg-[#fbf8f4] p-3">
            <p className="text-xs text-[#8b8176]">{metric.label}</p>
            <p className={["mt-1 text-xl font-semibold", metricTone(metric.tone)].join(" ")}>
              {metric.value}
            </p>
            <p className="mt-1 text-xs text-[#8b8176]">{metric.detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {props.bars.map((bar) => (
          <div key={bar.label}>
            <div className="mb-1 flex justify-between text-xs text-[#7b6f65]">
              <span>{bar.label}</span>
              <span>{bar.value}</span>
            </div>
            <div className="h-2 rounded-full bg-[#eee5dc]">
              <div
                className="h-2 rounded-full bg-[#c86f33]"
                style={{ width: `${Math.max(4, Math.min(100, bar.value))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  ),
});

const DevLoopPanel = defineComponent({
  name: "DevLoopPanel",
  description: "Dev-loop requirements, status, and evidence panel.",
  props: z.object({
    title: z.string(),
    summary: z.string(),
    rows: z.array(requirementSchema),
  }),
  component: ({ props }) => (
    <article className="h-full rounded-lg border border-[#ddd4c9] bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold">{props.title}</h3>
      <p className="mt-1 text-sm leading-5 text-[#6f6258]">{props.summary}</p>
      <div className="mt-4 space-y-2">
        {props.rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-[#eee5dc] bg-[#fbf8f4] p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium">{row.label}</p>
              <span className={["rounded-full px-2 py-0.5 text-xs font-semibold", statusTone(row.status)].join(" ")}>
                {row.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#8b8176]">{row.evidence}</p>
          </div>
        ))}
      </div>
    </article>
  ),
});

const PipelinePanel = defineComponent({
  name: "PipelinePanel",
  description: "Sponsor production-line status panel.",
  props: z.object({
    title: z.string(),
    steps: z.array(pipelineStepSchema),
  }),
  component: ({ props }) => (
    <article className="h-full rounded-lg border border-[#ddd4c9] bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold">{props.title}</h3>
      <div className="mt-4 space-y-3">
        {props.steps.map((step, index) => (
          <div key={`${step.label}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#221914] text-xs font-semibold text-white">
                {index + 1}
              </span>
              {index < props.steps.length - 1 ? <span className="h-full min-h-6 w-px bg-[#e5d8ca]" /> : null}
            </div>
            <div className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{step.label}</p>
                <span className="rounded-full bg-[#f5e6d8] px-2 py-0.5 text-xs text-[#9a582c]">{step.state}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-[#7b6f65]">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  ),
});

export const adFactoryOpenUiLibrary = createLibrary({
  root: "AppFrame",
  components: [
    AppFrame,
    SectionHeader,
    CreatorWorkspace,
    PanelGrid,
    AnalyticsPanel,
    DevLoopPanel,
    PipelinePanel,
  ],
  componentGroups: [
    {
      name: "Ad Factory demo components",
      components: [
        "AppFrame",
        "SectionHeader",
        "CreatorWorkspace",
        "PanelGrid",
        "AnalyticsPanel",
        "DevLoopPanel",
        "PipelinePanel",
      ],
      notes: [
        "Use AppFrame as the root.",
        "Keep creator, analytics, and dev-loop surfaces visible in the default state.",
        "Use AnalyticsPanel and DevLoopPanel for generated UI responses.",
      ],
    },
  ],
});

function metricTone(tone: z.infer<typeof metricSchema>["tone"]) {
  switch (tone) {
    case "good":
      return "text-[#26734d]";
    case "warn":
      return "text-[#b86a24]";
    case "bad":
      return "text-[#b23b3b]";
    default:
      return "text-[#221914]";
  }
}

function statusTone(status: z.infer<typeof requirementSchema>["status"]) {
  switch (status) {
    case "pass":
      return "bg-[#e5f4ec] text-[#26734d]";
    case "mock":
      return "bg-[#f5e6d8] text-[#9a582c]";
    case "fail":
      return "bg-[#f7dddd] text-[#a73838]";
    default:
      return "bg-[#ebe7e1] text-[#6f6258]";
  }
}
