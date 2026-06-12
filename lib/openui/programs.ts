export const DEFAULT_OPENUI_PROGRAM = `root = AppFrame("Ad Factory", "OpenUI default state stored in repo and rendered with @openuidev/react-lang.", nav, [hero, creator, lower])
nav = [{ label: "Studio", section: "creator", active: true, detail: "Remix surface" }, { label: "Analytics", section: "analytics", active: false, detail: "OpenUI generated" }, { label: "Dev loop", section: "dev", active: false, detail: "Workflow status" }, { label: "Publish", section: "publish", active: false, detail: "Composio ready" }]
hero = SectionHeader("C lane: Frontend and demo", "OpenUI production console", "The first screen is no longer hand-built React markup. It is an OpenUI Lang program that renders repo-owned components for creator workflow, analytics, and the dev-loop panel.", ["zero auth", "zero app DB", "mock-first", "Render deployable"])
creator = CreatorWorkspace("Remix selected", "TikTok transcript or topic", "a cold brew brand for people who hate the 2pm crash", "Still drinking yesterday's coffee?", "Aurora Cold Brew. Find your smooth.", "mock-fallback", "https://picsum.photos/seed/openui-remix-preview/720/1280", [{ id: "shot_1", duration: 3, script: "7am. The alarm wins again. Yesterday's coffee stares back.", imagePrompt: "dim early-morning kitchen, stale coffee mug, cinematic light", videoPrompt: "slow push-in on stale coffee as morning light moves across the counter", text: "7:00 AM. Again." }, { id: "shot_2", duration: 4, script: "Cold-brewed for 18 hours, never bitter.", imagePrompt: "cold brew bottle with condensation on marble counter", videoPrompt: "slow orbit around chilled bottle with sunlight flare", text: "18-hour cold brew" }, { id: "shot_3", duration: 4, script: "Smooth energy through the 2pm wall.", imagePrompt: "confident creator crossing modern office with iced coffee", videoPrompt: "tracking shot through bright office, energetic camera move", text: "No crash. No jitters." }, { id: "shot_4", duration: 3, script: "Find your smooth.", imagePrompt: "premium cold brew hero bottle on studio pedestal", videoPrompt: "hero dolly-in with aurora colored light sweep", text: "Find your smooth." }])
lower = PanelGrid([analytics, devloop, pipeline])
analytics = AnalyticsPanel("OpenUI analytics", "Cost, TikTok fit, and model comparison are rendered by the same OpenUI renderer that owns the default state.", [{ label: "Draft cost", value: "$0.0011", detail: "Pioneer mock", tone: "good" }, { label: "Render cost", value: "$0.153", detail: "image + video", tone: "neutral" }, { label: "TikTok fit", value: "82", detail: "hook score", tone: "good" }, { label: "Latency", value: "1.4s", detail: "draft path", tone: "warn" }], [{ label: "Base model", value: 74 }, { label: "Pioneer", value: 91 }, { label: "Fallback", value: 58 }])
devloop = DevLoopPanel("Dev-loop readiness", "Background requirements and judge loops stay visible without adding auth or a transactional DB.", [{ label: "OpenUI renderer owns default state", status: "pass", evidence: "lib/openui/programs.ts" }, { label: "No product auth or app DB", status: "pass", evidence: "browser state + ClickHouse events only" }, { label: "Render Workflow trigger", status: "mock", evidence: "UI placeholder until backend lane lands" }, { label: "TikTok OAuth via Composio", status: "mock", evidence: "publish card remains cut-first" }])
pipeline = PipelinePanel("Sponsor pipeline", [{ label: "TrueFoundry", detail: "Gateway in front of model calls", state: "wired" }, { label: "Pioneer", detail: "Structured ad draft model", state: "mock" }, { label: "OpenUI", detail: "Default UI, analytics, generative UI", state: "live" }, { label: "ClickHouse", detail: "Append-only event warehouse", state: "wired" }, { label: "Composio", detail: "TikTok connect and publish", state: "mock" }])`;

export const ANALYTICS_OPENUI_PROGRAM = `root = AppFrame("Ad Factory Analytics", "Generated OpenUI analytics response from the local mock generator.", nav, [hero, analytics, pipeline])
nav = [{ label: "Studio", section: "creator", active: false, detail: "Remix surface" }, { label: "Analytics", section: "analytics", active: true, detail: "Generated view" }, { label: "Dev loop", section: "dev", active: false, detail: "Workflow status" }]
hero = SectionHeader("Generative analytics", "Why this remix is worth shipping", "This OpenUI program is returned by /api/openui/generate today. Later the same endpoint can ask TrueFoundry/Pioneer to emit OpenUI Lang using the registered component library.", ["OpenUI Lang", "ClickHouse shaped", "TikTok ready"])
analytics = AnalyticsPanel("Cost and engagement readout", "Pioneer is the demo winner if it keeps the draft cost low while preserving TikTok hook quality.", [{ label: "Pioneer cost", value: "$0.0011", detail: "74 percent under base", tone: "good" }, { label: "Base cost", value: "$0.0042", detail: "comparison row", tone: "warn" }, { label: "Hook retention", value: "71%", detail: "mock TikTok curve", tone: "good" }, { label: "Publish risk", value: "low", detail: "fallback video ready", tone: "neutral" }], [{ label: "Base", value: 38 }, { label: "Pioneer", value: 86 }, { label: "Video fallback", value: 64 }, { label: "TikTok source", value: 72 }])
pipeline = PipelinePanel("Recommended next moves", [{ label: "Render one image live", detail: "Low latency, judge-visible", state: "now" }, { label: "Start video async", detail: "Poll while explaining costs", state: "now" }, { label: "Show ClickHouse chart", detail: "Sponsor story stays load-bearing", state: "next" }, { label: "Publish through Composio", detail: "Cut-first if OAuth slips", state: "optional" }])`;

export const DEV_LOOP_OPENUI_PROGRAM = `root = AppFrame("Ad Factory Dev Loop", "Generated OpenUI dev-loop response from the local mock generator.", nav, [hero, devloop, pipeline])
nav = [{ label: "Studio", section: "creator", active: false, detail: "Remix surface" }, { label: "Analytics", section: "analytics", active: false, detail: "Generated view" }, { label: "Dev loop", section: "dev", active: true, detail: "Workflow status" }]
hero = SectionHeader("Render Workflow panel", "Requirements, grading, and judge readiness", "This is the UI contract for the background dev agent: extract chat, identify requirements, grade the implementation, run an LLM judge, and write the report to append-only events.", ["P0 gates", "mock workflow", "ClickHouse evidence"])
devloop = DevLoopPanel("Implementation gates", "The dev-loop view is intentionally visible in the demo UI so requirement drift is caught before the last hour.", [{ label: "Default state renders through OpenUI", status: "pass", evidence: "Renderer mounted on /" }, { label: "Stored OpenUI program committed", status: "pass", evidence: "lib/openui/programs.ts" }, { label: "Analytics uses OpenUI renderer", status: "pass", evidence: "AnalyticsPanel component" }, { label: "Real workflow execution", status: "mock", evidence: "Render backend lane pending" }, { label: "LLM judge screenshot grade", status: "mock", evidence: "needs browser capture + workflow" }])
pipeline = PipelinePanel("Loop tasks", [{ label: "Extract", detail: "Read chat, notes, CLAUDE.md, CONTRIBUTION.md", state: "ready" }, { label: "Grade", detail: "Compare P0/P1 requirements to UI and API traces", state: "mock" }, { label: "Judge", detail: "LLM quality and sponsor-story score", state: "mock" }, { label: "Report", detail: "Write evidence rows to ClickHouse", state: "mock" }])`;

export function openUiProgramForPrompt(prompt: string) {
  const normalized = prompt.toLowerCase();

  if (
    normalized.includes("dev") ||
    normalized.includes("judge") ||
    normalized.includes("workflow") ||
    normalized.includes("requirement")
  ) {
    return DEV_LOOP_OPENUI_PROGRAM;
  }

  if (
    normalized.includes("cost") ||
    normalized.includes("analytics") ||
    normalized.includes("metric") ||
    normalized.includes("tiktok") ||
    normalized.includes("pioneer")
  ) {
    return ANALYTICS_OPENUI_PROGRAM;
  }

  return DEFAULT_OPENUI_PROGRAM;
}
