import { tool } from "@openai/agents";
import { z } from "zod";
import { chatHistoryMode, recordChatHistoryEvent } from "@/lib/analytics/chat-history";
import { getFineTuneDataset, recordsToJsonl } from "@/lib/analytics/fine-tuning";
import { preparePublishDryRun, type PublishTarget } from "@/lib/composio/publish";
import {
  pollRenderVideo,
  renderImage,
  submitRenderVideo,
  type RenderAspectRatio,
} from "@/lib/render/render-service";

const aspectRatioSchema = z.enum(["9:16", "16:9", "1:1"]);
const publishTargetSchema = z.enum(["instagram", "tiktok"]);

const renderImageTool = tool({
  name: "render_image",
  description:
    "Generate one image from a production prompt through the app render workflow. Returns a permanent URL when live render keys are configured, or a mock URL otherwise.",
  parameters: z.object({
    prompt: z.string().min(12).describe("The image generation prompt to render."),
    shotId: z.string().min(1).optional().describe("Optional stable shot id for telemetry."),
    draftId: z.string().min(1).optional().describe("Optional draft id for telemetry."),
    model: z.string().min(1).optional().describe("Optional model label for cost telemetry."),
    startImageUrl: z.string().url().optional().describe("Optional reference image URL for Seedream edit mode."),
    aspectRatio: aspectRatioSchema.optional().describe("Output aspect ratio. Defaults to vertical 9:16."),
  }),
  execute: async (args) => {
    const shotId = args.shotId ?? createId("agent_image");

    try {
      const result = await renderImage({
        shotId,
        prompt: args.prompt,
        draftId: args.draftId,
        model: args.model ?? "harnessed-agent",
        startImageUrl: args.startImageUrl,
        aspectRatio: args.aspectRatio as RenderAspectRatio | undefined,
      });

      await recordChatHistoryEvent({
        sessionId: "openui-agent-demo",
        surface: "agent",
        eventType: "artifact_render",
        role: "assistant",
        model: args.model ?? "harnessed-agent",
        provider: result.provider,
        prompt: args.prompt,
        response: result.url,
        artifactType: "ImageRender",
        qualityLabel: "image_render",
        action: "render_image",
        mocked: result.mocked,
        live: !result.mocked,
        metadata: {
          shotId,
          draftId: args.draftId,
          hasReferenceImage: !!args.startImageUrl,
          aspectRatio: args.aspectRatio ?? "9:16",
        },
      });

      return stringifyToolResult({
        ok: true,
        tool: "render_image",
        shotId,
        url: result.url,
        provider: result.provider,
        mocked: result.mocked,
      });
    } catch (error) {
      return stringifyToolError("render_image", error, { shotId });
    }
  },
});

const submitVideoTool = tool({
  name: "submit_video",
  description:
    "Submit an async video render job through the app render workflow. Returns a pollable jobId; use poll_video to check completion.",
  parameters: z.object({
    prompt: z.string().min(12).describe("The video generation prompt to submit."),
    shotId: z.string().min(1).optional().describe("Optional stable shot id for telemetry."),
    draftId: z.string().min(1).optional().describe("Optional draft id for telemetry."),
    model: z.string().min(1).optional().describe("Optional model label for cost telemetry."),
    startImageUrl: z.string().url().optional().describe("Optional first-frame reference image URL."),
    durationSeconds: z
      .number()
      .int()
      .min(4)
      .max(15)
      .optional()
      .describe("Short clip duration accepted by Seedance. Defaults to 5."),
    aspectRatio: aspectRatioSchema.optional().describe("Output aspect ratio. Defaults to vertical 9:16."),
  }),
  execute: async (args) => {
    const shotId = args.shotId ?? createId("agent_video");

    try {
      const result = await submitRenderVideo({
        shotId,
        prompt: args.prompt,
        draftId: args.draftId,
        model: args.model ?? "harnessed-agent",
        startImageUrl: args.startImageUrl,
        durationSeconds: args.durationSeconds,
        aspectRatio: args.aspectRatio as RenderAspectRatio | undefined,
      });

      await recordChatHistoryEvent({
        sessionId: "openui-agent-demo",
        surface: "agent",
        eventType: "artifact_render",
        role: "assistant",
        model: args.model ?? "harnessed-agent",
        provider: result.provider,
        prompt: args.prompt,
        response: `Submitted async video render job ${result.jobId}.`,
        artifactType: "VideoRenderJob",
        qualityLabel: "video_render",
        action: "submit_video",
        mocked: result.mocked,
        live: !result.mocked,
        metadata: {
          shotId,
          draftId: args.draftId,
          jobId: result.jobId,
          providerJobId: result.providerJobId,
          durationSeconds: args.durationSeconds ?? 5,
          hasStartImage: !!args.startImageUrl,
        },
      });

      return stringifyToolResult({
        ok: true,
        tool: "submit_video",
        shotId,
        jobId: result.jobId,
        providerJobId: result.providerJobId,
        provider: result.provider,
        mocked: result.mocked,
      });
    } catch (error) {
      return stringifyToolError("submit_video", error, { shotId });
    }
  },
});

const pollVideoTool = tool({
  name: "poll_video",
  description:
    "Poll a video render jobId returned by submit_video. Returns pending, done with URL, or failed with an error.",
  parameters: z.object({
    jobId: z.string().min(1).describe("The encoded render job id returned by submit_video."),
  }),
  execute: async (args) => {
    try {
      const result = await pollRenderVideo(args.jobId);
      if (result.status === "done") {
        await recordChatHistoryEvent({
          sessionId: "openui-agent-demo",
          surface: "agent",
          eventType: "artifact_render",
          role: "assistant",
          model: "harnessed-agent",
          provider: result.provider ?? "render",
          prompt: `Poll video render job ${args.jobId}.`,
          response: result.url,
          artifactType: "VideoRender",
          qualityLabel: "video_render",
          action: "poll_video_done",
          mocked: result.mocked,
          live: !result.mocked,
          metadata: { jobId: args.jobId },
        });
      }

      return stringifyToolResult({
        ok: result.status !== "failed",
        tool: "poll_video",
        jobId: args.jobId,
        ...result,
      });
    } catch (error) {
      return stringifyToolError("poll_video", error, { jobId: args.jobId });
    }
  },
});

const preparePublishDryRunTool = tool({
  name: "prepare_publish_dry_run",
  description:
    "Prepare a safe Composio publish dry-run. This never publishes live; it only validates and records the intended post.",
  parameters: z.object({
    title: z.string().min(1).describe("Internal title for the post draft."),
    hook: z.string().min(1).describe("Caption hook or first line."),
    cta: z.string().min(1).describe("Call to action for the caption."),
    videoUrl: z.string().url().nullable().optional().describe("Optional video URL for TikTok/Instagram Reels."),
    imageUrl: z.string().url().nullable().optional().describe("Optional image URL for Instagram image publishing."),
    targets: z
      .array(publishTargetSchema)
      .min(1)
      .optional()
      .describe("Social targets to prepare. Defaults to Instagram."),
  }),
  execute: async (args) => {
    try {
      const targets = normalizePublishTargets(args.targets);
      const result = await preparePublishDryRun(
        {
          title: args.title,
          hook: args.hook,
          cta: args.cta,
          videoUrl: args.videoUrl ?? null,
          imageUrl: args.imageUrl ?? null,
        },
        targets,
        {
          sessionId: "openui-agent-demo",
          surface: "agent",
        }
      );

      return stringifyToolResult({
        tool: "prepare_publish_dry_run",
        ...result,
      });
    } catch (error) {
      return stringifyToolError("prepare_publish_dry_run", error);
    }
  },
});

const exportTrainingDatasetTool = tool({
  name: "export_training_dataset",
  description:
    "Export chat history and artifact events as Fastino/Pioneer JSONL training records. Returns a compact preview and download path.",
  parameters: z.object({
    limit: z.number().int().min(1).max(500).optional().describe("Maximum source events to convert. Defaults to 100."),
    format: z
      .enum(["summary", "jsonl"])
      .optional()
      .describe("Use jsonl only when the user explicitly asks to see the JSONL text."),
  }),
  execute: async (args) => {
    const limit = args.limit ?? 100;

    try {
      const records = await getFineTuneDataset(limit);
      const jsonl = recordsToJsonl(records);

      await recordChatHistoryEvent({
        sessionId: "openui-agent-demo",
        surface: "agent",
        eventType: "dataset_export",
        role: "system",
        model: process.env.PIONEER_MODEL || "pioneer/fastino-image-prompt-v0",
        provider: "clickhouse",
        prompt: "Export chat history into Fastino/Pioneer JSONL training records from agent chat.",
        response: `Exported ${records.length} JSONL records from ${chatHistoryMode()} history.`,
        qualityLabel: "dataset_export",
        action: args.format === "jsonl" ? "agent_export_jsonl" : "agent_preview_dataset",
        mocked: chatHistoryMode() !== "clickhouse",
        live: chatHistoryMode() === "clickhouse",
        metadata: { records: records.length, format: args.format ?? "summary", limit },
      });

      return stringifyToolResult({
        ok: true,
        tool: "export_training_dataset",
        mode: chatHistoryMode(),
        count: records.length,
        downloadPath: `/api/analytics/export?format=jsonl&limit=${limit}`,
        preview: records.slice(0, 3),
        jsonlPreview: jsonl.split("\n").slice(0, 3).join("\n"),
        jsonl: args.format === "jsonl" ? jsonl : undefined,
      });
    } catch (error) {
      return stringifyToolError("export_training_dataset", error);
    }
  },
});

export const harnessedAgentTools = [
  renderImageTool,
  submitVideoTool,
  pollVideoTool,
  preparePublishDryRunTool,
  exportTrainingDatasetTool,
];

function normalizePublishTargets(targets: PublishTarget[] | undefined): PublishTarget[] {
  return targets && targets.length > 0 ? targets : ["instagram"];
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

function stringifyToolResult(result: Record<string, unknown>) {
  return JSON.stringify(result);
}

function stringifyToolError(toolName: string, error: unknown, metadata: Record<string, unknown> = {}) {
  return stringifyToolResult({
    ok: false,
    tool: toolName,
    error: error instanceof Error ? error.message : "tool failed",
    ...metadata,
  });
}
