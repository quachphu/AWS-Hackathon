/**
 * Client-side remix-project library, persisted in localStorage.
 *
 * A "remix project" is one imported source (URL → transcript) plus the chat the
 * user builds on top of it. There is no server of record — this is the hackathon
 * "DELETE by default" path: survive a refresh, list past remixes on the library
 * page, reopen one to keep editing. All reads/writes are no-ops during SSR.
 */

export type RemixMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  mocked?: boolean;
  model?: string;
};

export type RemixProject = {
  id: string;
  title: string; // ad concept / headline shown in the editor + library card
  sourceLabel: string; // e.g. "instagram - @handle ..."
  platform: string; // "instagram" | "tiktok" | "youtube" | "video"
  importedLink: string;
  transcript: string;
  createdAt: number;
  updatedAt: number;
  messages: RemixMessage[];
  // Generated media for THIS project — undefined until the user generates it.
  imageUrl?: string;
  videoUrl?: string;
};

const STORAGE_KEY = "visual-remix-projects";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function newId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `rmx_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
}

/** Every project in the library, newest activity first. */
export function listProjects(): RemixProject[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RemixProject[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function getProject(id: string): RemixProject | null {
  return listProjects().find((p) => p.id === id) ?? null;
}

/** Insert or update a project, then bump it to the top by updatedAt. */
export function saveProject(project: RemixProject): void {
  if (!canUseStorage()) return;
  const others = listProjects().filter((p) => p.id !== project.id);
  const next = [{ ...project, updatedAt: Date.now() }, ...others];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota or serialization failure — drop silently; the demo keeps moving.
  }
}

export function deleteProject(id: string): void {
  if (!canUseStorage()) return;
  const next = listProjects().filter((p) => p.id !== id);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("instagram.")) return "instagram";
  if (u.includes("tiktok.")) return "tiktok";
  if (u.includes("youtube.") || u.includes("youtu.be")) return "youtube";
  return "video";
}

/** First non-empty line of the caption, else the transcript, else the link. */
function deriveTitle(transcript: string, caption: string | undefined, link: string): string {
  const candidate = (caption || transcript || link).trim();
  const firstLine = candidate.split(/\r?\n/).find((line) => line.trim().length > 0) ?? link;
  const clean = firstLine.trim();
  return clean.length > 90 ? `${clean.slice(0, 90).trimEnd()}…` : clean || "Untitled remix";
}

/** Build a fresh project from an import result (not yet persisted). */
export function createProject(input: {
  importedLink: string;
  transcript: string;
  caption?: string;
}): RemixProject {
  const platform = detectPlatform(input.importedLink);
  const title = deriveTitle(input.transcript, input.caption, input.importedLink);
  const labelSource = (input.caption || input.transcript || input.importedLink).trim();
  const labelSnippet =
    labelSource.length > 70 ? `${labelSource.slice(0, 70).trimEnd()}…` : labelSource;
  const now = Date.now();

  return {
    id: newId(),
    title,
    sourceLabel: `${platform} - ${labelSnippet}`,
    platform,
    importedLink: input.importedLink,
    transcript: input.transcript,
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: "source-seed",
        role: "assistant",
        content: input.transcript
          ? `Imported transcript is ready. Refine it in chat, then move to the Image and Video tabs to render your remix.`
          : `Imported source link is ready. Describe the remix you want and I'll shape the render prompt.`,
      },
    ],
  };
}
