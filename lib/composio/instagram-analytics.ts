import { Composio } from "@composio/core";

export type InstagramProfile = {
  id: string;
  username: string;
  accountType: string;
  followers: number;
  following: number;
  mediaCount: number;
  website: string;
};

export type InstagramPostAnalytics = {
  id: string;
  title: string;
  mediaType: string;
  permalink?: string;
  timestamp?: string;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saved: number;
  totalInteractions: number;
};

export type InstagramAnalyticsSnapshot = {
  live: boolean;
  source: "composio-instagram" | "mock";
  generatedAt: string;
  profile: InstagramProfile;
  posts: InstagramPostAnalytics[];
  error?: string;
};

const DEFAULT_COMPOSIO_USER_ID = "ad-factory-demo-user";
const DEFAULT_METRICS = "views,reach,likes,comments,shares,saved,total_interactions";

type UnknownRecord = Record<string, unknown>;

export async function fetchInstagramAnalytics(): Promise<InstagramAnalyticsSnapshot> {
  const apiKey = getComposioApiKey();
  const userId = process.env.COMPOSIO_USER_ID ?? DEFAULT_COMPOSIO_USER_ID;
  const igUserId = process.env.INSTAGRAM_IG_USER_ID;

  if (!apiKey || !igUserId) {
    return mockInstagramAnalyticsSnapshot("Missing COMPOSIO_API_KEY/COMPOSIO_API or INSTAGRAM_IG_USER_ID.");
  }

  try {
    const composio = new Composio({ apiKey });
    const common = {
      userId,
      dangerouslySkipVersionCheck: true,
    };

    const profileData = asRecord(
      await executeComposioTool(composio, "INSTAGRAM_GET_USER_INFO", common, {
        ig_user_id: igUserId,
      })
    );

    const mediaData = await executeComposioTool(composio, "INSTAGRAM_GET_IG_USER_MEDIA", common, {
      ig_user_id: igUserId,
      limit: 4,
      fields: "id,caption,media_type,permalink,timestamp,like_count,comments_count",
    });
    const mediaRows = normalizeRows(mediaData);

    const posts = await Promise.all(
      mediaRows.map(async (media) => {
        const mediaId = stringValue(media.id);
        const base = {
          id: mediaId,
          title: titleFromCaption(stringValue(media.caption), mediaId),
          mediaType: stringValue(media.media_type, "UNKNOWN"),
          permalink: optionalString(media.permalink),
          timestamp: optionalString(media.timestamp),
          views: 0,
          reach: 0,
          likes: numberValue(media.like_count),
          comments: numberValue(media.comments_count),
          shares: 0,
          saved: 0,
          totalInteractions: numberValue(media.like_count) + numberValue(media.comments_count),
        };

        if (!mediaId) return base;

        try {
          const insightRows = normalizeRows(
            await executeComposioTool(composio, "INSTAGRAM_GET_IG_MEDIA_INSIGHTS", common, {
              ig_media_id: mediaId,
              metric: DEFAULT_METRICS,
            })
          );
          const insights = insightMap(insightRows);

          return {
            ...base,
            views: insights.views ?? base.views,
            reach: insights.reach ?? base.reach,
            likes: insights.likes ?? base.likes,
            comments: insights.comments ?? base.comments,
            shares: insights.shares ?? base.shares,
            saved: insights.saved ?? base.saved,
            totalInteractions: insights.total_interactions ?? base.totalInteractions,
          };
        } catch {
          return base;
        }
      })
    );

    return {
      live: true,
      source: "composio-instagram",
      generatedAt: new Date().toISOString(),
      profile: {
        id: stringValue(profileData.id, igUserId),
        username: stringValue(profileData.username, "instagram"),
        accountType: stringValue(profileData.account_type, "UNKNOWN"),
        followers: numberValue(profileData.followers_count),
        following: numberValue(profileData.follows_count),
        mediaCount: numberValue(profileData.media_count),
        website: stringValue(profileData.website),
      },
      posts,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Instagram analytics fetch failed.";
    return mockInstagramAnalyticsSnapshot(message);
  }
}

function getComposioApiKey() {
  return process.env.COMPOSIO_API_KEY ?? process.env.COMPOSIO_API ?? "";
}

async function executeComposioTool(
  composio: Composio,
  slug: string,
  common: { userId: string; dangerouslySkipVersionCheck: boolean },
  args: UnknownRecord
) {
  const result = await composio.tools.execute(slug, {
    ...common,
    arguments: args,
  });

  if (result.error) {
    throw new Error(typeof result.error === "string" ? result.error : JSON.stringify(result.error));
  }

  const parsed = typeof result.data === "string" ? JSON.parse(result.data) : result.data;
  return asRecord(parsed).data ?? parsed;
}

function normalizeRows(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value) && Array.isArray(value.data)) return value.data.filter(isRecord);
  return [];
}

function insightMap(rows: UnknownRecord[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const name = stringValue(row.name);
    const values = Array.isArray(row.values) ? row.values : [];
    const first = isRecord(values[0]) ? values[0] : {};
    if (name) acc[name] = numberValue(first.value);
    return acc;
  }, {});
}

function titleFromCaption(caption: string, fallbackId: string) {
  const cleaned = caption.replace(/\s+/g, " ").trim();
  if (cleaned) return cleaned.slice(0, 72);
  return fallbackId ? `Instagram media ${fallbackId.slice(-6)}` : "Instagram media";
}

function mockInstagramAnalyticsSnapshot(error?: string): InstagramAnalyticsSnapshot {
  return {
    live: false,
    source: "mock",
    generatedAt: new Date().toISOString(),
    error,
    profile: {
      id: "36384071171240273",
      username: "homenshum",
      accountType: "MEDIA_CREATOR",
      followers: 1308,
      following: 1803,
      mediaCount: 95,
      website: "http://homenshum.com",
    },
    posts: [
      {
        id: "18135852964551018",
        title: "Couch reel",
        mediaType: "VIDEO",
        views: 1255,
        reach: 546,
        likes: 7,
        comments: 0,
        shares: 5,
        saved: 0,
        totalInteractions: 12,
      },
      {
        id: "woo-reel",
        title: "Woo reel",
        mediaType: "VIDEO",
        views: 964,
        reach: 375,
        likes: 13,
        comments: 3,
        shares: 0,
        saved: 0,
        totalInteractions: 16,
      },
      {
        id: "reflections",
        title: "Reflections",
        mediaType: "IMAGE",
        views: 0,
        reach: 465,
        likes: 37,
        comments: 0,
        shares: 0,
        saved: 0,
        totalInteractions: 37,
      },
      {
        id: "kloud",
        title: "Kloud",
        mediaType: "IMAGE",
        views: 0,
        reach: 592,
        likes: 46,
        comments: 0,
        shares: 0,
        saved: 0,
        totalInteractions: 46,
      },
    ],
  };
}

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
