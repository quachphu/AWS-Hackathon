import { Agent, run, setDefaultOpenAIKey } from "@openai/agents";
import {
  fetchInstagramAnalytics,
  type InstagramPostAnalytics,
  type InstagramAnalyticsSnapshot,
} from "@/lib/composio/instagram-analytics";
import { currentAgentModelSettings, getAgentModel, getOpenAIApiKey } from "@/lib/openai/remix-agent";

export type InstagramAnalyticsAgentResult = {
  live: boolean;
  mocked: boolean;
  model: string;
  summary: string;
  recommendations: string[];
  program: string;
  snapshot: InstagramAnalyticsSnapshot;
};

const INSTAGRAM_ANALYTICS_INSTRUCTIONS = [
  "You are an Instagram analytics strategist for a hackathon demo.",
  "Use the supplied read-only Composio Instagram analytics data.",
  "Return strict JSON with keys summary and recommendations.",
  "recommendations must be an array of exactly three short strings.",
  "Do not claim anything was published. Do not invent account data.",
].join("\n");

export async function runInstagramAnalyticsAgent(): Promise<InstagramAnalyticsAgentResult> {
  const snapshot = await fetchInstagramAnalytics();
  const model = getAgentModel();
  const apiKey = getOpenAIApiKey();
  let mocked = true;
  let { summary, recommendations } = fallbackAnalyticsNarrative(snapshot);

  if (apiKey) {
    try {
      setDefaultOpenAIKey(apiKey);
      const agent = new Agent({
        name: "Harness Instagram Analytics Agent",
        instructions: INSTAGRAM_ANALYTICS_INSTRUCTIONS,
        model,
        modelSettings: currentAgentModelSettings(model),
      });
      const result = await run(agent, compactAnalyticsInput(snapshot), { maxTurns: 2 });
      const parsed = parseAgentJson(String(result.finalOutput ?? ""));
      summary = parsed.summary || summary;
      recommendations = parsed.recommendations.length > 0 ? parsed.recommendations.slice(0, 3) : recommendations;
      mocked = false;
    } catch {
      mocked = true;
    }
  }

  return {
    live: snapshot.live,
    mocked,
    model,
    summary,
    recommendations,
    program: buildInstagramAnalyticsProgram(snapshot, summary, recommendations),
    snapshot,
  };
}

function compactAnalyticsInput(snapshot: InstagramAnalyticsSnapshot) {
  return JSON.stringify({
    live: snapshot.live,
    profile: snapshot.profile,
    posts: snapshot.posts.map((post) => ({
      title: post.title,
      mediaType: post.mediaType,
      views: post.views,
      reach: post.reach,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      totalInteractions: post.totalInteractions,
    })),
  });
}

function fallbackAnalyticsNarrative(snapshot: InstagramAnalyticsSnapshot) {
  const topByViews = maxBy(snapshot.posts, (post) => post.views);
  const topByReach = maxBy(snapshot.posts, (post) => post.reach);

  return {
    summary: `${snapshot.profile.username} is a ${snapshot.profile.accountType} account with ${snapshot.profile.followers} followers. ${topByViews.title} is the strongest recent view signal at ${topByViews.views} views; ${topByReach.title} has the strongest reach at ${topByReach.reach}.`,
    recommendations: [
      "Anchor the next image prompt around the highest-view reel's immediate visual hook.",
      "Use reach winners as the reference set for character consistency and scene framing.",
      "Keep the publish path read-only until the user explicitly approves a live Instagram action.",
    ],
  };
}

function buildInstagramAnalyticsProgram(
  snapshot: InstagramAnalyticsSnapshot,
  summary: string,
  recommendations: string[]
) {
  const profile = snapshot.profile;
  const topViews = maxBy(snapshot.posts, (post) => post.views);
  const topReach = maxBy(snapshot.posts, (post) => post.reach);
  const totalInteractions = snapshot.posts.reduce((sum, post) => sum + post.totalInteractions, 0);
  const metrics = [
    { label: "Followers", value: formatNumber(profile.followers), detail: `${formatNumber(profile.following)} following` },
    { label: "Media", value: formatNumber(profile.mediaCount), detail: profile.accountType },
    { label: "Top views", value: formatNumber(topViews.views), detail: topViews.title },
    { label: "Top reach", value: formatNumber(topReach.reach), detail: topReach.title },
    { label: "Interactions", value: formatNumber(totalInteractions), detail: "recent sample" },
  ];
  const posts = snapshot.posts.map((post) => ({
    title: post.title,
    mediaType: post.mediaType,
    views: post.views,
    reach: post.reach,
    likes: post.likes,
    comments: post.comments,
    shares: post.shares,
    score: scorePost(post),
  }));

  return [
    `root = InstagramAnalyticsArtifact(${json("Instagram analytics")}, ${json(summary)}, ${json(profile.username)}, ${json(profile.accountType)}, ${json(`${formatNumber(profile.followers)} / ${formatNumber(profile.following)} / ${formatNumber(profile.mediaCount)}`)}, ${snapshot.live}, ${json(snapshot.generatedAt)}, ${JSON.stringify(metrics)}, ${JSON.stringify(posts)}, ${JSON.stringify(recommendations)})`,
  ].join("\n");
}

function parseAgentJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as { summary?: unknown; recommendations?: unknown };
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.filter((item): item is string => typeof item === "string")
        : [],
    };
  } catch {
    return { summary: "", recommendations: [] };
  }
}

function maxBy(posts: InstagramAnalyticsSnapshot["posts"], score: (post: InstagramPostAnalytics) => number) {
  return posts.reduce((best, post) => (score(post) > score(best) ? post : best), posts[0] ?? emptyPost());
}

function emptyPost(): InstagramPostAnalytics {
  return {
    id: "empty",
    title: "No media",
    mediaType: "UNKNOWN",
    views: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saved: 0,
    totalInteractions: 0,
  };
}

function scorePost(post: InstagramPostAnalytics) {
  return Math.min(99, Math.round(post.reach / 8 + post.views / 20 + post.totalInteractions * 1.5));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function json(value: string) {
  return JSON.stringify(value);
}
