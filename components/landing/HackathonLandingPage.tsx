"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  Clapperboard,
  Database,
  Play,
  RefreshCw,
  Sparkles,
  WandSparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";

type TrendVideo = {
  title: string;
  creator: string;
  metric: string;
  tag: string;
  image: string;
  tone: string;
};

type CriteriaItem = {
  title: string;
  weight: string;
  icon: LucideIcon;
  copy: string;
};

const trendVideos: TrendVideo[] = [
  {
    title: "Streamer University reaction beat",
    creator: "@kai.remix",
    metric: "305K views",
    tag: "#streameruniversity",
    image: "https://images.unsplash.com/photo-1753545975907-dcb51efdd0d5?auto=format&fit=crop&w=700&q=82",
    tone: "chaotic hook",
  },
  {
    title: "Lunch-lady line turns into a skit",
    creator: "@socialcut",
    metric: "91K saves",
    tag: "#audition",
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=700&q=82",
    tone: "character lock",
  },
  {
    title: "Dorm room debate becomes a product ad",
    creator: "@draftroom",
    metric: "18.4% engagement",
    tag: "#trendremix",
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=700&q=82",
    tone: "brand-safe",
  },
  {
    title: "Group chant spins into a launch prompt",
    creator: "@motionfoundry",
    metric: "2.4M views",
    tag: "#livejourney",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=700&q=82",
    tone: "fast scrape",
  },
  {
    title: "Kitchen table confession with ad timing",
    creator: "@promptsmith",
    metric: "43K shares",
    tag: "#storyarc",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=700&q=82",
    tone: "visual tokens",
  },
  {
    title: "Parking lot chorus becomes a scene spec",
    creator: "@trendpilot",
    metric: "77K remixes",
    tag: "#streetcast",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=82",
    tone: "agent pick",
  },
  {
    title: "Study hall whisper prompt",
    creator: "@visuallab",
    metric: "6.8x CTR lift",
    tag: "#creatorops",
    image: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=700&q=82",
    tone: "winner frame",
  },
];

const criteriaItems: CriteriaItem[] = [
  {
    title: "Idea",
    weight: "20%",
    icon: Sparkles,
    copy: "Trend chaos becomes a usable creative brief: scrape, understand, remix, and publish while the meme is still alive.",
  },
  {
    title: "Technical",
    weight: "20%",
    icon: Database,
    copy: "Next.js, OpenUI artifacts, OpenAI Agent SDK, Composio publish/analytics, and a mock-safe ClickHouse training loop.",
  },
  {
    title: "Tool Use",
    weight: "20%",
    icon: WandSparkles,
    copy: "Sponsor tools are in the workflow, not just logos: agents call tools, OpenUI renders results, Composio reaches social data.",
  },
  {
    title: "Presentation",
    weight: "20%",
    icon: Clapperboard,
    copy: "A three-minute walkthrough can show the full path from trend intake to artifact, analytics, and export-ready prompt data.",
  },
  {
    title: "Autonomy",
    weight: "20%",
    icon: Bot,
    copy: "The agent reacts to live or mocked real-time signals, pulls analytics, and recommends stronger prompts without hand sorting.",
  },
];

const productSteps = [
  "Watch TikTok velocity",
  "Extract creator context",
  "Generate OpenUI prompt artifacts",
  "Publish or export",
  "Learn from chat history",
];

export function HackathonLandingPage() {
  const [spinning, setSpinning] = useState(true);
  const carouselItems = useMemo(() => [...trendVideos, ...trendVideos], []);

  return (
    <main className="min-h-screen bg-[#f6f3ee] text-[#201a16]">
      <section className="relative isolate min-h-[92vh] overflow-hidden bg-[#111816] text-white">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center opacity-42"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1800&q=82)",
          }}
        />
        <div aria-hidden className="absolute inset-0 bg-[#111816]/72" />

        <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 md:px-8">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/10">
              <Sparkles aria-hidden className="h-4 w-4 text-[#f3a05d]" />
            </span>
            <span>VisualLabs</span>
          </Link>
          <div className="hidden items-center gap-1 text-sm text-white/76 md:flex">
            <a href="#vision" className="rounded-md px-3 py-2 hover:bg-white/10">
              Vision
            </a>
            <a href="#criteria" className="rounded-md px-3 py-2 hover:bg-white/10">
              Judging
            </a>
            <a href="#demo" className="rounded-md px-3 py-2 hover:bg-white/10">
              Demo
            </a>
          </div>
          <Link
            href="/remix"
            className="inline-flex items-center gap-2 rounded-md bg-[#f3a05d] px-3 py-2 text-sm font-semibold text-[#17100c] hover:bg-[#ffc08a]"
          >
            Open studio
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </nav>

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 pb-10 pt-8 md:px-8 lg:pb-14 lg:pt-14">
          <div className="max-w-5xl">
            <p className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase text-[#f3a05d]">
              <Zap aria-hidden className="h-4 w-4" />
              Real-time trend remix engine
            </p>
            <h1 className="max-w-5xl text-4xl font-semibold leading-[0.98] md:text-6xl">
              Turn the internet&apos;s loudest moments into image prompts that ship.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-white/78 md:text-lg md:leading-8">
              VisualLabs watches short-form culture, turns creator context into OpenUI artifacts, and gives an
              autonomous agent enough taste to remix, analyze, and publish before the trend cools off.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/remix"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-[#17100c] hover:bg-[#f4ede5]"
              >
                Try Remix
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
              <Link
                href="/import"
                className="inline-flex h-11 items-center gap-2 rounded-md border border-white/25 px-4 text-sm font-semibold text-white hover:bg-white/10"
              >
                Import a trend
                <RefreshCw aria-hidden className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="w-full">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-white/58">Mock live feed</p>
                <h2 className="text-2xl font-semibold">Five clips in view, always moving</h2>
              </div>
              <button
                type="button"
                onClick={() => setSpinning((current) => !current)}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15"
              >
                <RefreshCw aria-hidden className={["h-3.5 w-3.5", spinning ? "animate-spin" : ""].join(" ")} />
                {spinning ? "Pause" : "Spin"}
              </button>
            </div>
            <div className="landing-carousel" data-paused={!spinning}>
              <div className="landing-carousel-track">
                {carouselItems.map((video, index) => (
                  <TrendVideoCard key={`${video.title}-${index}`} video={video} />
                ))}
              </div>
            </div>
            <p className="mt-1 text-xs text-white/55">
              Apify TikTok scraping is coming from the teammate lane; these cards are intentionally mocked for the
              local demo.
            </p>
          </div>
        </div>
      </section>

      <section id="vision" className="mx-auto w-full max-w-7xl px-5 py-16 md:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-semibold uppercase text-[#c45f1d]">Product vision</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">
              A creative co-pilot for teams who need taste, speed, and proof.
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {productSteps.map((step, index) => (
              <div key={step} className="rounded-lg border border-[#ddd5cc] bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold text-[#c45f1d]">0{index + 1}</p>
                <p className="mt-3 text-lg font-semibold">{step}</p>
                <p className="mt-2 text-sm leading-6 text-[#6c625a]">
                  {getStepCopy(index)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="criteria" className="bg-[#171f1d] px-5 py-16 text-white md:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase text-[#f3a05d]">Devpost judge mode</p>
              <h2 className="mt-3 text-4xl font-semibold">Built around the scorecard.</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-white/64">
              Each requirement maps to a visible part of the product so the demo can be judged from the screen, not
              from a slide full of promises.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {criteriaItems.map((item) => (
              <CriteriaCard key={item.title} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section id="demo" className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-16 md:px-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-xs font-semibold uppercase text-[#c45f1d]">Three-minute demo</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight">Leave room for the walkthrough video.</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#665c54]">
            The final video slot will be generated with the feature walkthrough pipeline and should cover import,
            remix, OpenUI analytics, and the mock Fastino/Pioneer training loop in one clean story.
          </p>
          <a
            href="https://github.com/HomenShum/feature-walkthrough-gif"
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-md border border-[#d9c7b9] bg-white px-4 py-2 text-sm font-semibold text-[#3a3028] hover:border-[#c45f1d]"
          >
            Walkthrough generator repo
            <ArrowRight aria-hidden className="h-4 w-4" />
          </a>
        </div>
        <div className="flex min-h-[340px] flex-col justify-between rounded-lg border border-[#d7cec5] bg-[#241916] p-5 text-white shadow-[0_22px_60px_rgba(35,28,22,0.18)]">
          <div className="flex items-center justify-between">
            <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold">3:00 demo video</span>
            <span className="text-xs text-white/54">reserved slot</span>
          </div>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-white/10">
            <Play aria-hidden className="ml-1 h-9 w-9 text-[#f3a05d]" />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-semibold text-white/66">
            <span className="rounded-md bg-white/10 px-2 py-2">Import</span>
            <span className="rounded-md bg-white/10 px-2 py-2">Remix</span>
            <span className="rounded-md bg-white/10 px-2 py-2">Analyze</span>
            <span className="rounded-md bg-white/10 px-2 py-2">Learn</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function TrendVideoCard({ video }: { video: TrendVideo }) {
  return (
    <article className="landing-trend-card overflow-hidden rounded-lg border border-white/14 bg-white text-[#211c18] shadow-[0_18px_42px_rgba(0,0,0,0.32)]">
      <div
        role="img"
        aria-label={video.title}
        className="relative aspect-[9/14] bg-cover bg-center"
        style={{ backgroundImage: `url(${video.image})` }}
      >
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/86 to-transparent p-3 text-white">
          <p className="text-sm font-semibold leading-5">{video.title}</p>
          <p className="mt-1 text-xs text-white/72">{video.creator}</p>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-[#c45f1d]">{video.metric}</span>
          <span className="rounded-md bg-[#edf6ef] px-2 py-1 font-semibold text-[#23643d]">{video.tone}</span>
        </div>
        <p className="truncate text-xs text-[#71665e]">{video.tag}</p>
      </div>
    </article>
  );
}

function CriteriaCard({ item }: { item: CriteriaItem }) {
  const Icon = item.icon;

  return (
    <article className="rounded-lg border border-white/12 bg-white/[0.06] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#f3a05d] text-[#17100c]">
          <Icon aria-hidden className="h-5 w-5" />
        </span>
        <span className="text-sm font-semibold text-[#f3a05d]">{item.weight}</span>
      </div>
      <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/66">{item.copy}</p>
    </article>
  );
}

function getStepCopy(index: number) {
  const copy = [
    "Mocked today, ready for the Apify TikTok scraper lane tomorrow.",
    "Agents pull hooks, entities, platform signals, and visual language.",
    "OpenUI turns the agent response into inspectable prompt and analytics artifacts.",
    "Composio handles publish paths while the demo stays controlled and reversible.",
    "ClickHouse events become the dataset for a small prompt-generation model.",
  ];

  return copy[index] ?? copy[0];
}
