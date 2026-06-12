/**
 * A's lane — drive Pioneer fine-tuning from the terminal.
 *
 *   node scripts/pioneer-train.mjs --models                 # list base models you can tune
 *   node scripts/pioneer-train.mjs --start --base Qwen/Qwen3-8B --dataset ad-drafts
 *   node scripts/pioneer-train.mjs --status <job-id>        # check once
 *   node scripts/pioneer-train.mjs --watch <job-id>         # poll every 30s until done
 *
 * Needs PIONEER_API_KEY in .env.local (pioneer.ai → Settings → API Keys).
 * Dataset upload itself happens in the Pioneer dashboard (data/train.jsonl).
 */
import { readFileSync, existsSync } from "node:fs";

const envPath = new URL("../.env.local", import.meta.url);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*("?)(.*?)\2\s*(#.*)?$/);
    if (m && m[3] && !(m[1] in process.env)) process.env[m[1]] = m[3];
  }
}

const KEY = process.env.PIONEER_API_KEY;
const BASE = process.env.PIONEER_API_URL ?? "https://api.pioneer.ai";
if (!KEY) {
  console.error("PIONEER_API_KEY missing from .env.local (pioneer.ai → Settings → API Keys).");
  process.exit(1);
}

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const val = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "X-API-Key": KEY, "Content-Type": "application/json", ...init.headers },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → HTTP ${res.status}\n${text.slice(0, 500)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (flag("models")) {
  const models = await api("/base-models?supports_inference=true");
  console.log(JSON.stringify(models, null, 2));
} else if (flag("start")) {
  const base = val("base");
  const dataset = val("dataset");
  if (!base || !dataset) {
    console.error("Need --base <base-model-id> and --dataset <dataset-name-as-uploaded>.");
    process.exit(1);
  }
  const dsVersion = val("dsversion");
  const body = {
    model_name: val("name", "ad-drafter-v1"),
    base_model: base,
    training_type: "lora",
    datasets: [dsVersion ? { name: dataset, version: dsVersion } : { name: dataset }],
    lora_r: 16,
    lora_alpha: 32,
    learning_rate: 2e-5,
    nr_epochs: Number(val("epochs", "3")),
  };
  console.log("Starting training job:", JSON.stringify(body, null, 2));
  const job = await api("/felix/training-jobs", { method: "POST", body: JSON.stringify(body) });
  console.log("\nCreated:", JSON.stringify(job, null, 2));
  console.log("\nNext: node scripts/pioneer-train.mjs --watch <the job id above>");
} else if (flag("status") || flag("watch")) {
  const id = val("status") ?? val("watch");
  if (!id) {
    console.error("Pass the job id: --status <id> or --watch <id>");
    process.exit(1);
  }
  for (;;) {
    const job = await api(`/felix/training-jobs/${id}`);
    const status = job.status ?? JSON.stringify(job).slice(0, 120);
    console.log(`[${new Date().toLocaleTimeString()}] ${status}`);
    if (!flag("watch") || ["complete", "deployed", "failed", "stopped"].includes(job.status)) {
      if (flag("watch")) console.log("\nFinal state:", JSON.stringify(job, null, 2));
      break;
    }
    await sleep(30_000);
  }
} else {
  console.log("Usage: --models | --start --base <id> --dataset <name> | --status <id> | --watch <id>");
}
