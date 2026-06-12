// lib/ingest/instagram.ts — Instagram URL → transcript, for the "import a video" flow.
//
// Instagram posts/reels don't expose spoken-word subtitles, so the scrape gives
// us the caption + metadata and we lean on the gateway LLM to turn that into a
// usable script. Three tiers, best-first:
//
//   1. apify + LLM   — scrape caption/metadata, analyze into a transcript via the
//                      TrueFoundry gateway (OpenAI chat behind it)
//   2. apify caption — no gateway? return the scraped caption directly
//   3. mock          — no keys at all → a stand-in so the flow still demos
//
// Everything degrades; this never throws. Feed the result to /api/draft as
// { source: "transcript", content: transcript }.

import { generateText } from "ai";
import { draftModel, BASE_MODEL, isGatewayConfigured } from "@/lib/gateway/client";

const APIFY_BASE = "https://api.apify.com/v2";
// apify/instagram-scraper is the common one; override via env if you use another.
const IG_ACTOR = process.env.APIFY_INSTAGRAM_ACTOR || "apify~instagram-scraper";

export type IngestMethod = "apify-llm" | "apify-caption" | "llm-fallback" | "mock";

export interface IngestResult {
  transcript: string;
  method: IngestMethod;
  caption?: string;
  provider: string; // for ClickHouse: apify | truefoundry | mock
}

export function isInstagramUrl(url: string): boolean {
  return /instagram\.com/i.test(url);
}

// ---------------------------------------------------------------------------
// Apify — run the actor synchronously and read its dataset items.
// run-sync-get-dataset-items blocks until the run finishes and returns the rows.
// ---------------------------------------------------------------------------
interface IgItem {
  caption?: string;
  text?: string;
  hashtags?: (string | { name?: string })[];
  ownerUsername?: string;
  ownerFullName?: string;
}

async function scrapeWithApify(url: string): Promise<IgItem | null> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return null;

  const res = await fetch(
    `${APIFY_BASE}/acts/${IG_ACTOR}/run-sync-get-dataset-items?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directUrls: [url], resultsLimit: 1, addParentData: false }),
    }
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Apify run failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  const items = (await res.json()) as IgItem[];
  return Array.isArray(items) && items.length ? items[0] : null;
}

function captionOf(item: IgItem | null): string {
  return (item?.caption ?? item?.text ?? "").trim();
}

// ---------------------------------------------------------------------------
// LLM analysis — a text model can't watch the reel, so we hand it everything we
// scraped (caption, hashtags, creator) and ask it to reconstruct a plausible
// spoken transcript to draft from. Routes through the TrueFoundry gateway.
// ---------------------------------------------------------------------------
async function llmTranscript(url: string, item: IgItem | null): Promise<string | null> {
  if (!isGatewayConfigured) return null;
  const caption = captionOf(item);
  const tags = Array.isArray(item?.hashtags)
    ? item!.hashtags.map((h) => (typeof h === "string" ? h : h?.name)).filter(Boolean).join(", ")
    : "";
  const author = item?.ownerFullName ?? item?.ownerUsername ?? "";
  const { text } = await generateText({
    model: draftModel(BASE_MODEL),
    prompt:
      `You are reconstructing the spoken script of a short-form Instagram Reel so it can be remixed into a new ad.\n` +
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
export async function ingestInstagram(url: string): Promise<IngestResult> {
  let item: IgItem | null = null;
  try {
    item = await scrapeWithApify(url);
  } catch (err) {
    console.error("[ingest] apify failed", err);
  }
  const caption = captionOf(item);

  // Analyze the scraped caption/metadata into a clean script via the gateway LLM.
  const llm = await llmTranscript(url, item).catch((err) => {
    console.error("[ingest] llm analysis failed", err);
    return null;
  });
  if (llm) {
    return {
      transcript: llm,
      method: caption ? "apify-llm" : "llm-fallback",
      caption: caption || undefined,
      provider: "truefoundry",
    };
  }

  // No gateway but we scraped a caption — use it directly.
  if (caption) {
    return { transcript: caption, method: "apify-caption", caption, provider: "apify" };
  }

  // Nothing configured — a stand-in so the import flow still demos with zero keys.
  return {
    transcript:
      "Still drinking yesterday's coffee? There's a smoother way to wake up — cold-brewed for 18 hours, never bitter, smooth energy with no crash. Find your smooth.",
    method: "mock",
    provider: "mock",
  };
}
