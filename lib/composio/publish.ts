import { Composio } from "@composio/core";

export type PublishInput = {
  title: string;
  hook: string;
  cta: string;
  videoUrl: string | null;
  imageUrl?: string | null;
};

export type PublishResult = {
  ok: boolean;
  detail: string;
  tiktok?: { publish_id?: string };
  instagram?: { media_id?: string };
};

const USER_ID = process.env.COMPOSIO_USER_ID ?? "ad-factory-demo-user";
const INSTAGRAM_IG_USER_ID = process.env.INSTAGRAM_IG_USER_ID ?? "me";

// Accept either env name: COMPOSIO_API_KEY (canonical) or COMPOSIO_API (alias).
function getComposioApiKey() {
  return process.env.COMPOSIO_API_KEY ?? process.env.COMPOSIO_API;
}

// One client, direct tool execution. `composio.create(userId)` returns a Tool
// Router (MCP/agent) session, which is the wrong tool for a deterministic one-shot publish.
// `composio.tools.execute(slug, { userId, arguments })` is the documented path.
function getClient() {
  return new Composio({ apiKey: getComposioApiKey() });
}

async function publishToTikTok(input: PublishInput): Promise<PublishResult["tiktok"]> {
  if (!input.videoUrl) return undefined;

  const composio = getClient();
  const caption = `${input.hook}\n\n${input.cta}`.slice(0, 2200);

  const result = await composio.tools.execute("TIKTOK_PUBLISH_VIDEO", {
    userId: USER_ID,
    // @composio/core@0.10 throws ComposioToolVersionRequiredError when the
    // toolkit version resolves to "latest". Skip the gate for the demo; pin a
    // version (or set COMPOSIO_TOOLKIT_VERSION_TIKTOK) for production.
    dangerouslySkipVersionCheck: true,
    arguments: {
      video_url: input.videoUrl,
      caption,
      privacy_level: "SELF_ONLY",
      disable_duet: false,
      disable_stitch: false,
      disable_comment: false,
    },
  });

  if (result.error) throw new Error(`TikTok: ${result.error}`);

  const data = typeof result.data === "string" ? JSON.parse(result.data as string) : result.data;
  return { publish_id: data?.data?.publish_id };
}

async function publishToInstagram(input: PublishInput): Promise<PublishResult["instagram"]> {
  const mediaUrl = input.videoUrl ?? input.imageUrl;
  if (!mediaUrl) return undefined;

  const composio = getClient();
  const caption = `${input.hook}\n\n${input.cta}`.slice(0, 2200);
  const isVideo = !!input.videoUrl;

  const containerResult = await composio.tools.execute("INSTAGRAM_POST_IG_USER_MEDIA", {
    userId: USER_ID,
    dangerouslySkipVersionCheck: true,
    arguments: isVideo
      ? {
          ig_user_id: INSTAGRAM_IG_USER_ID,
          media_type: "REELS",
          video_url: mediaUrl,
          caption,
          share_to_feed: true,
        }
      : { ig_user_id: INSTAGRAM_IG_USER_ID, image_url: mediaUrl, caption },
  });

  if (containerResult.error) throw new Error(`Instagram container: ${containerResult.error}`);

  const containerData =
    typeof containerResult.data === "string"
      ? JSON.parse(containerResult.data as string)
      : containerResult.data;
  const creation_id: string = containerData?.id ?? containerData?.data?.id;

  if (!creation_id) throw new Error("Instagram: no creation_id returned");

  const publishResult = await composio.tools.execute("INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH", {
    userId: USER_ID,
    dangerouslySkipVersionCheck: true,
    arguments: { ig_user_id: INSTAGRAM_IG_USER_ID, creation_id },
  });

  if (publishResult.error) throw new Error(`Instagram publish: ${publishResult.error}`);

  const publishData =
    typeof publishResult.data === "string"
      ? JSON.parse(publishResult.data as string)
      : publishResult.data;
  return { media_id: publishData?.id ?? publishData?.data?.id };
}

export async function publishAd(
  input: PublishInput,
  targets: ("tiktok" | "instagram")[] = ["instagram"]
): Promise<PublishResult> {
  if (!getComposioApiKey()) {
    return {
      ok: true,
      detail: `mock-published "${input.title}" to ${targets.join(", ")}`,
      tiktok: targets.includes("tiktok") ? { publish_id: "mock_pub_id" } : undefined,
      instagram: targets.includes("instagram") ? { media_id: "mock_media_id" } : undefined,
    };
  }

  const errors: string[] = [];
  let tiktok: PublishResult["tiktok"];
  let instagram: PublishResult["instagram"];

  if (targets.includes("tiktok")) {
    try {
      tiktok = await publishToTikTok(input);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  if (targets.includes("instagram")) {
    try {
      instagram = await publishToInstagram(input);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  const ok = errors.length === 0;
  return {
    ok,
    detail: ok
      ? `Published "${input.title}" to ${targets.join(" + ")}`
      : errors.join(" | "),
    tiktok,
    instagram,
  };
}
