/**
 * A's lane — manufacture the Pioneer SFT dataset by distilling the base model.
 *
 * Feeds ~150 topics through OUR OWN /api/draft (so every example passes the real
 * zod schema + goes through the TrueFoundry gateway = "trained on our own traffic"),
 * then writes Pioneer's SFT chat format:
 *   {"messages":[{role:system},{role:user = topic},{role:assistant = draft JSON}]}
 *
 * Usage:
 *   npm run dev                                   # in another terminal
 *   node scripts/generate-training-data.mjs                 # full run -> data/train.jsonl
 *   node scripts/generate-training-data.mjs --limit 3       # dry run -> data/sample.jsonl
 *   TEACHER_MODEL=openai/gpt-4o node scripts/generate-training-data.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const envPath = new URL("../.env.local", import.meta.url);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*("?)(.*?)\2\s*(#.*)?$/);
    if (m && m[3] && !(m[1] in process.env)) process.env[m[1]] = m[3];
  }
}

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx !== -1 ? Number(args[limitIdx + 1]) : Infinity;
const API = process.env.DRAFT_API ?? "http://localhost:3000/api/draft";
const TEACHER = process.env.TEACHER_MODEL ?? process.env.BASE_MODEL;
const CONCURRENCY = 5;
const HOLDOUT = 12; // last N topics reserved for the base-vs-pioneer comparison demo

// The system prompt the TUNED model will see at inference time. Deliberately short —
// the format lives in the trained weights, not the prompt. That gap IS the cost story.
const SYSTEM = `You draft short video ads. Reply with ONLY a JSON object: {"title","hook","cta","pacing":"fast|medium|slow","shots":[{"id","order","duration_s","script","image_prompt","video_prompt","on_screen_text"|null}]}. 3-5 shots, durations sum <= 15 seconds.`;

const TOPICS = [
  "a cold brew coffee brand for people who hate the 2pm crash",
  "a sleep tracking ring that coaches you to better rest",
  "an oat milk that actually foams like dairy",
  "a meal-kit service for single people who hate leftovers",
  "a protein bar made from upcycled bread",
  "a sparkling water brand with absurdly bold flavors",
  "a late-night ramen delivery service in college towns",
  "a zero-sugar energy drink aimed at gamers",
  "a local sourdough bakery launching nationwide shipping",
  "a hot sauce subscription that escalates monthly",
  "a decaf espresso brand fighting the decaf stigma",
  "a kombucha for people intimidated by kombucha",
  "a frozen smoothie cube startup for busy mornings",
  "a high-protein ice cream that doesn't taste like chalk",
  "a budgeting app that roasts your spending habits",
  "a language app that teaches through song lyrics",
  "a calendar app that auto-defends your focus time",
  "a password manager for families with aging parents",
  "an email client that summarizes threads with AI",
  "a meditation app for people who can't sit still",
  "a running app that narrates zombie chase stories",
  "a plant identification app for new houseplant owners",
  "a receipt-scanning app that finds tax write-offs for freelancers",
  "a dating app that matches people by their Spotify history",
  "an app that turns voice memos into organized notes",
  "a habit tracker that donates to charity when you fail",
  "a screen-time app that pays kids to read books",
  "a journaling app with daily AI writing prompts",
  "a carpooling app for parents with school-age kids",
  "a photo storage app that resurfaces old memories daily",
  "an AI tutor app for high school math",
  "a video doorbell with on-device privacy-first AI",
  "a podcast app that clips highlights automatically",
  "a travel app that plans trips from your saved reels",
  "a sneaker brand made from ocean plastic",
  "a clothing rental service for job interviews",
  "jeans with a lifetime free-repair guarantee",
  "a unisex fragrance brand that names scents after cities",
  "a skincare line with exactly three products",
  "a sunscreen that doesn't leave a white cast on dark skin",
  "compression socks that don't look medical",
  "a watch brand that plants a tree per sale",
  "a glasses brand with home try-on by mail",
  "a minimalist wallet that fits 12 cards",
  "a beard oil brand for first-time beard growers",
  "a nail polish that changes color with temperature",
  "a haircare line for curly hair routines",
  "a tattoo aftercare kit designed by artists",
  "a gym that bills you only on days you show up",
  "a 10-minute home workout program for new parents",
  "an adjustable dumbbell that fits under the bed",
  "a yoga mat with alignment lines printed on it",
  "a posture trainer for remote workers",
  "an electrolyte powder without the neon dyes",
  "a recovery shoe for runners",
  "a boxing gym franchise for stress relief",
  "a stationary bike that powers your phone charger",
  "a stretching app for desk workers over 40",
  "a sleep gummy without melatonin grogginess",
  "a standing desk that reminds you to sit sometimes",
  "a robot vacuum that maps pet accidents and avoids them",
  "a candle brand with scents of fictional places",
  "a weighted blanket for hot sleepers",
  "a modular sofa that moves with you between apartments",
  "an air purifier quiet enough for nurseries",
  "a smart garden that grows herbs on your counter",
  "a duvet with a zip-off washable layer",
  "a non-stick pan with a 25-year warranty",
  "a compost bin that doesn't smell, for apartments",
  "a paint brand with peel-and-stick sample swatches",
  "a kids' bunk bed that converts to two singles",
  "a doormat subscription for seasonal designs",
  "a budget airline's new direct route to Lisbon",
  "an overnight train service replacing short-haul flights",
  "a campervan rental for remote workers",
  "a travel insurance brand that pays claims in 24 hours",
  "an e-bike built for grocery runs",
  "a tire brand's winter safety campaign",
  "an EV charging network for apartment dwellers",
  "a motorcycle helmet with a heads-up display",
  "a luggage brand with a lifetime lost-bag promise",
  "a city bike-share annual pass for commuters",
  "a robo-advisor for first-time investors",
  "a credit card that rounds up purchases into index funds",
  "a renters insurance brand for under $10 a month",
  "a payroll service for businesses with under 10 employees",
  "a fraud-alert service for elderly parents' accounts",
  "a high-yield savings account with no fine print",
  "a tax filing service with a flat honest price",
  "an invoicing tool for freelance designers",
  "a small-business loan service with same-week decisions",
  "a will-writing service that takes 20 minutes",
  "a cozy farming video game launching on console",
  "a board game cafe chain's membership program",
  "a cloud gaming service for players with old laptops",
  "a trivia night app for bars and breweries",
  "a streaming service for classic world cinema",
  "an audiobook club with live author Q&As",
  "a VR fitness game that feels like dancing",
  "a tabletop RPG starter kit for total beginners",
  "a retro arcade bar opening downtown",
  "a kids' coding game where bugs are literal monsters",
  "a dog food brand with vet-formulated fresh meals",
  "a cat furniture line that looks like real furniture",
  "a GPS collar for cats who roam",
  "a pet insurance brand that covers pre-existing conditions",
  "a dog-walking collective run by retirees",
  "a kids' subscription box of science experiments",
  "a stroller that folds with one hand",
  "a baby monitor without a subscription fee",
  "a plumbing company with upfront flat pricing",
  "a house cleaning service vetted by background checks",
  "a mobile car detailing service that comes to your office",
  "a 24-hour locksmith with GPS-tracked arrival times",
  "a landscaping company specializing in drought-proof yards",
  "a moving company that guarantees no hidden fees",
  "an HVAC tune-up subscription for homeowners",
  "a handyman service billed by the task, not the hour",
  "a dry cleaner with free pickup and delivery",
  "a tailor shop that alters thrifted clothes",
  "an error-monitoring tool that explains crashes in plain English",
  "a CI service that cuts build times in half",
  "an API gateway with one-line setup",
  "a database that scales to zero between deploys",
  "a design tool where PMs and engineers share one canvas",
  "an internal wiki that answers questions like a chatbot",
  "a customer support inbox powered by your docs",
  "an uptime monitor that calls you before customers tweet",
  "a feature-flag service for tiny teams",
  "an analytics tool that respects user privacy by default",
  "a CRM built specifically for solo founders",
  "a scheduling tool that kills the back-and-forth email",
  "an e-signature tool with no per-document fees",
  "a video meeting tool that writes the follow-up email",
  "a hiring platform that hides names to reduce bias",
  "a community college's evening coding bootcamp",
  "a library system's summer reading challenge",
  "a city's composting program launch",
  "a blood donation drive targeting first-time donors",
  "a local farmers market's winter season opening",
  "a museum's late-night Friday series for young adults",
  "a volunteer platform matching skills to nonprofits",
  "a disaster-prep kit brand for earthquake country",
  "a neighborhood tool-lending library",
  "a citywide bike-to-work week campaign",
  "an online music school with live group lessons",
  "a thrift store chain's sustainable fashion campaign",
  "a coworking space for parents with on-site childcare",
  "a repair cafe movement teaching people to fix electronics",
];

async function draftOne(topic, attempt = 1) {
  const t0 = Date.now();
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "topic", content: topic, model: TEACHER }),
  });
  if (!res.ok) {
    if (attempt < 3) return draftOne(topic, attempt + 1);
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const draft = await res.json();
  return { draft, ms: Date.now() - t0 };
}

function validate(draft) {
  if (draft.meta?.model?.includes("mock")) return "gateway not configured — refusing to write mock data";
  if (!Array.isArray(draft.shots) || draft.shots.length < 3 || draft.shots.length > 5)
    return `bad shot count: ${draft.shots?.length}`;
  const total = draft.shots.reduce((s, x) => s + (x.duration_s ?? 0), 0);
  if (total > 15) return `duration ${total}s > 15s`;
  for (const s of draft.shots)
    if (!s.image_prompt || !s.video_prompt || !s.script) return `shot ${s.id} missing fields`;
  return null;
}

const topics = TOPICS.slice(0, Math.min(LIMIT, TOPICS.length - (LIMIT === Infinity ? HOLDOUT : 0)));
const holdout = TOPICS.slice(TOPICS.length - HOLDOUT);
const outPath = LIMIT === Infinity ? "data/train.jsonl" : "data/sample.jsonl";

console.log(`teacher : ${TEACHER}`);
console.log(`api     : ${API}`);
console.log(`topics  : ${topics.length} (+${HOLDOUT} held out for the demo comparison)`);
console.log(`output  : ${outPath}\n`);

const lines = [];
const failures = [];
let done = 0;

async function worker(queue) {
  for (let item; (item = queue.shift()); ) {
    try {
      const { draft, ms } = await draftOne(item);
      const reason = validate(draft);
      done++;
      if (reason) {
        failures.push({ topic: item, reason });
        console.log(`[${done}/${topics.length}] DROP "${item.slice(0, 40)}…" — ${reason}`);
        continue;
      }
      const { meta, ...content } = draft;
      lines.push(
        JSON.stringify({
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: item },
            { role: "assistant", content: JSON.stringify(content) },
          ],
        })
      );
      const total = content.shots.reduce((s, x) => s + x.duration_s, 0);
      console.log(`[${done}/${topics.length}] ok  ${content.shots.length} shots, ${total}s, ${ms}ms`);
    } catch (err) {
      done++;
      failures.push({ topic: item, reason: String(err) });
      console.log(`[${done}/${topics.length}] FAIL "${item.slice(0, 40)}…" — ${err}`);
    }
  }
}

const queue = [...topics];
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

mkdirSync(new URL("../data", import.meta.url), { recursive: true });
writeFileSync(new URL(`../${outPath}`, import.meta.url), lines.join("\n") + "\n");
writeFileSync(
  new URL("../data/holdout-topics.json", import.meta.url),
  JSON.stringify(holdout, null, 2)
);

const bytes = lines.join("\n").length;
console.log(`\nkept ${lines.length}/${topics.length} examples → ${outPath} (${Math.round(bytes / 1024)} KB, ~${Math.round(bytes / 4 / 1000)}k tokens)`);
console.log(`holdout topics → data/holdout-topics.json`);
if (failures.length) console.log(`dropped: ${failures.length} (see reasons above)`);
