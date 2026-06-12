/**
 * A's lane — upload a JSONL dataset to Pioneer via API (their docs are API-only,
 * there is no dashboard upload). Three steps: presigned URL → PUT file → process.
 *
 *   node scripts/pioneer-upload.mjs                          # data/train.jsonl as "ad-drafts"
 *   node scripts/pioneer-upload.mjs --file x.jsonl --name y  # custom
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
  console.error("PIONEER_API_KEY missing from .env.local");
  process.exit(1);
}

const args = process.argv.slice(2);
const val = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const FILE = val("file", "data/train.jsonl");
const NAME = val("name", "ad-drafts");
// "decoder" = SFT chat data for an LLM. Without it Pioneer defaults to "ner" and conversion fails.
const TYPE = val("type", "decoder");

const api = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const bytes = readFileSync(new URL(`../${FILE}`, import.meta.url));
console.log(`file    : ${FILE} (${Math.round(bytes.length / 1024)} KB)`);
console.log(`dataset : ${NAME}\n`);

console.log(`[1/4] requesting presigned upload URL (type: ${TYPE})…`);
const urlRes = await api("/felix/datasets/upload/url", { dataset_name: NAME, dataset_type: TYPE });
if (!urlRes.ok) {
  console.error("FAIL:", JSON.stringify(urlRes.json));
  process.exit(1);
}
const { presigned_url, dataset_id, version_number } = urlRes.json;
console.log(`      dataset_id ${dataset_id} (version ${version_number})`);

console.log("[2/4] uploading to S3…");
const put = await fetch(presigned_url, {
  method: "PUT",
  headers: { "Content-Type": "application/octet-stream" },
  body: bytes,
});
if (!put.ok) {
  console.error(`FAIL: S3 PUT HTTP ${put.status}: ${(await put.text()).slice(0, 300)}`);
  process.exit(1);
}

console.log("[3/4] triggering processing…");
let proc = await api("/felix/datasets/upload/process", { dataset_id });
if (!proc.ok && JSON.stringify(proc.json).toLowerCase().includes("format")) {
  proc = await api("/felix/datasets/upload/process", { dataset_id, format: "jsonl" });
}
if (!proc.ok) {
  console.error("FAIL:", JSON.stringify(proc.json));
  process.exit(1);
}
console.log("      ", JSON.stringify(proc.json).slice(0, 200));

console.log("[4/4] waiting for status ready…");
for (let i = 0; i < 60; i++) {
  const info = await api(`/felix/datasets/${encodeURIComponent(NAME)}`);
  const versions = info.json.versions ?? info.json.datasets ?? [];
  const v = Array.isArray(versions)
    ? versions.find((x) => String(x.version_number ?? x.version) === String(version_number)) ?? versions[0]
    : versions;
  const status = v?.status ?? info.json.status ?? "unknown";
  console.log(`      [${new Date().toLocaleTimeString()}] ${status}${v?.num_examples ? ` (${v.num_examples} examples)` : ""}`);
  if (status === "ready") {
    console.log(`\nDataset "${NAME}" is ready — start training:\n  node scripts/pioneer-train.mjs --start --base Qwen/Qwen3-4B-Instruct-2507 --dataset ${NAME}`);
    process.exit(0);
  }
  if (["failed", "error"].includes(status)) {
    console.error("\nProcessing failed:", JSON.stringify(info.json).slice(0, 500));
    process.exit(1);
  }
  await sleep(5000);
}
console.error("Timed out waiting for ready status.");
process.exit(1);
