"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChatProvider, openAIResponsesAdapter } from "@openuidev/react-headless";
import { Renderer, type OpenUIError } from "@openuidev/react-lang";
import { ArtifactPortalTarget } from "@openuidev/react-ui";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUp,
  BarChart3,
  Bot,
  ChevronDown,
  Download,
  FileText,
  Image as ImageIcon,
  Library,
  Loader2,
  Lock,
  LogOut,
  Moon,
  Play,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Star,
  Upload,
  Video,
  type LucideIcon,
} from "lucide-react";
import { VISUAL_REMIX_ARTIFACT_PROGRAM } from "@/lib/openui/visual-programs";
import { visualOpenUiLibrary } from "@/components/openui/visual-openui-library";

type RemixMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  mocked?: boolean;
  model?: string;
};

type StudioView = "import" | "library" | "remix" | "analytics";

type InstagramAnalyticsResponse = {
  live: boolean;
  mocked: boolean;
  model: string;
  summary: string;
  program: string;
  profile?: { username?: string };
};

type TrainingPipelineResponse = {
  live: boolean;
  mocked: boolean;
  model: string;
  summary: string;
  recommendations: string[];
  program: string;
  eventCount: number;
  recordCount: number;
  clickhouseMode: string;
  job: {
    jobId: string;
    status: string;
    pipeline: string;
    modelTarget: string;
    trainRecords: number;
    evalRecords: number;
    metrics: {
      promptQuality: number;
      visualSpecificity: number;
      safetyPassRate: number;
    };
  };
};

type DatasetExportResponse = {
  mode: string;
  count: number;
  jsonl: string;
};

const heroImageUrl =
  "https://images.unsplash.com/photo-1753545975907-dcb51efdd0d5?auto=format&fit=crop&w=1200&q=88";

const initialMessages: RemixMessage[] = [
  {
    id: "assistant-seed",
    role: "assistant",
    content:
      "orange and white flame-style embroidery, thin dark mustache, small dark soul patch, dewy finish, full natural eyebrows, and squinted eyes, wearing a dark grey short-sleeved t-shirt, silver-toned curb link chain necklace, and small silver-toned stud earrings, leans forward at a cluttered desk in a dimly lit hackathon space.",
  },
  {
    id: "assistant-context",
    role: "assistant",
    content:
      "Here is your render prompt for the intense hackathon moment. Keep the locked character, preserve the laptop-screen light, and use the teacher/student/lunch-lady line as the absurd contrast that makes the TikTok remix memorable.",
  },
];

export function VisualRemixStudio() {
  const pathname = usePathname();
  const currentView = getStudioView(pathname);
  const [messages, setMessages] = useState<RemixMessage[]>(initialMessages);
  const [composer, setComposer] = useState("");
  const [running, setRunning] = useState(false);
  const [analyticsProgram, setAnalyticsProgram] = useState<string | null>(null);

  useEffect(() => {
    if (currentView !== "remix") return;

    const transcript = window.sessionStorage.getItem("visual-import-transcript");
    const importedLink = window.sessionStorage.getItem("visual-import-link");
    if (!transcript && !importedLink) return;

    window.sessionStorage.removeItem("visual-import-transcript");
    window.sessionStorage.removeItem("visual-import-link");
    setComposer(
      transcript
        ? `Remix this imported video into a short-form ad.\n\nTranscript:\n${transcript}\n\nTranscribe the hook, preserve the strongest visual beat, and generate a Visual-style remix prompt.`
        : `Remix this imported video source: ${importedLink}\n\nTranscribe the hook, preserve the strongest visual beat, and generate a Visual-style remix prompt for a short-form ad.`
    );
  }, [currentView]);

  async function sendPrompt(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed || running) return;

    const userMessage: RemixMessage = {
      id: createClientId(),
      role: "user",
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setComposer("");
    setRunning(true);

    try {
      if (isInstagramAnalyticsPrompt(trimmed)) {
        const res = await fetch("/api/agent/instagram-analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) throw new Error(`Instagram analytics failed (${res.status})`);

        const data = (await res.json()) as InstagramAnalyticsResponse;
        setAnalyticsProgram(data.program);
        setMessages((current) => [
          ...current,
          {
            id: createClientId(),
            role: "assistant",
            content: `${data.live ? "Live" : "Mock"} Instagram analytics pulled via Composio MCP for @${
              data.profile?.username ?? "instagram"
            }. ${data.summary}`,
            model: data.model,
            mocked: data.mocked || !data.live,
          },
        ]);
        return;
      }

      if (isTrainingPipelinePrompt(trimmed)) {
        const res = await fetch("/api/analytics/openui", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) throw new Error(`training pipeline failed (${res.status})`);

        const data = (await res.json()) as TrainingPipelineResponse;
        setAnalyticsProgram(data.program);
        setMessages((current) => [
          ...current,
          {
            id: createClientId(),
            role: "assistant",
            content: `${data.clickhouseMode === "clickhouse" ? "Live ClickHouse" : "Local memory"} history produced ${
              data.recordCount
            } Fastino-ready JSONL records. ${data.summary}`,
            model: data.model,
            mocked: data.mocked || data.clickhouseMode !== "clickhouse",
          },
        ]);
        return;
      }

      const res = await fetch("/api/agent/remix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      if (!res.ok) throw new Error(`agent failed (${res.status})`);

      const data = (await res.json()) as { output: string; model: string; mocked: boolean };
      setMessages((current) => [
        ...current,
        {
          id: createClientId(),
          role: "assistant",
          content: data.output,
          model: data.model,
          mocked: data.mocked,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: createClientId(),
          role: "assistant",
          content:
            error instanceof Error
              ? `Agent note: ${error.message}. Keep the remix moving with the current prompt artifact.`
              : "Agent note: the request failed. Keep the remix moving with the current prompt artifact.",
          mocked: true,
        },
      ]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f6f4] text-[#211c18]">
      <div className="lg:grid lg:min-h-screen lg:grid-cols-[216px_minmax(0,1fr)]">
        <StudioSidebar currentView={currentView} />
        {currentView === "import" ? (
          <ImportView />
        ) : currentView === "library" ? (
          <LibraryView />
        ) : currentView === "analytics" ? (
          <AnalyticsView />
        ) : (
          <>
            <section className="relative min-h-screen min-w-0 px-4 py-5 pb-5 lg:px-8 lg:pr-[410px]">
              <RemixHeader />
              <MediaStage />
              <Composer
                value={composer}
                running={running}
                onChange={setComposer}
                onSubmit={() => void sendPrompt(composer)}
              />
            </section>
            <RemixChatPanel
              messages={messages}
              running={running}
              analyticsProgram={analyticsProgram}
              onSend={(prompt) => void sendPrompt(prompt)}
            />
          </>
        )}
      </div>
    </main>
  );
}

function isInstagramAnalyticsPrompt(prompt: string) {
  const normalized = prompt.toLowerCase();
  return (
    normalized.includes("instagram") &&
    (normalized.includes("analytics") ||
      normalized.includes("insight") ||
      normalized.includes("composio") ||
      normalized.includes("profile"))
  );
}

function isTrainingPipelinePrompt(prompt: string) {
  const normalized = prompt.toLowerCase();
  return (
    (normalized.includes("clickhouse") ||
      normalized.includes("fastino") ||
      normalized.includes("pioneer") ||
      normalized.includes("fine-tun") ||
      normalized.includes("jsonl") ||
      normalized.includes("training")) &&
    (normalized.includes("chat") ||
      normalized.includes("history") ||
      normalized.includes("prompt") ||
      normalized.includes("analytics") ||
      normalized.includes("dataset"))
  );
}

function getStudioView(pathname: string | null): StudioView {
  if (pathname?.startsWith("/import")) return "import";
  if (pathname?.startsWith("/library")) return "library";
  if (pathname?.startsWith("/analytics")) return "analytics";
  if (pathname?.startsWith("/remix")) return "remix";
  return "remix";
}

function ImportView() {
  const router = useRouter();
  const [videoUrl, setVideoUrl] = useState("");
  const [importing, setImporting] = useState(false);

  async function submitImport() {
    const trimmed = videoUrl.trim();
    if (!trimmed || importing) return;

    setImporting(true);
    try {
      // Scrape the link → real transcript (Apify subtitles → gateway LLM → mock).
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      if (res.ok) {
        const { transcript } = (await res.json()) as { transcript: string };
        window.sessionStorage.setItem("visual-import-transcript", transcript);
      } else {
        // Non-TikTok or scrape failure — fall back to handing the raw link downstream.
        window.sessionStorage.removeItem("visual-import-transcript");
      }
    } catch {
      window.sessionStorage.removeItem("visual-import-transcript");
    } finally {
      window.sessionStorage.setItem("visual-import-link", trimmed);
      setImporting(false);
      router.push("/remix");
    }
  }

  return (
    <section className="flex min-h-screen min-w-0 items-center justify-center px-4 py-12 lg:px-8">
      <div className="-mt-20 w-full max-w-[540px] text-center">
        <h1 className="text-xl font-semibold">Import a video</h1>
        <p className="mt-2 text-sm text-[#847970]">
          Paste an Instagram Reels link to transcribe and remix it.
        </p>

        <form
          className="mt-5 rounded-xl border border-[#e2ddd7] bg-white px-4 py-4 text-left shadow-[0_8px_28px_rgba(35,28,22,0.12)]"
          onSubmit={(event) => {
            event.preventDefault();
            submitImport();
          }}
        >
          <div className="flex items-center gap-3">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Video link</span>
              <input
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
                disabled={importing}
                className="w-full bg-transparent text-sm outline-none placeholder:text-[#c9c2bc] disabled:opacity-60"
                placeholder="Paste a video link..."
              />
              <span className="mt-5 block text-xs font-medium text-[#a59b92]">
                {importing ? "Transcribing the video…" : "Instagram Reels"}
              </span>
            </label>
            <button
              type="submit"
              aria-label="Import video link"
              disabled={!videoUrl.trim() || importing}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#c95f14] text-white hover:bg-[#ad500f] disabled:bg-[#c9c2bc]"
            >
              {importing ? (
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp aria-hidden className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>

        <p className="mt-3 text-xs text-[#8a8077]">
          Tip: <span className="font-semibold text-[#c95f14]">create a persona</span> to tailor this ad to a
          specific customer.
        </p>
      </div>
    </section>
  );
}

function LibraryView() {
  return (
    <section className="min-h-screen min-w-0 px-4 py-10 lg:px-8">
      <div className="mx-auto w-full max-w-[1210px]">
        <p className="text-sm text-[#81776f]">Workspace</p>
        <h1 className="text-3xl font-semibold leading-tight">Library</h1>
        <p className="mt-2 max-w-[940px] text-sm text-[#81776f]">
          Saved character, character sheet, scene, video, and persona references. Attach them to any chat to keep
          identity and look consistent across sessions.
        </p>

        <div className="mt-6 flex min-h-[165px] flex-col items-center justify-center rounded-xl border border-[#e0dbd4] bg-white px-8 text-center shadow-[0_8px_24px_rgba(35,28,22,0.12)]">
          <Library aria-hidden className="h-9 w-9 text-[#c95f14]" />
          <p className="mt-5 max-w-[880px] text-sm text-[#81776f]">
            No saved references yet. In a Sandbox chat with Director Mode on, click Save to Library on a rendered
            image to lock it in as a Character, Character Sheet, or Scene - or save a video render to keep the clip
            alongside its spec.
          </p>
        </div>
      </div>
    </section>
  );
}

function AnalyticsView() {
  const [pipeline, setPipeline] = useState<TrainingPipelineResponse | null>(null);
  const [jsonl, setJsonl] = useState("");
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [error, setError] = useState("");
  const [artifactErrors, setArtifactErrors] = useState<OpenUIError[]>([]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchTrainingPipelineView();
      setPipeline(data.pipeline);
      setJsonl(data.jsonl);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to load analytics pipeline.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchTrainingPipelineView();
        if (cancelled) return;
        setPipeline(data.pipeline);
        setJsonl(data.jsonl);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load analytics pipeline.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function startMockTraining() {
    setTraining(true);
    setError("");
    try {
      const res = await fetch("/api/analytics/train", { method: "POST" });
      if (!res.ok) throw new Error(`mock training failed (${res.status})`);
      await refresh();
    } catch (trainError) {
      setError(trainError instanceof Error ? trainError.message : "Mock training failed.");
    } finally {
      setTraining(false);
    }
  }

  const jsonlPreview = jsonl
    .split("\n")
    .slice(0, 6)
    .join("\n");

  return (
    <section className="min-h-screen min-w-0 px-4 py-10 lg:px-8">
      <div className="mx-auto w-full max-w-[1210px]">
        <p className="text-sm text-[#81776f]">Workspace</p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold leading-tight">Analytics</h1>
            <p className="mt-2 max-w-[860px] text-sm text-[#81776f]">
              Append-only chat history capture, OpenUI artifact metadata, and a mock Pioneer/Fastino prompt-model
              handoff for the hackathon demo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/api/analytics/export?format=jsonl"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[#ded8d2] bg-white px-3 text-sm font-semibold text-[#4f4740] hover:bg-[#f8f5f2]"
            >
              <Download aria-hidden className="h-4 w-4" />
              JSONL
            </a>
            <button
              type="button"
              onClick={() => void startMockTraining()}
              disabled={training}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[#c95f14] px-3 text-sm font-semibold text-white hover:bg-[#ad500f] disabled:opacity-45"
            >
              <Play aria-hidden className="h-4 w-4" />
              {training ? "Running" : "Mock train"}
            </button>
          </div>
        </div>

        {error ? (
          <p className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatusRow label="Storage" value={pipeline?.clickhouseMode ?? (loading ? "loading" : "memory")} />
          <StatusRow label="Events" value={pipeline?.eventCount.toString() ?? "-"} />
          <StatusRow label="JSONL records" value={pipeline?.recordCount.toString() ?? "-"} />
          <StatusRow label="Fastino job" value={pipeline?.job.status.replace("_", " ") ?? "mock ready"} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-h-[420px] rounded-xl border border-[#e0dbd4] bg-white p-4 shadow-[0_8px_24px_rgba(35,28,22,0.1)]">
            {pipeline ? (
              <ChatProvider apiUrl="/api/agent/chat" streamProtocol={openAIResponsesAdapter()}>
                <Renderer
                  library={visualOpenUiLibrary}
                  response={pipeline.program}
                  onError={setArtifactErrors}
                />
                <ArtifactPortalTarget />
              </ChatProvider>
            ) : (
              <div className="flex min-h-[360px] items-center justify-center text-sm text-[#81776f]">
                Loading analytics artifact...
              </div>
            )}
            {artifactErrors.length > 0 ? (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {artifactErrors[0]?.message}
              </p>
            ) : null}
          </div>

          <aside className="rounded-xl border border-[#e0dbd4] bg-[#211c18] p-4 text-white shadow-[0_8px_24px_rgba(35,28,22,0.12)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">JSONL preview</h2>
                <p className="mt-1 text-xs text-white/60">Fine-tuning records for the small prompt model.</p>
              </div>
              <span className="rounded-md bg-white/10 px-2 py-1 text-xs">{pipeline?.job.pipeline ?? "mock"}</span>
            </div>
            <pre className="mt-4 max-h-[330px] overflow-auto whitespace-pre-wrap rounded-md bg-black/30 p-3 text-xs leading-5 text-[#f5e7dc]">
              {jsonlPreview || "No records yet."}
            </pre>
            {pipeline ? (
              <div className="mt-4 space-y-2 text-xs text-white/70">
                <p>Model target: {pipeline.job.modelTarget}</p>
                <p>
                  Split: {pipeline.job.trainRecords} train / {pipeline.job.evalRecords} eval
                </p>
                <p>Prompt quality: {Math.round(pipeline.job.metrics.promptQuality * 100)}%</p>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </section>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e0dbd4] bg-white px-4 py-3 shadow-[0_8px_20px_rgba(35,28,22,0.08)]">
      <p className="text-xs font-semibold uppercase text-[#8c827a]">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold text-[#211c18]">{value}</p>
    </div>
  );
}

async function fetchTrainingPipelineView() {
  const [pipelineRes, exportRes] = await Promise.all([
    fetch("/api/analytics/openui"),
    fetch("/api/analytics/export?limit=12"),
  ]);

  if (!pipelineRes.ok) throw new Error(`pipeline artifact failed (${pipelineRes.status})`);
  if (!exportRes.ok) throw new Error(`dataset export failed (${exportRes.status})`);

  const [pipeline, dataset] = (await Promise.all([
    pipelineRes.json(),
    exportRes.json(),
  ])) as [TrainingPipelineResponse, DatasetExportResponse];

  return { pipeline, jsonl: dataset.jsonl };
}

function StudioSidebar({ currentView }: { currentView: StudioView }) {
  const router = useRouter();

  return (
    <aside className="hidden min-h-screen border-r border-[#dfdbd6] bg-[#ece9e6] px-3 py-5 text-[#302a25] lg:flex lg:flex-col">
      <div className="mb-8 flex items-center gap-2 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#bbb2aa] bg-[#faf8f5]">
          <Sparkles aria-hidden className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">VisualLabs</p>
          <p className="text-xs text-[#82766d]">Harness demo</p>
        </div>
      </div>

      <nav className="space-y-1">
        <SidebarNavItem
          label="Import"
          icon={Upload}
          active={currentView === "import"}
          onClick={() => router.push("/import")}
        />
        <SidebarNavItem
          label="Library"
          icon={Library}
          active={currentView === "library"}
          onClick={() => router.push("/library")}
        />
        <SidebarNavItem
          label="Remix"
          icon={Sparkles}
          active={currentView === "remix"}
          onClick={() => router.push("/remix")}
        />
        <SidebarNavItem
          label="Analytics"
          icon={BarChart3}
          active={currentView === "analytics"}
          onClick={() => router.push("/analytics")}
        />
      </nav>

      <div className="mt-auto">
        <button
          type="button"
          aria-label="Toggle appearance"
          className="mb-3 flex h-8 w-8 items-center justify-center rounded-md text-[#6d625a] hover:bg-white"
        >
          <Moon aria-hidden className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 rounded-lg border border-[#d9d3cd] bg-[#fbfaf8] p-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d36f35] text-sm font-semibold text-white">
            H
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">Homen Shum</p>
            <p className="truncate text-xs text-[#82766d]">hshum2018@gmail.com</p>
          </div>
          <LogOut aria-hidden className="h-4 w-4 text-[#8f837a]" />
        </div>
      </div>
    </aside>
  );
}

function SidebarNavItem({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={[
        "flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-left text-sm transition",
        active ? "bg-[#eadbd0] font-semibold text-[#9c4f24]" : "text-[#4f4740] hover:bg-white",
      ].join(" ")}
    >
      <Icon aria-hidden className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

function RemixHeader() {
  return (
    <header className="mx-auto w-full max-w-[1050px]">
      <button type="button" className="mb-3 text-sm text-[#746a62] hover:text-[#211c18]">
        &lt; All remixes
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="max-w-[900px] text-2xl font-semibold leading-tight md:text-3xl">
            @Kai Cenat this is my Audition. Teacher, student, lunch lady just lmk and me and
          </h1>
          <p className="mt-1 text-xs text-[#81776f]">
            tiktok - @Kai Cenat this is my Audition. Teacher, student, lunch lady
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-[#e3b58e] bg-[#fff4ea] px-3 py-1.5 text-[10px] font-semibold uppercase text-[#c2682b]">
          <Lock aria-hidden className="h-3.5 w-3.5" />
          Locked character
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg bg-[#ece9e6] p-1">
          <TabButton icon={FileText} label="Source" active />
          <TabButton icon={ImageIcon} label="Image" />
          <TabButton icon={Video} label="Video" />
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-[#c95f14] px-3 py-2 text-sm font-semibold text-white hover:bg-[#ad500f]"
        >
          <Sparkles aria-hidden className="h-4 w-4" />
          Generate image
        </button>
      </div>
    </header>
  );
}

function TabButton({ icon: Icon, label, active }: { icon: LucideIcon; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      className={[
        "inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold",
        active ? "bg-white text-[#211c18] shadow-sm" : "text-[#726860] hover:bg-white/70",
      ].join(" ")}
    >
      <Icon aria-hidden className="h-4 w-4" />
      {label}
    </button>
  );
}

function MediaStage() {
  return (
    <section className="mx-auto mt-4 w-full max-w-[1050px]">
      <div className="relative flex min-h-[560px] items-center justify-center bg-[#ebe8e4] px-4 py-5">
        <div className="absolute right-4 top-4 z-10 flex gap-2">
          <IconButton label="Favorite" icon={Star} />
          <IconButton label="Download" icon={Download} />
        </div>
        <div
          role="img"
          aria-label="Creator leaning over a laptop in a production room"
          className="relative aspect-[3/4] w-full max-w-[640px] overflow-hidden bg-[#1d2c2b] bg-cover bg-center shadow-[0_24px_70px_rgba(30,25,20,0.18)]"
          style={{ backgroundImage: `url(${heroImageUrl})` }}
        >
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <p className="max-w-md text-sm font-semibold">
                Locked character remix frame - hackathon breakthrough
              </p>
              <span className="rounded-md bg-white/15 px-2 py-1 text-xs">9:16</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function IconButton({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-md bg-[#726a62]/90 text-white shadow-sm hover:bg-[#211c18]"
    >
      <Icon aria-hidden className="h-4 w-4" />
    </button>
  );
}

function RemixChatPanel({
  messages,
  running,
  analyticsProgram,
  onSend,
}: {
  messages: RemixMessage[];
  running: boolean;
  analyticsProgram: string | null;
  onSend: (prompt: string) => void;
}) {
  const [quickPrompt, setQuickPrompt] = useState("");
  const [artifactErrors, setArtifactErrors] = useState<OpenUIError[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, running]);

  return (
    <aside className="mx-4 mb-5 rounded-lg border border-[#dfdbd6] bg-white shadow-[0_12px_36px_rgba(35,28,22,0.16)] lg:fixed lg:bottom-5 lg:right-5 lg:top-5 lg:z-20 lg:mx-0 lg:mb-0 lg:flex lg:w-[360px] lg:flex-col">
      <div className="flex items-center justify-between border-b border-[#ebe6e0] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden className="h-4 w-4 text-[#c95f14]" />
          <h2 className="text-sm font-semibold">Remix chat</h2>
        </div>
        <button type="button" aria-label="Close chat" className="rounded-md p-1 text-[#8c827a] hover:bg-[#f1eeeb]">
          x
        </button>
      </div>

      <div className="border-b border-[#ebe6e0] px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-[#80766e]">
          <Bot aria-hidden className="h-4 w-4" />
          <span>Persona:</span>
          <button type="button" className="ml-auto inline-flex items-center gap-2 rounded-md px-2 py-1 hover:bg-[#f4f1ee]">
            No persona
            <ChevronDown aria-hidden className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="text-[#c95f14] hover:underline">
            + Create one
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="max-h-[68vh] flex-1 space-y-3 overflow-y-auto p-4 lg:max-h-none">
        {messages.map((message, index) => (
          <ChatBubble key={message.id} message={message} first={index === 0} />
        ))}
        <ChatProvider
          key={analyticsProgram ? "instagram-analytics-artifact" : "remix-prompt-artifact"}
          apiUrl="/api/agent/chat"
          streamProtocol={openAIResponsesAdapter()}
        >
          <Renderer
            library={visualOpenUiLibrary}
            response={analyticsProgram ?? VISUAL_REMIX_ARTIFACT_PROGRAM}
            onError={setArtifactErrors}
          />
          <ArtifactPortalTarget />
        </ChatProvider>
        {artifactErrors.length > 0 ? (
          <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {artifactErrors[0]?.message}
          </p>
        ) : null}
        {running ? (
          <div className="rounded-lg bg-[#f0eeeb] p-3 text-sm text-[#5c554f]">Thinking through the remix...</div>
        ) : null}
      </div>

      <div className="border-t border-[#ebe6e0] p-3">
        <div className="mb-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSend("Pull live Instagram analytics from Composio and render the OpenUI artifact.")}
            disabled={running}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-[#e0a371] bg-[#fff3ea] px-2 text-xs font-semibold text-[#b95c1f] hover:bg-white disabled:opacity-45"
          >
            <BarChart3 aria-hidden className="h-4 w-4" />
            Live IG analytics
          </button>
          <button
            type="button"
            onClick={() =>
              onSend("Show the ClickHouse chat history export and mock Fastino Pioneer training pipeline as an OpenUI artifact.")
            }
            disabled={running}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-[#d8c8bc] bg-white px-2 text-xs font-semibold text-[#6b5546] hover:bg-[#fff7f0] disabled:opacity-45"
          >
            <Sparkles aria-hidden className="h-4 w-4" />
            Fastino loop
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#ded8d2] bg-[#fbfaf8] px-3 py-2">
          <input
            value={quickPrompt}
            onChange={(event) => setQuickPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSend(quickPrompt);
                setQuickPrompt("");
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#aaa29b]"
            placeholder="Refine prompt"
          />
          <button
            type="button"
            aria-label="Send"
            onClick={() => {
              onSend(quickPrompt);
              setQuickPrompt("");
            }}
            disabled={running || !quickPrompt.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-[#8a8a8a] text-white hover:bg-[#211c18] disabled:opacity-45"
          >
            <Send aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function ChatBubble({ message, first }: { message: RemixMessage; first: boolean }) {
  const assistant = message.role === "assistant";

  return (
    <div
      className={[
        "rounded-lg p-3 text-sm leading-5",
        assistant && first ? "bg-[#c77338] font-semibold text-white" : "",
        assistant && !first ? "bg-[#e9e7e4] text-[#403832]" : "",
        !assistant ? "ml-8 bg-[#211c18] text-white" : "",
      ].join(" ")}
    >
      <p>{message.content}</p>
      {message.model ? (
        <p className={assistant && !first ? "mt-2 text-xs text-[#82766d]" : "mt-2 text-xs text-white/70"}>
          {message.model}
          {message.mocked ? " fallback" : ""}
        </p>
      ) : null}
    </div>
  );
}

function Composer({
  value,
  running,
  onChange,
  onSubmit,
}: {
  value: string;
  running: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const defaultText = useMemo(
    () =>
      "Make the remix feel more like a late-night hackathon breakthrough while keeping the locked character consistent.",
    []
  );

  return (
    <div className="sticky bottom-4 z-10 mx-auto mt-4 w-full max-w-[760px] rounded-lg border border-[#ded8d2] bg-white p-2 shadow-[0_12px_36px_rgba(35,28,22,0.16)]">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          if (!value) onChange(defaultText);
        }}
        className="min-h-20 w-full resize-none rounded-md bg-[#fbfaf8] px-3 py-3 text-sm outline-none placeholder:text-[#aaa29b]"
        placeholder="How can I improve this remix?"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <ModeChip icon={Sparkles} label="Director" active />
        <ModeChip icon={FileText} label="Script" />
        <span className="ml-auto inline-flex h-8 items-center gap-2 rounded-md px-2 text-xs font-medium text-[#736960]">
          <Bot aria-hidden className="h-4 w-4" />
          gpt-5.4 mini
        </span>
        <button
          type="button"
          aria-label="Send remix prompt"
          onClick={onSubmit}
          disabled={running || !value.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8a8a8a] text-white hover:bg-[#211c18] disabled:opacity-45"
        >
          <Send aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ModeChip({ icon: Icon, label, active }: { icon: LucideIcon; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      className={[
        "inline-flex h-8 items-center gap-2 rounded-md px-2 text-xs font-semibold",
        active
          ? "border border-[#e0a371] bg-[#fff3ea] text-[#b95c1f]"
          : "text-[#8a8179] hover:bg-[#f2efec]",
      ].join(" ")}
    >
      <Icon aria-hidden className="h-4 w-4" />
      {label}
    </button>
  );
}

function createClientId() {
  return globalThis.crypto?.randomUUID?.() ?? `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
