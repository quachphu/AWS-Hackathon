/**
 * A's lane — prove the gateway env values work, end to end, in one command.
 *
 *   node scripts/smoke-gateway.mjs            # uses BASE_MODEL from .env.local
 *   node scripts/smoke-gateway.mjs <model-id> # test any model id (e.g. the Pioneer one later)
 *
 * Reads TRUEFOUNDRY_GATEWAY_URL / TRUEFOUNDRY_API_KEY / BASE_MODEL from .env.local.
 */
import { readFileSync, existsSync } from "node:fs";

const envPath = new URL("../.env.local", import.meta.url);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*("?)(.*?)\2\s*(#.*)?$/);
    if (m && m[3] && !(m[1] in process.env)) process.env[m[1]] = m[3];
  }
}

const base = process.env.TRUEFOUNDRY_GATEWAY_URL?.replace(/\/+$/, "");
const key = process.env.TRUEFOUNDRY_API_KEY;
const model = process.argv[2] ?? process.env.BASE_MODEL;

if (!base || !key || !model) {
  console.error(
    "Missing values. .env.local needs TRUEFOUNDRY_GATEWAY_URL, TRUEFOUNDRY_API_KEY, and BASE_MODEL (or pass a model id as the first arg)."
  );
  process.exit(1);
}

console.log(`gateway : ${base}`);
console.log(`model   : ${model}`);

const t0 = Date.now();
const res = await fetch(`${base}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
  body: JSON.stringify({
    model,
    messages: [
      { role: "system", content: "Reply with exactly: gateway-ok" },
      { role: "user", content: "ping" },
    ],
  }),
});
const latency = Date.now() - t0;
const body = await res.text();

if (!res.ok) {
  console.error(`FAIL    : HTTP ${res.status} in ${latency}ms`);
  console.error(body);
  console.error(
    "\nUsual suspects: model id not exactly as shown in the gateway playground snippet, key not a Personal Access Token, or base URL missing its full /api/llm/... path."
  );
  process.exit(1);
}

const json = JSON.parse(body);
console.log(`reply   : ${json.choices?.[0]?.message?.content?.trim()}`);
console.log(`tokens  : ${json.usage?.prompt_tokens} in / ${json.usage?.completion_tokens} out`);
console.log(`latency : ${latency}ms`);
console.log("\nGateway OK — /api/draft will now serve real drafts with these values.");
