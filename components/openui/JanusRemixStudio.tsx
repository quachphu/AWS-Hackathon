"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChatProvider, openAIResponsesAdapter } from "@openuidev/react-headless";
import { Renderer, type OpenUIError } from "@openuidev/react-lang";
import { ArtifactPortalTarget } from "@openuidev/react-ui";
import {
  Bot,
  ChevronDown,
  Download,
  FileText,
  Image as ImageIcon,
  Library,
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
import { JANUS_REMIX_ARTIFACT_PROGRAM } from "@/lib/openui/janus-programs";
import { janusOpenUiLibrary } from "@/components/openui/janus-openui-library";

type RemixMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  mocked?: boolean;
  model?: string;
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

export function JanusRemixStudio() {
  const [messages, setMessages] = useState<RemixMessage[]>(initialMessages);
  const [composer, setComposer] = useState("");
  const [running, setRunning] = useState(false);

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
        <StudioSidebar />
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
          onSend={(prompt) => void sendPrompt(prompt)}
        />
      </div>
    </main>
  );
}

function StudioSidebar() {
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
        <SidebarNavItem label="Import" icon={Upload} />
        <SidebarNavItem label="Library" icon={Library} />
        <SidebarNavItem label="Remix" icon={Sparkles} active />
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
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
}) {
  return (
    <button
      type="button"
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
  onSend,
}: {
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
        <ModeChip icon={SlidersHorizontal} label="Think" />
        <span className="ml-auto inline-flex h-8 items-center gap-2 rounded-md px-2 text-xs font-medium text-[#736960]">
          <Bot aria-hidden className="h-4 w-4" />
          gpt-5.4 mini
        </span>
        <IconButton label="Preview video" icon={Play} />
        <IconButton label="Settings" icon={Settings} />
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
