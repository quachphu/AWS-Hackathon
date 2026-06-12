"use client";

import { createLibrary, defineComponent } from "@openuidev/react-lang";
import { Artifact } from "@openuidev/react-ui";
import { ExternalLink, Gauge, Sparkles } from "lucide-react";
import { z } from "zod";

const remixPromptArtifactSchema = z.object({
  title: z.string(),
  summary: z.string(),
  prompt: z.string(),
  bullets: z.array(z.string()),
  score: z.number(),
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

export const janusOpenUiLibrary = createLibrary({
  root: "RemixPromptArtifact",
  components: [RemixPromptArtifact],
  componentGroups: [
    {
      name: "Janus parity artifacts",
      components: ["RemixPromptArtifact"],
      notes: [
        "Use RemixPromptArtifact for the right-panel generated prompt artifact.",
        "Keep the artifact focused on image/video prompt approval and publish gates.",
      ],
    },
  ],
});
