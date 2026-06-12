import type { DraftModelConfig } from "@/lib/gateway/models";

export type ProgramMode = "default" | "analytics" | "dev";
export type OpenUIPrograms = Record<ProgramMode, string>;

type ProgramSelection = {
  mode: ProgramMode;
  response: string;
};

export function buildOpenUiPrograms(modelConfig: DraftModelConfig): OpenUIPrograms {
  return {
    default: buildDefaultProgram(modelConfig),
    analytics: buildAnalyticsProgram(modelConfig),
    dev: buildDevLoopProgram(modelConfig),
  };
}

export function openUiProgramForPrompt(prompt: string, programs: OpenUIPrograms): ProgramSelection {
  const normalized = prompt.toLowerCase();

  if (
    normalized.includes("dev") ||
    normalized.includes("judge") ||
    normalized.includes("workflow") ||
    normalized.includes("requirement") ||
    normalized.includes("trace")
  ) {
    return { mode: "dev", response: programs.dev };
  }

  if (
    normalized.includes("cost") ||
    normalized.includes("analytics") ||
    normalized.includes("metric") ||
    normalized.includes("tiktok") ||
    normalized.includes("pioneer")
  ) {
    return { mode: "analytics", response: programs.analytics };
  }

  return { mode: "default", response: programs.default };
}

function buildDefaultProgram(modelConfig: DraftModelConfig) {
  const defaultModel = modelConfig.defaultModelId;
  const baseModel = modelForRole(modelConfig, "base");
  const pioneerModel = modelForRole(modelConfig, "pioneer");
  const baseModelLabel = modelLabelForRole(modelConfig, "base");
  const pioneerModelLabel = modelLabelForRole(modelConfig, "pioneer");
  const fallbackText = modelConfig.gatewayConfigured
    ? `Gateway default: ${defaultModel}`
    : `Gateway fallback: ${modelConfig.fallbackModelId}`;

  return `root = AppFrame("Ad Factory", "OpenUI default state stored in repo and rendered with @openuidev/react-lang.", nav, [hero, creator, lower])
nav = [{ label: "Studio", section: "creator", active: true, detail: "Remix surface" }, { label: "Analytics", section: "analytics", active: false, detail: "OpenUI generated" }, { label: "Dev loop", section: "dev", active: false, detail: "Workflow status" }, { label: "Publish", section: "publish", active: false, detail: "Composio ready" }]
hero = SectionHeader("C lane: Frontend and demo", "OpenUI production console", "The first screen is no longer hand-built React markup. It is an OpenUI Lang program that renders repo-owned components for creator workflow, analytics, and the dev-loop panel.", ["zero auth", "zero app DB", ${quoted(fallbackText)}, "Render deployable"])
creator = CreatorWorkspace("Remix selected", "TikTok transcript or topic", "a cold brew brand for people who hate the 2pm crash", "Still drinking yesterday's coffee?", "Aurora Cold Brew. Find your smooth.", ${quoted(defaultModel)}, "https://picsum.photos/seed/openui-remix-preview/720/1280", [{ id: "shot_1", duration: 3, script: "7am. The alarm wins again. Yesterday's coffee stares back.", imagePrompt: "dim early-morning kitchen, stale coffee mug, cinematic light", videoPrompt: "slow push-in on stale coffee as morning light moves across the counter", text: "7:00 AM. Again." }, { id: "shot_2", duration: 4, script: "Cold-brewed for 18 hours, never bitter.", imagePrompt: "cold brew bottle with condensation on marble counter", videoPrompt: "slow orbit around chilled bottle with sunlight flare", text: "18-hour cold brew" }, { id: "shot_3", duration: 4, script: "Smooth energy through the 2pm wall.", imagePrompt: "confident creator crossing modern office with iced coffee", videoPrompt: "tracking shot through bright office, energetic camera move", text: "No crash. No jitters." }, { id: "shot_4", duration: 3, script: "Find your smooth.", imagePrompt: "premium cold brew hero bottle on studio pedestal", videoPrompt: "hero dolly-in with aurora colored light sweep", text: "Find your smooth." }])
lower = PanelGrid([analytics, devloop, pipeline])
analytics = AnalyticsPanel("OpenUI analytics", ${quoted(`Cost, TikTok fit, and model comparison use configured model IDs: ${baseModel} vs ${pioneerModel}.`)}, [{ label: "Draft model", value: ${quoted(pioneerModel)}, detail: "selected default", tone: "good" }, { label: "Base model", value: ${quoted(baseModel)}, detail: "comparison row", tone: "neutral" }, { label: "TikTok fit", value: "82", detail: "hook score", tone: "good" }, { label: "Latency", value: "1.4s", detail: "draft path", tone: "warn" }], [{ label: ${quoted(baseModelLabel)}, value: 74 }, { label: ${quoted(pioneerModelLabel)}, value: 91 }, { label: ${quoted(modelConfig.fallbackModelId)}, value: 58 }])
devloop = DevLoopPanel("Dev-loop readiness", "Background requirements and judge loops stay visible without adding auth or a transactional DB.", [{ label: "OpenUI renderer owns default state", status: "pass", evidence: "lib/openui/programs.ts" }, { label: "No product auth or app DB", status: "pass", evidence: "browser state + ClickHouse events only" }, { label: "Draft trace model", status: "pass", evidence: ${quoted(`request ${defaultModel}; fallback ${modelConfig.fallbackModelId}`)} }, { label: "TikTok OAuth via Composio", status: "mock", evidence: "publish card remains cut-first" }])
pipeline = PipelinePanel("Sponsor pipeline", [{ label: "TrueFoundry", detail: "Gateway in front of model calls", state: "wired" }, { label: "Draft model", detail: ${quoted(pioneerModel)}, state: "configured" }, { label: "OpenUI", detail: "Default UI, analytics, generative UI", state: "live" }, { label: "ClickHouse", detail: "Append-only event warehouse", state: "wired" }, { label: "Composio", detail: "TikTok connect and publish", state: "mock" }])`;
}

function buildAnalyticsProgram(modelConfig: DraftModelConfig) {
  const baseModel = modelForRole(modelConfig, "base");
  const pioneerModel = modelForRole(modelConfig, "pioneer");
  const baseModelLabel = modelLabelForRole(modelConfig, "base");
  const pioneerModelLabel = modelLabelForRole(modelConfig, "pioneer");

  return `root = AppFrame("Ad Factory Analytics", "Generated OpenUI analytics response from the local mock generator.", nav, [hero, analytics, pipeline])
nav = [{ label: "Studio", section: "creator", active: false, detail: "Remix surface" }, { label: "Analytics", section: "analytics", active: true, detail: "Generated view" }, { label: "Dev loop", section: "dev", active: false, detail: "Workflow status" }]
hero = SectionHeader("Generative analytics", "Why this remix is worth shipping", "This OpenUI program is returned by /api/openui/generate today. Later the same endpoint can ask TrueFoundry/Pioneer to emit OpenUI Lang using the registered component library.", ["OpenUI Lang", "ClickHouse shaped", "TikTok ready"])
analytics = AnalyticsPanel("Cost and engagement readout", ${quoted(`${pioneerModel} is the demo winner if it keeps draft cost low while preserving TikTok hook quality.`)}, [{ label: "Default draft", value: ${quoted(pioneerModel)}, detail: "configured model", tone: "good" }, { label: "Base draft", value: ${quoted(baseModel)}, detail: "comparison model", tone: "warn" }, { label: "Hook retention", value: "71%", detail: "mock TikTok curve", tone: "good" }, { label: "Fallback", value: ${quoted(modelConfig.fallbackModelId)}, detail: "when gateway env is missing", tone: "neutral" }], [{ label: ${quoted(baseModelLabel)}, value: 38 }, { label: ${quoted(pioneerModelLabel)}, value: 86 }, { label: ${quoted(modelConfig.fallbackModelId)}, value: 64 }, { label: "TikTok source", value: 72 }])
pipeline = PipelinePanel("Recommended next moves", [{ label: "Render one image live", detail: "Low latency, judge-visible", state: "now" }, { label: "Start video async", detail: "Poll while explaining costs", state: "now" }, { label: "Show ClickHouse chart", detail: ${quoted(`Split by ${baseModel} and ${pioneerModel}`)}, state: "next" }, { label: "Publish through Composio", detail: "Cut-first if OAuth slips", state: "optional" }])`;
}

function buildDevLoopProgram(modelConfig: DraftModelConfig) {
  const baseModel = modelForRole(modelConfig, "base");
  const pioneerModel = modelForRole(modelConfig, "pioneer");

  return `root = AppFrame("Ad Factory Dev Loop", "Generated OpenUI dev-loop response from the local mock generator.", nav, [hero, devloop, pipeline])
nav = [{ label: "Studio", section: "creator", active: false, detail: "Remix surface" }, { label: "Analytics", section: "analytics", active: false, detail: "Generated view" }, { label: "Dev loop", section: "dev", active: true, detail: "Workflow status" }]
hero = SectionHeader("Render Workflow panel", "Requirements, grading, and judge readiness", "This is the UI contract for the background dev agent: extract chat, identify requirements, grade the implementation, run an LLM judge, and write the report to append-only events.", ["P0 gates", "mock workflow", "ClickHouse evidence"])
devloop = DevLoopPanel("Implementation gates", "The dev-loop view is intentionally visible in the demo UI so requirement drift is caught before the last hour.", [{ label: "Default state renders through OpenUI", status: "pass", evidence: "Renderer mounted on /" }, { label: "Stored OpenUI program committed", status: "pass", evidence: "lib/openui/programs.ts" }, { label: "Analytics uses OpenUI renderer", status: "pass", evidence: "AnalyticsPanel component" }, { label: "Trace request model", status: "pass", evidence: ${quoted(pioneerModel)} }, { label: "Trace comparison model", status: "pass", evidence: ${quoted(baseModel)} }])
pipeline = PipelinePanel("Loop tasks", [{ label: "Extract", detail: "Read chat, notes, CLAUDE.md, CONTRIBUTION.md", state: "ready" }, { label: "Grade", detail: "Compare P0/P1 requirements to UI and API traces", state: "mock" }, { label: "Judge", detail: "LLM quality and sponsor-story score", state: "mock" }, { label: "Report", detail: ${quoted(`Write model evidence for ${pioneerModel} to ClickHouse`)}, state: "mock" }])`;
}

function modelForRole(modelConfig: DraftModelConfig, role: "base" | "pioneer") {
  return modelConfig.models.find((model) => model.roles.includes(role))?.id ?? modelConfig.defaultModelId;
}

function modelLabelForRole(modelConfig: DraftModelConfig, role: "base" | "pioneer") {
  const modelId = modelForRole(modelConfig, role);
  return `${role === "pioneer" ? "Pioneer" : "Base"}: ${modelId}`;
}

function quoted(value: string) {
  return JSON.stringify(value);
}
