// lib/ingest/tiktok.ts — TikTok URL → transcript, for the "import a video" flow.
//
// The draft generator treats `content` as raw text; it never fetches a URL. This
// module turns a TikTok link into actual transcript text so a draft can be made
// FROM a real video, not from the URL string. Three tiers, best-first:
//
//   1. Apify subtitles  — the video's real auto-captions (the true transcript)
//   2. LLM fallback      — no captions? infer a transcript from caption/metadata
//                          via the TrueFoundry gateway (OpenAI chat behind it)
//   3. Mock              — no keys at all → a stand-in so the flow still demos
//
// Everything degrades; this never throws. Feed the result to /api/draft as
// { source: "transcript", content: transcript }.

import { generateText } from "ai";
import { draftModel, BASE_MODEL, isGatewayConfigured } from "@/lib/gateway/client";

const APIFY_BASE = "https://api.apify.com/v2";
// clockworks/tiktok-scraper is the common one; override via env if you use another.
const TIKTOK_ACTOR = process.env.APIFY_TIKTOK_ACTOR || "clockworks~tiktok-scraper";

export type IngestMethod = "apify-subtitles" | "llm-fallback" | "mock";

export interface IngestResult {
  transcript: string;
  method: IngestMethod;
  caption?: string;
  provider: string; // for ClickHouse: apify | truefoundry | mock
}

export function isTikTokUrl(url: string): boolean {
  return /tiktok\.com/i.test(url);
}

// ---------------------------------------------------------------------------
// 1. Apify — run the actor synchronously and read its dataset items.
// run-sync-get-dataset-items blocks until the run finishes and returns the rows.
// ---------------------------------------------------------------------------
interface TikTokItem {
  text?: string; // the caption / description
  hashtags?: { name?: string }[];
  authorMeta?: { name?: string; nickName?: string };
  videoMeta?: { subtitleLinks?: { language?: string; downloadLink?: string }[] };
  subtitleLinks?: { language?: string; downloadLink?: string }[];
}

async function scrapeWithApify(url: string): Promise<TikTokItem | null> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return null;

  const res = await fetch(
    `${APIFY_BASE}/acts/${TIKTOK_ACTOR}/run-sync-get-dataset-items?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postURLs: [url],
        resultsPerPage: 1,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSubtitles: true,
      }),
    }
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Apify run failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  const items = (await res.json()) as TikTokItem[];
  return Array.isArray(items) && items.length ? items[0] : null;
}

// Strip WebVTT/SRT to plain text: drop the header, timestamps, cue numbers, and
// collapse the repeated lines TikTok auto-captions love to emit.
function subtitlesToText(raw: string): string {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        l !== "WEBVTT" &&
        !l.includes("-->") &&
        !/^\d+$/.test(l) &&
        !/^(NOTE|STYLE|REGION)/.test(l)
    );
  const out: string[] = [];
  for (const l of lines) if (out[out.length - 1] !== l) out.push(l); // dedupe consecutive
  return out.join(" ").replace(/<[^>]+>/g, "").trim();
}

async function subtitleTranscript(item: TikTokItem): Promise<string | null> {
  const links = item.videoMeta?.subtitleLinks ?? item.subtitleLinks ?? [];
  if (!links.length) return null;
  // Prefer English, else take the first available.
  const pick = links.find((l) => /^en/i.test(l.language ?? "")) ?? links[0];
  if (!pick?.downloadLink) return null;
  const res = await fetch(pick.downloadLink);
  if (!res.ok) return null;
  const text = subtitlesToText(await res.text());
  return text.length >= 40 ? text : null; // too short = not a real transcript
}

// ---------------------------------------------------------------------------
// 2. LLM fallback — no captions available. A text model can't watch the video,
// so we hand it everything we DID scrape (caption, hashtags, author) and ask it
// to reconstruct a plausible spoken transcript to draft from. Routes through the
// TrueFoundry gateway, same as drafting.
// ---------------------------------------------------------------------------
async function llmTranscript(url: string, item: TikTokItem | null): Promise<string | null> {
  if (!isGatewayConfigured) return null;
  const caption = item?.text ?? "";
  const tags = (item?.hashtags ?? []).map((h) => h.name).filter(Boolean).join(", ");
  const author = item?.authorMeta?.nickName ?? item?.authorMeta?.name ?? "";
  const { text } = await generateText({
    model: draftModel(BASE_MODEL),
    prompt:
      `You are reconstructing the spoken script of a short-form TikTok ad video so it can be remixed into a new ad.\n` +
      `Only the metadata below is available (no audio). Infer a concise, natural first-person transcript of what the creator likely says on camera — 3-6 sentences, no timestamps, no commentary.\n\n` +
      `URL: ${url}\n` +
      (caption ? `Caption: ${caption}\n` : "") +
      (tags ? `Hashtags: ${tags}\n` : "") +
      (author ? `Creator: ${author}\n` : ""),
  });
  const t = text.trim();
  return t.length >= 40 ? t : null;
}

// ---------------------------------------------------------------------------
// Orchestrator — best transcript we can get, with the method that produced it.
// ---------------------------------------------------------------------------
export async function ingestTikTok(url: string): Promise<IngestResult> {
  let item: TikTokItem | null = null;
  try {
    item = await scrapeWithApify(url);
    const subs = item ? await subtitleTranscript(item) : null;
    if (subs) {
      return { transcript: subs, method: "apify-subtitles", caption: item?.text, provider: "apify" };
    }
  } catch (err) {
    console.error("[ingest] apify failed, falling back to LLM", err);
  }

  const llm = await llmTranscript(url, item).catch((err) => {
    console.error("[ingest] llm fallback failed", err);
    return null;
  });
  if (llm) {
    return { transcript: llm, method: "llm-fallback", caption: item?.text, provider: "truefoundry" };
  }

  // Nothing configured — a stand-in so the import flow still demos with zero keys.
  return {
    transcript:
      "Still drinking yesterday's coffee? There's a smoother way to wake up — cold-brewed for 18 hours, never bitter, smooth energy with no crash. Find your smooth.",
    method: "mock",
    provider: "mock",
  };
}
