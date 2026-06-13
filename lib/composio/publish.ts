import { Composio } from "@composio/core";
import { recordChatHistoryEvent, type ChatSurface } from "@/lib/analytics/chat-history";
import { getComposioApiKey, getComposioToolExecutionCommon } from "@/lib/composio/config";

export type PublishTarget = "tiktok" | "instagram";

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

export type PublishDryRunResult = PublishResult & {
  dryRun: true;
};

type UnknownRecord = Record<string, unknown>;

function getComposio() {
  return new Composio({ apiKey: getComposioApiKey() });
}

async function publishToTikTok(input: PublishInput): Promise<PublishResult["tiktok"]> {
  if (!input.videoUrl) return undefined;

  const caption = `${input.hook}\n\n${input.cta}`.slice(0, 2200);

  const result = await getComposio().tools.execute("TIKTOK_PUBLISH_VIDEO", {
    ...getComposioToolExecutionCommon("tiktok"),
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

  const data = parseComposioData(result.data);
  return { publish_id: stringField(recordField(data, "data"), "publish_id") };
}

async function publishToInstagram(input: PublishInput): Promise<PublishResult["instagram"]> {
  const mediaUrl = input.videoUrl ?? input.imageUrl;
  if (!mediaUrl) return undefined;

  const caption = `${input.hook}\n\n${input.cta}`.slice(0, 2200);
  const isVideo = !!input.videoUrl;
  const igUserId = getInstagramPublishUserId();

  const containerResult = await getComposio().tools.execute("INSTAGRAM_POST_IG_USER_MEDIA", {
    ...getComposioToolExecutionCommon("instagram"),
    arguments: isVideo
      ? {
          ig_user_id: igUserId,
          media_type: "REELS",
          video_url: mediaUrl,
          caption,
          share_to_feed: true,
        }
      : { ig_user_id: igUserId, image_url: mediaUrl, caption },
  });

  if (containerResult.error) throw new Error(`Instagram container: ${containerResult.error}`);

  const containerData = parseComposioData(containerResult.data);
  const creation_id = stringField(containerData, "id") ?? stringField(recordField(containerData, "data"), "id");

  if (!creation_id) throw new Error("Instagram: no creation_id returned");

  const publishResult = await getComposio().tools.execute("INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH", {
    ...getComposioToolExecutionCommon("instagram"),
    arguments: {
      ig_user_id: igUserId,
      creation_id,
    },
  });

  if (publishResult.error) throw new Error(`Instagram publish: ${publishResult.error}`);

  const publishData = parseComposioData(publishResult.data);
  return { media_id: stringField(publishData, "id") ?? stringField(recordField(publishData, "data"), "id") };
}

export async function publishAd(
  input: PublishInput,
  targets: PublishTarget[] = ["instagram"]
): Promise<PublishResult> {
  const validationErrors = validatePublishInput(input, targets);
  if (validationErrors.length > 0) {
    return {
      ok: false,
      detail: validationErrors.join(" | "),
    };
  }

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

export async function preparePublishDryRun(
  input: PublishInput,
  targets: PublishTarget[] = ["instagram"],
  options: { sessionId?: string; surface?: ChatSurface } = {}
): Promise<PublishDryRunResult> {
  const result: PublishDryRunResult = {
    ok: true,
    dryRun: true,
    detail: `dry-run post prepared for "${input.title}" to ${targets.join(", ")}`,
    tiktok: targets.includes("tiktok") ? { publish_id: "dry_run_pub_id" } : undefined,
    instagram: targets.includes("instagram") ? { media_id: "dry_run_media_id" } : undefined,
  };

  await recordChatHistoryEvent({
    sessionId: options.sessionId ?? "visual-remix-demo",
    surface: options.surface ?? "remix",
    eventType: "artifact_render",
    role: "assistant",
    model: "composio-dry-run",
    provider: "composio",
    prompt: `${input.hook}\n\n${input.cta}`,
    response: result.detail,
    artifactType: "PublishDraft",
    qualityLabel: "publish_draft",
    action: "dry_run_publish",
    mocked: true,
    live: false,
    metadata: {
      title: input.title,
      targets,
      hasVideo: !!input.videoUrl,
      hasImage: !!input.imageUrl,
    },
  });

  return result;
}

function validatePublishInput(input: PublishInput, targets: PublishTarget[]) {
  const errors: string[] = [];

  if (targets.includes("tiktok") && !input.videoUrl) {
    errors.push("TikTok publish requires a videoUrl.");
  }

  if (targets.includes("instagram") && !input.videoUrl && !input.imageUrl) {
    errors.push("Instagram publish requires an imageUrl or videoUrl.");
  }

  return errors;
}

function parseComposioData(data: unknown): UnknownRecord {
  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as UnknownRecord) : {};
}

function recordField(record: UnknownRecord, key: string): UnknownRecord {
  const value = record[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function stringField(record: UnknownRecord, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function getInstagramPublishUserId() {
  return process.env.INSTAGRAM_PUBLISH_IG_USER_ID ?? process.env.INSTAGRAM_IG_USER_ID ?? "me";
}
