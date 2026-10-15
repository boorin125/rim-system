// HTTP front of the update worker (see updater.mjs), run as the `rim-updater` container. It is only
// reachable on the app's Docker network (no published port), needs UPDATER_SECRET, accepts a few
// fixed requests and never runs a command sent to it.
//
// Settings (deploy/updater/updater.env, written by setup-updater.sh):
//   UPDATER_SECRET  shared with the backend (.env UPDATER_SECRET)
//   UPDATE_CHANNEL  Docker Hub tag to follow: latest (Test) or stable (customers)
//   RIM_DIR         folder of the app's docker-compose.yml (mounted at the same path)
//   RIM_PROJECT     compose project name of the app

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { createUpdater } from "./updater.mjs";

const SECRET = process.env.UPDATER_SECRET ?? "";
const CHANNEL = /^[a-z0-9._-]{1,32}$/.test(process.env.UPDATE_CHANNEL ?? "") ? process.env.UPDATE_CHANNEL : "stable";
const RIM_DIR = process.env.RIM_DIR ?? "";
const RIM_PROJECT = process.env.RIM_PROJECT ?? "";
const PORT = Number(process.env.UPDATER_PORT ?? 3090);
const STATE_FILE = process.env.STATE_FILE ?? "/data/state.json";

if (!SECRET || !RIM_DIR || !RIM_PROJECT) {
  console.error("[updater] UPDATER_SECRET, RIM_DIR and RIM_PROJECT are required");
  process.exit(1);
}

function exec(cmd, args) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env.UPDATER_SECRET;
    const child = spawn(cmd, args, { cwd: RIM_DIR, env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("error", (e) => resolve({ code: 127, out: String(e) }));
    child.on("close", (code) => resolve({ code: code ?? 1, out }));
  });
}

let initial;
try {
  initial = JSON.parse(readFileSync(STATE_FILE, "utf8"));
} catch {}

const updater = createUpdater({
  exec,
  channel: CHANNEL,
  rimDir: RIM_DIR,
  project: RIM_PROJECT,
  initial,
  readFile: (p) => readFile(p, "utf8"),
  writeFile: (p, text) => writeFile(p, text),
  save: (s) => {
    try {
      writeFileSync(STATE_FILE, JSON.stringify(s), { mode: 0o600 });
    } catch {}
  },
});

function authorized(req) {
  const given = Buffer.from(req.headers.authorization ?? "");
  const expected = Buffer.from(`Bearer ${SECRET}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function send(res, code, body) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) break;
  }
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true });
  if (!authorized(req)) return send(res, 401, { error: "unauthorized" });
  try {
    if (req.method === "GET" && req.url === "/status") return send(res, 200, { channel: CHANNEL, ...updater.status() });
    if (req.method === "POST" && req.url === "/check") return send(res, 200, await updater.check());
    if (req.method === "POST" && req.url === "/update") {
      const { version, commit } = await readJson(req);
      let job;
      try {
        job = updater.start(version, commit);
      } catch {
        return send(res, 400, { error: "version/commit" });
      }
      if (job === false) return send(res, 409, { error: "running" });
      job.catch((e) => console.error("[updater] install", e));
      return send(res, 202, { started: true });
    }
    send(res, 404, { error: "not found" });
  } catch (error) {
    console.error("[updater]", error);
    send(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}).listen(PORT, "0.0.0.0", () => console.log(`[updater] listening on :${PORT}, channel ${CHANNEL}, dir ${RIM_DIR}, project ${RIM_PROJECT}`));
