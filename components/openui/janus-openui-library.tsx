"use client";

import { createLibrary, defineComponent } from "@openuidev/react-lang";
import { Artifact } from "@openuidev/react-ui";
import { BarChart3, Camera, ExternalLink, Gauge, Sparkles, TrendingUp } from "lucide-react";
import { z } from "zod";

const remixPromptArtifactSchema = z.object({
  title: z.string(),
  summary: z.string(),
  prompt: z.string(),
  bullets: z.array(z.string()),
  score: z.number(),
});

const analyticsMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  detail: z.string(),
});

const analyticsPostSchema = z.object({
  title: z.string(),
  mediaType: z.string(),
  views: z.number(),
  reach: z.number(),
  likes: z.number(),
  comments: z.number(),
  shares: z.number(),
  score: z.number(),
});

const instagramAnalyticsArtifactSchema = z.object({
  title: z.string(),
  summary: z.string(),
  username: z.string(),
  accountType: z.string(),
  profileStats: z.string(),
  live: z.boolean(),
  generatedAt: z.string(),
  metrics: z.array(analyticsMetricSchema),
  posts: z.array(analyticsPostSchema),
  recommendations: z.array(z.string()),
});

const RemixPromptArtifact = defineComponent({
  name: "RemixPromptArtifact",
  description: "OpenUI artifact preview for the generated remix prompt and approval checklist.",
  props: remixPromptArtifactSchema,
  component: Artifact<z.infer<typeof remixPromptArtifactSchema>>({
    title: (props) => props.title,
    preview: (props, { open, isActive }) => (
      <button
        type="button"
        onClick={open}
        className={[
          "w-full rounded-lg border p-3 text-left transition",
          isActive
            ? "border-[#c9682c] bg-[#fff4ec]"
            : "border-[#e3ded8] bg-[#f2f0ed] hover:border-[#cfb39e] hover:bg-white",
        ].join(" ")}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#c9682c] text-white">
            <Sparkles aria-hidden className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[#211c18]">{props.summary}</span>
              <span className="flex shrink-0 items-center gap-1 rounded-md border border-[#ded5ce] bg-white px-2 py-1 text-xs text-[#5f5750]">
                <Gauge aria-hidden className="h-3.5 w-3.5" />
                {props.score}
              </span>
            </span>
            <span className="mt-2 line-clamp-3 block text-xs leading-5 text-[#6a625b]">
              {props.prompt}
            </span>
          </span>
          <ExternalLink aria-hidden className="mt-1 h-4 w-4 shrink-0 text-[#9b8e84]" />
        </div>
      </button>
    ),
    panel: (props) => (
      <div className="h-full overflow-y-auto bg-[#fbfaf8] p-4 text-[#211c18]">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#e7e0da] pb-3">
          <div>
            <p className="text-xs font-semibold uppercase text-[#8c7d72]">Artifact</p>
            <h2 className="mt-1 text-lg font-semibold">{props.title}</h2>
          </div>
          <span className="rounded-md bg-[#211c18] px-2 py-1 text-xs font-semibold text-white">
            {props.score}
          </span>
        </div>
        <p className="rounded-lg border border-[#e2dad4] bg-white p-3 text-sm leading-6 text-[#3b332d]">
          {props.prompt}
        </p>
        <div className="mt-4 space-y-2">
          {props.bullets.map((bullet) => (
            <div key={bullet} className="flex gap-2 rounded-lg border border-[#e2dad4] bg-white p-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#c9682c]" />
              <p className="text-sm leading-5 text-[#4b433c]">{bullet}</p>
            </div>
          ))}
        </div>
      </div>
    ),
    panelProps: {
      className: "janus-artifact-panel",
    },
  }),
});

const InstagramAnalyticsArtifact = defineComponent({
  name: "InstagramAnalyticsArtifact",
  description: "OpenUI artifact for live Instagram profile, media, and insight metrics pulled through Composio.",
  props: instagramAnalyticsArtifactSchema,
  component: Artifact<z.infer<typeof instagramAnalyticsArtifactSchema>>({
    title: (props) => props.title,
    preview: (props, { open, isActive }) => (
      <button
        type="button"
        onClick={open}
        className={[
          "w-full rounded-lg border p-3 text-left transition",
          isActive
            ? "border-[#c9682c] bg-[#fff4ec]"
            : "border-[#e3ded8] bg-[#f2f0ed] hover:border-[#cfb39e] hover:bg-white",
        ].join(" ")}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#c9682c] text-white">
            <Camera aria-hidden className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[#211c18]">@{props.username}</span>
              <span className="rounded-md border border-[#ded5ce] bg-white px-2 py-1 text-xs text-[#5f5750]">
                {props.live ? "live" : "mock"}
              </span>
            </span>
            <span className="mt-2 line-clamp-3 block text-xs leading-5 text-[#6a625b]">
              {props.summary}
            </span>
          </span>
          <ExternalLink aria-hidden className="mt-1 h-4 w-4 shrink-0 text-[#9b8e84]" />
        </div>
      </button>
    ),
    panel: (props) => (
      <div className="h-full overflow-y-auto bg-[#fbfaf8] p-4 text-[#211c18]">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#e7e0da] pb-3">
          <div>
            <p className="text-xs font-semibold uppercase text-[#8c7d72]">Composio Instagram MCP</p>
            <h2 className="mt-1 text-lg font-semibold">@{props.username}</h2>
            <p className="mt-1 text-xs text-[#7d7269]">
              {props.accountType} - {props.profileStats}
            </p>
          </div>
          <span className="rounded-md bg-[#211c18] px-2 py-1 text-xs font-semibold text-white">
            {props.live ? "Live" : "Mock"}
          </span>
        </div>

        <p className="rounded-lg border border-[#e2dad4] bg-white p-3 text-sm leading-6 text-[#3b332d]">
          {props.summary}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {props.metrics.map((metric) => (
            <div key={`${metric.label}-${metric.value}`} className="rounded-lg border border-[#e2dad4] bg-white p-3">
              <p className="text-xs font-semibold text-[#8c7d72]">{metric.label}</p>
              <p className="mt-1 text-lg font-semibold">{metric.value}</p>
              <p className="mt-1 text-xs text-[#756b62]">{metric.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {props.posts.map((post) => (
            <div key={`${post.title}-${post.reach}`} className="rounded-lg border border-[#e2dad4] bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{post.title}</p>
                  <p className="mt-1 text-xs text-[#8c7d72]">{post.mediaType}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md bg-[#fff3ea] px-2 py-1 text-xs font-semibold text-[#b95c1f]">
                  <TrendingUp aria-hidden className="h-3.5 w-3.5" />
                  {post.score}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2 text-xs text-[#5f5750]">
                <MetricTiny label="views" value={post.views} />
                <MetricTiny label="reach" value={post.reach} />
                <MetricTiny label="likes" value={post.likes} />
                <MetricTiny label="comments" value={post.comments} />
                <MetricTiny label="shares" value={post.shares} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {props.recommendations.map((recommendation) => (
            <div key={recommendation} className="flex gap-2 rounded-lg border border-[#e2dad4] bg-white p-3">
              <BarChart3 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#c9682c]" />
              <p className="text-sm leading-5 text-[#4b433c]">{recommendation}</p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-[#8c7d72]">Generated {new Date(props.generatedAt).toLocaleString()}</p>
      </div>
    ),
    panelProps: {
      className: "janus-artifact-panel",
    },
  }),
});

function MetricTiny({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-semibold text-[#211c18]">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-[#8c7d72]">{label}</p>
    </div>
  );
}

export const janusOpenUiLibrary = createLibrary({
  root: "RemixPromptArtifact",
  components: [RemixPromptArtifact, InstagramAnalyticsArtifact],
  componentGroups: [
    {
      name: "Janus parity artifacts",
      components: ["RemixPromptArtifact", "InstagramAnalyticsArtifact"],
      notes: [
        "Use RemixPromptArtifact for the right-panel generated prompt artifact.",
        "Use InstagramAnalyticsArtifact for read-only Composio Instagram analytics pulled into chat.",
        "Keep the artifact focused on image/video prompt approval and publish gates.",
      ],
    },
  ],
});
