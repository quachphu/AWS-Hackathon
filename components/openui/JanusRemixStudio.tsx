"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChatProvider, openAIResponsesAdapter } from "@openuidev/react-headless";
import { Renderer, type OpenUIError } from "@openuidev/react-lang";
import { ArtifactPortalTarget } from "@openuidev/react-ui";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUp,
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
  Trash2,
  Upload,
  Video,
  type LucideIcon,
} from "lucide-react";
import { JANUS_REMIX_ARTIFACT_PROGRAM } from "@/lib/openui/janus-programs";
import { janusOpenUiLibrary } from "@/components/openui/janus-openui-library";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  saveProject,
  type RemixMessage,
  type RemixProject,
  type RemixTab,
} from "@/lib/remix/store";

type StudioView = "import" | "library" | "remix";

const TAB_LABELS: Record<RemixTab, string> = {
  source: "Source",
  image: "Image",
  video: "Video",
};


const initialMessagesByTab: Record<RemixTab, RemixMessage[]> = {
  source: [
    {
      id: "source-seed",
      role: "assistant",
      content:
        "orange and white flame-style embroidery, thin dark mustache, small dark soul patch, dewy finish, full natural eyebrows, and squinted eyes, wearing a dark grey short-sleeved t-shirt, silver-toned curb link chain necklace, and small silver-toned stud earrings, leans forward at a cluttered desk in a dimly lit hackathon space.",
    },
    {
      id: "source-context",
      role: "assistant",
      content:
        "Here is your render prompt for the intense hackathon moment. Keep the locked character, preserve the laptop-screen light, and use the teacher/student/lunch-lady line as the absurd contrast that makes the TikTok remix memorable.",
    },
  ],
  image: [
    {
      id: "image-seed",
      role: "assistant",
      content:
        "Image chat. Describe the still you want and I'll tune the image prompt — framing, lighting, and the locked character stay consistent. Hit Generate image when the prompt feels right.",
    },
  ],
  video: [
    {
      id: "video-seed",
      role: "assistant",
      content:
        "Video chat. Tell me how the shot should move — pacing, camera, the beat to hold on. I'll shape the video prompt for a single short clip you can render from this frame.",
    },
  ],
};

export function JanusRemixStudio() {
  const pathname = usePathname();
  const router = useRouter();
  const currentView = getStudioView(pathname);
  const projectId = getProjectId(pathname);
  const [activeTab, setActiveTab] = useState<RemixTab>("source");
  const [messagesByTab, setMessagesByTab] =
    useState<Record<RemixTab, RemixMessage[]>>(initialMessagesByTab);
  const [composer, setComposer] = useState("");
  const [running, setRunning] = useState(false);
  // The frame the user pinned (via the star) to seed the video render. null = nothing pinned.
  const [pinnedFrameUrl, setPinnedFrameUrl] = useState<string | null>(null);
  // The original imported video link — shown + embedded on the Source tab.
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  // The remix project loaded from the library (null on the blank "/" view).
  const [project, setProject] = useState<RemixProject | null>(null);
  // Generated media for the loaded project — undefined until generated.
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  // Which tab is mid-generation, so the button + stage can show a loading state.
  const [generating, setGenerating] = useState<"image" | "video" | null>(null);

  const messages = messagesByTab[activeTab];

  // Load a saved remix project from the library when the route carries an id.
  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setImageUrl(undefined);
      setVideoUrl(undefined);
      setPinnedFrameUrl(null);
      return;
    }
    const loaded = getProject(projectId);
    if (!loaded) {
      setProject(null);
      setImageUrl(undefined);
      setVideoUrl(undefined);
      setPinnedFrameUrl(null);
      return;
    }
    setProject(loaded);
    setMessagesByTab(loaded.messagesByTab);
    setActiveTab(loaded.activeTab);
    setSourceUrl(loaded.importedLink || null);
    // Scope media to THIS project — a fresh project starts empty.
    setImageUrl(loaded.imageUrl);
    setVideoUrl(loaded.videoUrl);
    setPinnedFrameUrl(null);

    // Pre-fill the composer the first time a project is opened (no user turns yet).
    const hasUserTurn = Object.values(loaded.messagesByTab).some((thread) =>
      thread.some((message) => message.role === "user")
    );
    if (!hasUserTurn) {
      setComposer(
        loaded.transcript
          ? `Remix this imported video into a short-form ad.\n\nTranscript:\n${loaded.transcript}\n\nTranscribe the hook, preserve the strongest visual beat, and generate a Janus-style remix prompt.`
          : `Remix this imported video source: ${loaded.importedLink}\n\nTranscribe the hook, preserve the strongest visual beat, and generate a Janus-style remix prompt for a short-form ad.`
      );
    }
  }, [projectId]);

  // Persist conversation, active tab, and generated media back to the library.
  useEffect(() => {
    if (!project || project.id !== projectId) return;
    saveProject({
      ...project,
      messagesByTab,
      activeTab,
      imageUrl,
      videoUrl,
      thumbnailUrl: imageUrl ?? project.thumbnailUrl,
    });
  }, [messagesByTab, activeTab, imageUrl, videoUrl, project, projectId]);

  // Generate an image (live) or a video (async + poll) for the active tab,
  // scoped to this project. Prompt = the latest tuned message in the tab.
  async function runGenerate(kind: "image" | "video") {
    if (generating) return;
    const thread = messagesByTab[kind];
    const latest = [...thread].reverse().find((m) => m.content.trim().length > 0);
    const prompt = (latest?.content ?? composer ?? project?.transcript ?? project?.title ?? "").trim();
    if (!prompt) return;

    const shotId = `${projectId ?? "demo"}-${kind}`;
    setGenerating(kind);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          shotId,
          prompt,
          draftId: projectId ?? undefined,
          startImageUrl: kind === "video" ? pinnedFrameUrl ?? imageUrl : undefined,
        }),
      });
      if (!res.ok) throw new Error(`render failed (${res.status})`);

      if (kind === "image") {
        const { url } = (await res.json()) as { url: string };
        setImageUrl(url);
      } else {
        const { jobId } = (await res.json()) as { jobId: string };
        const url = await pollVideoJob(jobId);
        if (url) setVideoUrl(url);
      }
    } catch {
      // Swallow — the stage keeps its current (empty) state; demo keeps moving.
    } finally {
      setGenerating(null);
    }
  }

  async function sendPrompt(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed || running) return;

    // Each tab keeps its own conversation — capture the tab this prompt belongs to.
    const tab = activeTab;
    const thread = messagesByTab[tab];

    const userMessage: RemixMessage = {
      id: createClientId(),
      role: "user",
      content: trimmed,
    };

    const appendToTab = (message: RemixMessage) =>
      setMessagesByTab((current) => ({ ...current, [tab]: [...current[tab], message] }));

    appendToTab(userMessage);
    setComposer("");
    setRunning(true);

    try {
      const res = await fetch("/api/agent/remix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: tab,
          messages: [...thread, userMessage].map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      if (!res.ok) throw new Error(`agent failed (${res.status})`);

      const data = (await res.json()) as { output: string; model: string; mocked: boolean };
      appendToTab({
        id: createClientId(),
        role: "assistant",
        content: data.output,
        model: data.model,
        mocked: data.mocked,
      });
    } catch (error) {
      appendToTab({
        id: createClientId(),
        role: "assistant",
        content:
          error instanceof Error
            ? `Agent note: ${error.message}. Keep the remix moving with the current prompt artifact.`
            : "Agent note: the request failed. Keep the remix moving with the current prompt artifact.",
        mocked: true,
      });
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
        ) : (
          <>
            <section className="relative min-h-screen min-w-0 px-4 py-5 pb-5 lg:px-8 lg:pr-[410px]">
              <RemixHeader
                activeTab={activeTab}
                onTabChange={setActiveTab}
                title={project?.title ?? DEMO_TITLE}
                subtitle={project?.sourceLabel ?? DEMO_SUBTITLE}
                onBack={() => router.push("/library")}
                generating={generating}
                onGenerate={() => void runGenerate(activeTab === "video" ? "video" : "image")}
              />
              <MediaStage
                activeTab={activeTab}
                sourceUrl={sourceUrl}
                imageUrl={imageUrl}
                videoUrl={videoUrl}
                generating={generating}
                pinnedFrameUrl={pinnedFrameUrl}
                onTogglePin={(url) =>
                  setPinnedFrameUrl((current) => (current === url ? null : url))
                }
              />
              <Composer
                value={composer}
                running={running}
                onChange={setComposer}
                onSubmit={() => void sendPrompt(composer)}
              />
            </section>
            <RemixChatPanel
              activeTab={activeTab}
              messages={messages}
              running={running}
              onSend={(prompt) => void sendPrompt(prompt)}
            />
          </>
        )}
      </div>
    </main>
  );
}

// Fallback header copy for the blank "/" view (no project loaded yet).
const DEMO_TITLE =
  "@Kai Cenat this is my Audition. Teacher, student, lunch lady just lmk and me and";
const DEMO_SUBTITLE = "tiktok - @Kai Cenat this is my Audition. Teacher, student, lunch lady";

function getStudioView(pathname: string | null): StudioView {
  if (pathname?.startsWith("/import")) return "import";
  if (pathname?.startsWith("/library")) return "library";
  return "remix";
}

// "/remix/<id>" → the project id; "/" (blank remix) → null.
function getProjectId(pathname: string | null): string | null {
  const match = pathname?.match(/^\/remix\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function ImportView() {
  const router = useRouter();
  const [videoUrl, setVideoUrl] = useState("");
  const [importing, setImporting] = useState(false);

  async function submitImport() {
    const trimmed = videoUrl.trim();
    if (!trimmed || importing) return;

    setImporting(true);
    let transcript = "";
    let caption: string | undefined;
    try {
      // Scrape the link → transcript (Apify caption → gateway LLM analysis → mock).
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      if (res.ok) {
        const data = (await res.json()) as { transcript?: string; caption?: string };
        transcript = data.transcript ?? "";
        caption = data.caption;
      }
    } catch {
      // Non-Instagram or scrape failure — still create a project from the raw link.
    } finally {
      // Auto-create a remix project and open its editor. This is the library entry.
      const project = createProject({ importedLink: trimmed, transcript, caption });
      saveProject(project);
      setImporting(false);
      router.push(`/remix/${project.id}`);
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
  const router = useRouter();
  const [projects, setProjects] = useState<RemixProject[]>([]);

  // localStorage is client-only — read after mount to avoid hydration mismatch.
  useEffect(() => {
    setProjects(listProjects());
  }, []);

  function removeProject(id: string) {
    deleteProject(id);
    setProjects(listProjects());
  }

  return (
    <section className="min-h-screen min-w-0 px-4 py-10 lg:px-8">
      <div className="mx-auto w-full max-w-[1210px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-[#81776f]">Workspace</p>
            <h1 className="text-3xl font-semibold leading-tight">All remixes</h1>
            <p className="mt-2 max-w-[940px] text-sm text-[#81776f]">
              Every video you&apos;ve imported and remixed. Open one to keep editing, or import a new source.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/import")}
            className="inline-flex items-center gap-2 rounded-md bg-[#c95f14] px-3 py-2 text-sm font-semibold text-white hover:bg-[#ad500f]"
          >
            <Upload aria-hidden className="h-4 w-4" />
            Import a video
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="mt-6 flex min-h-[165px] flex-col items-center justify-center rounded-xl border border-[#e0dbd4] bg-white px-8 text-center shadow-[0_8px_24px_rgba(35,28,22,0.12)]">
            <Library aria-hidden className="h-9 w-9 text-[#c95f14]" />
            <p className="mt-5 max-w-[880px] text-sm text-[#81776f]">
              No remixes yet. Import a video to scrape its transcript and start a new remix — it&apos;ll show up
              here so you can come back to it.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <RemixCard
                key={project.id}
                project={project}
                onOpen={() => router.push(`/remix/${project.id}`)}
                onDelete={() => removeProject(project.id)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function RemixCard({
  project,
  onOpen,
  onDelete,
}: {
  project: RemixProject;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="group flex cursor-pointer flex-col rounded-xl border border-[#e0dbd4] bg-white text-left shadow-[0_8px_24px_rgba(35,28,22,0.08)] transition hover:border-[#d2a988] hover:shadow-[0_12px_30px_rgba(35,28,22,0.14)]"
    >
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-t-xl bg-[#ece9e6]">
        {project.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Sparkles aria-hidden className="h-8 w-8 text-[#c0b6ad]" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="inline-flex w-fit items-center rounded-full bg-[#fff4ea] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#c2682b]">
          {project.platform}
        </span>
        <h2 className="line-clamp-2 text-sm font-semibold leading-snug">{project.title}</h2>
        <p className="mt-auto flex items-center justify-between text-xs text-[#9a8f86]">
          <span>{formatTimestamp(project.updatedAt)}</span>
          <button
            type="button"
            aria-label="Delete remix"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="rounded-md p-1 text-[#b3a89f] opacity-0 transition hover:bg-[#f4efe9] hover:text-[#c0492b] group-hover:opacity-100"
          >
            <Trash2 aria-hidden className="h-4 w-4" />
          </button>
        </p>
      </div>
    </div>
  );
}

function formatTimestamp(ms: number): string {
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
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
          <p className="text-sm font-semibold">JanusLabs</p>
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
          label="Remixes"
          icon={Library}
          active={currentView === "library"}
          onClick={() => router.push("/library")}
        />
        <SidebarNavItem
          label="Remix"
          icon={Sparkles}
          active={currentView === "remix"}
          onClick={() => router.push("/")}
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

function RemixHeader({
  activeTab,
  onTabChange,
  title,
  subtitle,
  onBack,
  generating,
  onGenerate,
}: {
  activeTab: RemixTab;
  onTabChange: (tab: RemixTab) => void;
  title: string;
  subtitle: string;
  onBack: () => void;
  generating: "image" | "video" | null;
  onGenerate: () => void;
}) {
  return (
    <header className="mx-auto w-full max-w-[1050px]">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 text-sm text-[#746a62] hover:text-[#211c18]"
      >
        &lt; All remixes
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="max-w-[900px] text-2xl font-semibold leading-tight md:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-xs text-[#81776f]">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-[#e3b58e] bg-[#fff4ea] px-3 py-1.5 text-[10px] font-semibold uppercase text-[#c2682b]">
          <Lock aria-hidden className="h-3.5 w-3.5" />
          Locked character
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg bg-[#ece9e6] p-1">
          <TabButton
            icon={FileText}
            label={TAB_LABELS.source}
            active={activeTab === "source"}
            onClick={() => onTabChange("source")}
          />
          <TabButton
            icon={ImageIcon}
            label={TAB_LABELS.image}
            active={activeTab === "image"}
            onClick={() => onTabChange("image")}
          />
          <TabButton
            icon={Video}
            label={TAB_LABELS.video}
            active={activeTab === "video"}
            onClick={() => onTabChange("video")}
          />
        </div>
        {activeTab === "source" ? null : (
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating !== null}
            className="inline-flex items-center gap-2 rounded-md bg-[#c95f14] px-3 py-2 text-sm font-semibold text-white hover:bg-[#ad500f] disabled:cursor-not-allowed disabled:bg-[#c9c2bc]"
          >
            {activeTab === "video" ? (
              generating === "video" ? (
                <>
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                  Rendering video…
                </>
              ) : (
                <>
                  <Video aria-hidden className="h-4 w-4" />
                  Generate video
                </>
              )
            ) : generating === "image" ? (
              <>
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles aria-hidden className="h-4 w-4" />
                Generate image
              </>
            )}
          </button>
        )}
      </div>
    </header>
  );
}

function TabButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold transition",
        active ? "bg-white text-[#211c18] shadow-sm" : "text-[#726860] hover:bg-white/70",
      ].join(" ")}
    >
      <Icon aria-hidden className="h-4 w-4" />
      {label}
    </button>
  );
}

function MediaStage({
  activeTab,
  sourceUrl,
  imageUrl,
  videoUrl,
  generating,
  pinnedFrameUrl,
  onTogglePin,
}: {
  activeTab: RemixTab;
  sourceUrl: string | null;
  imageUrl: string | undefined;
  videoUrl: string | undefined;
  generating: "image" | "video" | null;
  pinnedFrameUrl: string | null;
  onTogglePin: (url: string) => void;
}) {
  const isPinned = Boolean(imageUrl) && pinnedFrameUrl === imageUrl;
  // The pin/download controls only make sense once there's a real generated frame.
  const showFrameControls = activeTab === "image" && Boolean(imageUrl);

  function downloadFrame() {
    if (!imageUrl) return;
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = "janus-frame.jpg";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <section className="mx-auto mt-4 w-full max-w-[1050px]">
      <div className="relative flex min-h-[560px] items-center justify-center bg-[#ebe8e4] px-4 py-5">
        {showFrameControls ? (
          <div className="absolute right-4 top-4 z-10 flex gap-2">
            <IconButton
              label={isPinned ? "Pinned as video frame" : "Pin as video frame"}
              icon={Star}
              active={isPinned}
              fillWhenActive
              onClick={() => imageUrl && onTogglePin(imageUrl)}
            />
            <IconButton label="Download frame" icon={Download} onClick={downloadFrame} />
          </div>
        ) : null}
        {activeTab === "source" ? (
          <SourceStage sourceUrl={sourceUrl} />
        ) : activeTab === "video" ? (
          <VideoStage
            videoUrl={videoUrl}
            generating={generating === "video"}
            pinned={Boolean(pinnedFrameUrl)}
          />
        ) : (
          <ImageStage imageUrl={imageUrl} generating={generating === "image"} />
        )}
      </div>
    </section>
  );
}

function ImageStage({
  imageUrl,
  generating,
}: {
  imageUrl: string | undefined;
  generating: boolean;
}) {
  // Empty state — a fresh remix has no generated image yet.
  if (!imageUrl) {
    return (
      <div className="flex aspect-[3/4] w-full max-w-[640px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#cfc7be] bg-[#f3f0ec] text-center text-[#857a70]">
        {generating ? (
          <>
            <Loader2 aria-hidden className="h-8 w-8 animate-spin text-[#c95f14]" />
            <p className="text-sm font-semibold text-[#5c554f]">Generating image…</p>
          </>
        ) : (
          <>
            <ImageIcon aria-hidden className="h-8 w-8 text-[#c0b6ad]" />
            <p className="text-sm font-semibold text-[#5c554f]">No image yet</p>
            <p className="max-w-xs text-xs">
              Tune the prompt in the chat, then hit Generate image to render the first still for this remix.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label="Generated remix frame"
      className="relative aspect-[3/4] w-full max-w-[640px] overflow-hidden bg-[#1d2c2b] bg-cover bg-center shadow-[0_24px_70px_rgba(30,25,20,0.18)]"
      style={{ backgroundImage: `url(${imageUrl})` }}
    >
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <p className="max-w-md text-sm font-semibold">Generated remix frame</p>
          <span className="rounded-md bg-white/15 px-2 py-1 text-xs">9:16</span>
        </div>
      </div>
    </div>
  );
}

function VideoStage({
  videoUrl,
  generating = false,
  pinned = false,
}: {
  videoUrl: string | undefined;
  generating?: boolean;
  pinned?: boolean;
}) {
  // Finished render — play it.
  if (videoUrl) {
    return (
      <div className="relative aspect-[3/4] w-full max-w-[640px] overflow-hidden bg-black shadow-[0_24px_70px_rgba(30,25,20,0.18)]">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video src={videoUrl} controls playsInline className="h-full w-full object-contain" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-end p-4">
          <span className="rounded-md bg-white/15 px-2 py-1 text-xs text-white">9:16</span>
        </div>
      </div>
    );
  }

  // Empty / rendering state — no leftover hero frame.
  return (
    <div className="relative aspect-[3/4] w-full max-w-[640px] overflow-hidden rounded-lg bg-[#13100d] shadow-[0_24px_70px_rgba(30,25,20,0.18)]">
      {pinned ? (
        <div className="absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-md bg-[#c95f14] px-2 py-1 text-xs font-semibold text-white shadow-sm">
          <Star aria-hidden className="h-3.5 w-3.5 fill-current" />
          Pinned frame
        </div>
      ) : null}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur">
          {generating ? (
            <Loader2 aria-hidden className="h-7 w-7 animate-spin" />
          ) : (
            <Play aria-hidden className="h-7 w-7" />
          )}
        </span>
        <p className="text-sm font-semibold">{generating ? "Rendering video…" : "Video render slot"}</p>
        <p className="max-w-xs text-center text-xs text-white/70">
          {generating
            ? "Kicked off a single short clip — polling for the finished render."
            : pinned
              ? "Using your pinned frame as the first frame. Hit Generate video to kick off a single short clip."
              : "Pin a frame on the Image tab to lock the first frame, then hit Generate video for a single short clip."}
        </p>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-end p-4">
        <span className="rounded-md bg-white/15 px-2 py-1 text-xs text-white">9:16</span>
      </div>
    </div>
  );
}

function SourceStage({ sourceUrl }: { sourceUrl: string | null }) {
  const embed = sourceUrl ? toEmbedUrl(sourceUrl) : null;

  return (
    <div className="w-full max-w-[640px] rounded-lg border border-[#ddd7d0] bg-white p-6 shadow-[0_24px_70px_rgba(30,25,20,0.12)]">
      <div className="flex items-center gap-2 text-[#9c4f24]">
        <FileText aria-hidden className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-wide">Source transcript</p>
      </div>
      <h3 className="mt-3 text-base font-semibold leading-snug text-[#211c18]">
        @Kai Cenat this is my Audition. Teacher, student, lunch lady just lmk and me and
      </h3>
      <p className="mt-3 text-sm leading-6 text-[#5c554f]">
        Imported from TikTok. The hook lands in the first two seconds, then the teacher / student / lunch-lady line
        carries the absurd contrast. Refine the source in the chat to reshape the render prompt before you move to
        the Image and Video tabs.
      </p>

      {embed ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-[#e2ddd7] bg-black">
          <iframe
            src={embed}
            title="Source video"
            className="aspect-[9/16] w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
          />
        </div>
      ) : null}

      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex max-w-full items-center gap-2 rounded-md border border-[#e0a371] bg-[#fff3ea] px-3 py-2 text-xs font-semibold text-[#b95c1f] hover:bg-[#ffe9d8]"
        >
          <Play aria-hidden className="h-4 w-4 shrink-0" />
          <span className="truncate">{embed ? "Open original video" : sourceUrl}</span>
        </a>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#80766e]">
        <span className="rounded-md bg-[#f1eeeb] px-2 py-1">source: tiktok</span>
        <span className="rounded-md bg-[#f1eeeb] px-2 py-1">locked character</span>
        <span className="rounded-md bg-[#f1eeeb] px-2 py-1">9:16</span>
      </div>
    </div>
  );
}

// Best-effort: turn a TikTok / YouTube / Instagram link into an embeddable player URL.
function toEmbedUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");

  // TikTok: https://www.tiktok.com/@user/video/<id> → https://www.tiktok.com/embed/v2/<id>
  if (host.endsWith("tiktok.com")) {
    const id = url.pathname.match(/\/video\/(\d+)/)?.[1];
    return id ? `https://www.tiktok.com/embed/v2/${id}` : null;
  }

  // YouTube (incl. Shorts + youtu.be) → https://www.youtube.com/embed/<id>
  if (host.endsWith("youtube.com")) {
    const id = url.searchParams.get("v") ?? url.pathname.match(/\/(?:shorts|embed)\/([\w-]+)/)?.[1];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  // Instagram Reels / posts → append /embed
  if (host.endsWith("instagram.com")) {
    const match = url.pathname.match(/\/(reel|reels|p|tv)\/([\w-]+)/);
    return match ? `https://www.instagram.com/${match[1]}/${match[2]}/embed` : null;
  }

  return null;
}

function IconButton({
  label,
  icon: Icon,
  onClick,
  active = false,
  fillWhenActive = false,
}: {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  active?: boolean;
  fillWhenActive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={onClick ? active : undefined}
      title={label}
      onClick={onClick}
      className={[
        "flex h-9 w-9 items-center justify-center rounded-md shadow-sm transition",
        active
          ? "bg-[#c95f14] text-white hover:bg-[#ad500f]"
          : "bg-[#726a62]/90 text-white hover:bg-[#211c18]",
      ].join(" ")}
    >
      <Icon
        aria-hidden
        className={["h-4 w-4", active && fillWhenActive ? "fill-current" : ""].join(" ")}
      />
    </button>
  );
}

function RemixChatPanel({
  activeTab,
  messages,
  running,
  onSend,
}: {
  activeTab: RemixTab;
  messages: RemixMessage[];
  running: boolean;
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
          <h2 className="text-sm font-semibold">{TAB_LABELS[activeTab]} chat</h2>
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
        <ChatProvider apiUrl="/api/agent/chat" streamProtocol={openAIResponsesAdapter()}>
          <Renderer
            library={janusOpenUiLibrary}
            response={JANUS_REMIX_ARTIFACT_PROGRAM}
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

// Poll a video render job until it's done/failed (or we give up). Returns the
// finished URL, or null on failure/timeout — the stage stays empty in that case.
async function pollVideoJob(jobId: string): Promise<string | null> {
  const deadline = Date.now() + 120_000; // generous cap; mock finishes in ~8s
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch(`/api/render?jobId=${encodeURIComponent(jobId)}`);
      const data = (await res.json()) as { status: string; url?: string };
      if (data.status === "done") return data.url ?? null;
      if (data.status === "failed") return null;
    } catch {
      return null;
    }
  }
  return null;
}
