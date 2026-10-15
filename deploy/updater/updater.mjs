// The update worker behind Settings › อัปเดตระบบ (same idea as RSM's deploy/updater, but for RIM's
// Docker install). It runs in its own container (rim-updater) next to the app — the app cannot
// replace itself while showing the progress — and does only fixed things: check the release
// channel (a Docker Hub tag) for a newer version, and install it.
// Commands go through an injected `exec`, so the order of steps and the roll-back can be tested
// without a server (updater.test.mjs).
//
// Install = back up the database → set the version (docker-compose.yml tags + RIM_VERSION in .env)
// → pull and verify the images → recreate backend and wait until it runs the new commit →
// recreate frontend + nginx → remove old images. If anything fails, docker-compose.yml and .env
// are put back and the previous images are started again (the database backup is kept for a
// manual restore — the backend's own `prisma db push` is not undone automatically).

export const STEPS = ["prepare", "backup", "pull", "backend", "frontend", "finish"];
const KEEP_HISTORY = 30;
const LOG_LINES = 400;
/** Two images (~1 GB) plus a database dump; refuse to start below this. */
export const MIN_FREE_BYTES = 2 * 1024 ** 3;
const VERSION_RE = /^\d+\.\d+\.\d+$/;
const COMMIT_RE = /^[0-9a-f]{7,40}$/;

/** Compare "1.0.28" style versions (missing/odd parts count as 0). */
export function compareVersions(a, b) {
  const pa = String(a ?? "").split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = String(b ?? "").split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

/** Same commit when one is a prefix of the other (images carry a 7-char short hash). */
export function sameCommit(a, b) {
  if (!a || !b) return false;
  const x = String(a).toLowerCase();
  const y = String(b).toLowerCase();
  return x.startsWith(y) || y.startsWith(x);
}

/** releases.json text → its list (missing or broken file = empty list). */
export function parseReleases(text) {
  try {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data?.releases;
    return Array.isArray(list)
      ? list
          .filter((r) => r && typeof r.version === "string")
          .map((r) => ({
            version: r.version,
            date: typeof r.date === "string" ? r.date : null,
            changes: Array.isArray(r.changes) ? r.changes.filter((c) => c && typeof c.text === "string").map((c) => ({ type: String(c.type ?? ""), text: c.text })) : [],
            manual: Array.isArray(r.manual) ? r.manual.filter((m) => typeof m === "string") : [],
          }))
      : [];
  } catch {
    return [];
  }
}

/** Release notes to show for an update from `current` to `latest`. */
export function releasesBetween(all, currentVersion, latestVersion) {
  const newer = all.filter((r) => compareVersions(r.version, currentVersion) > 0 && compareVersions(r.version, latestVersion) <= 0);
  // A rebuild of the same version (new commit) — show that version's notes.
  return newer.length ? newer : all.filter((r) => r.version === latestVersion);
}

/** `KEY=value` lines → object. */
export function parseEnv(text) {
  const env = {};
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}

/** Docker `Config.Env` list → object. */
export function envList(list) {
  const env = {};
  for (const item of Array.isArray(list) ? list : []) {
    const i = String(item).indexOf("=");
    if (i > 0) env[item.slice(0, i)] = item.slice(i + 1);
  }
  return env;
}

/** .env text with RIM_VERSION set (added when missing). */
export function setEnvVersion(text, version) {
  const t = String(text);
  if (/^RIM_VERSION=.*$/m.test(t)) return t.replace(/^RIM_VERSION=.*$/m, `RIM_VERSION=${version}`);
  return `${t.replace(/\s*$/, "")}\nRIM_VERSION=${version}\n`;
}

/** docker-compose.yml text with pinned rim-backend / rim-frontend tags set to `version`
 *  (files that use ${RIM_VERSION} are left as they are — .env drives them). */
export function setComposeVersion(text, version, images) {
  let t = String(text);
  for (const image of images) {
    const re = new RegExp(`(${image.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}):(?:\\d+\\.\\d+\\.\\d+|latest|stable)\\b`, "g");
    t = t.replace(re, `$1:${version}`);
  }
  return t;
}

/** Hardcoded BUILD_DATE / GIT_COMMIT in compose override the image's own values (see project notes). */
export function hasHardcodedBuildInfo(text) {
  return /^\s*(BUILD_DATE|GIT_COMMIT):\s*"?[0-9a-f-]/m.test(String(text));
}

/** `df -Pk <dir>` → bytes (null when it cannot be read). */
export function parseDf(out) {
  const cols = String(out).trim().split("\n").at(-1)?.trim().split(/\s+/) ?? [];
  const [total, used, avail] = cols.slice(1, 4).map((n) => Number.parseInt(n, 10) * 1024);
  return Number.isFinite(total) && Number.isFinite(avail) ? { total, used, avail } : null;
}

function entryOf(s) {
  return {
    startedAt: s.startedAt, finishedAt: s.finishedAt,
    fromVersion: s.fromVersion ?? null, toVersion: s.toVersion ?? null,
    from: s.from ?? null, to: s.to ?? null,
    status: s.status, rolledBack: !!s.rolledBack, error: s.error ?? null, backup: s.backup ?? null,
  };
}

function freshState() {
  return {
    status: "idle", steps: STEPS.map((key) => ({ key, status: "pending" })), log: [], error: null,
    from: null, to: null, fromVersion: null, toVersion: null, backup: null,
    startedAt: null, finishedAt: null, rollingBack: false, rolledBack: false, history: [],
  };
}

/**
 * @param {object} o
 * @param {(cmd: string, args: string[], opts?: object) => Promise<{ code: number, out: string }>} o.exec
 * @param {string} o.channel      Docker Hub tag this install follows ("latest" = Test, "stable" = customers)
 * @param {string} o.rimDir       folder of the app's docker-compose.yml + .env (same path as on the host)
 * @param {string} o.project      compose project name of the app
 * @param {(path: string) => Promise<string>} o.readFile
 * @param {(path: string, text: string) => Promise<void>} o.writeFile
 * @param {(s: object) => void} [o.save]
 * @param {object} [o.initial]
 * @param {(ms: number) => Promise<void>} [o.sleep]
 * @param {() => Date} [o.now]
 * @param {number} [o.healthTimeoutMs]
 * @param {string} [o.backendImage] @param {string} [o.frontendImage]
 */
export function createUpdater(o) {
  const sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = o.now ?? (() => new Date());
  const save = o.save ?? (() => {});
  const healthTimeoutMs = o.healthTimeoutMs ?? 240_000;
  const backendImage = o.backendImage ?? "rubjobb/rim-backend";
  const frontendImage = o.frontendImage ?? "rubjobb/rim-frontend";
  const composeFile = `${o.rimDir}/docker-compose.yml`;
  const envFile = `${o.rimDir}/.env`;

  let state = o.initial ?? freshState();
  if (state.status === "running") {
    // The worker restarted in the middle of an install (e.g. the server rebooted).
    state = { ...state, status: "failed", error: "interrupted", finishedAt: now().toISOString() };
    state.history = [entryOf(state), ...(state.history ?? [])].slice(0, KEEP_HISTORY);
    save(state);
  }
  if (!Array.isArray(state.history)) state.history = [];
  let checking = false;

  const log = (line) => {
    for (const l of String(line).replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").split(/\r?\n/)) if (l.trim()) state.log.push(l);
    if (state.log.length > LOG_LINES) state.log = state.log.slice(-LOG_LINES);
  };
  const step = (key, status) => {
    state.steps = state.steps.map((s) => (s.key === key ? { ...s, status } : s));
    save(state);
  };
  async function run(cmd, args) {
    log(`$ ${cmd} ${args.join(" ")}`);
    const r = await o.exec(cmd, args);
    if (r.out) log(r.out.length > 6000 ? `…${r.out.slice(-6000)}` : r.out);
    if (r.code !== 0) throw new Error(`${cmd} ${args.slice(0, 3).join(" ")} failed (${r.code})`);
    return r.out.trim();
  }
  async function quiet(cmd, args) {
    const r = await o.exec(cmd, args);
    if (r.code !== 0) throw new Error(`${cmd} ${args.slice(0, 3).join(" ")} failed (${r.code}): ${r.out.trim().slice(-300)}`);
    return r.out.trim();
  }
  const compose = (...args) => run("docker", ["compose", "--project-directory", o.rimDir, "-p", o.project, ...args]);

  async function inspectJson(kind, ref, format) {
    const r = await o.exec("docker", [kind, "inspect", ref, "--format", format]);
    if (r.code !== 0) return null;
    try {
      return JSON.parse(r.out);
    } catch {
      return null;
    }
  }

  /** Version info of what rim-backend runs now. */
  async function running() {
    const env = envList(await inspectJson("container", "rim-backend", "{{json .Config.Env}}"));
    return {
      version: env.RIM_VERSION || env.APP_VERSION || null,
      commit: env.GIT_COMMIT && env.GIT_COMMIT !== "unknown" ? env.GIT_COMMIT : null,
      buildDate: env.BUILD_DATE && env.BUILD_DATE !== "unknown" ? env.BUILD_DATE : null,
    };
  }

  /** Version info baked into a pulled backend image (labels from build-release.ps1, env as fallback). */
  async function imageInfo(ref) {
    const cfg = await inspectJson("image", ref, "{{json .Config}}");
    if (!cfg) return null;
    const labels = cfg.Labels ?? {};
    const env = envList(cfg.Env);
    return {
      version: labels["rim.version"] || env.APP_VERSION || null,
      commit: labels["rim.commit"] || (env.GIT_COMMIT !== "unknown" ? env.GIT_COMMIT : null) || null,
      buildDate: labels["rim.build-date"] || (env.BUILD_DATE !== "unknown" ? env.BUILD_DATE : null) || null,
    };
  }

  async function imageReleases(ref) {
    const r = await o.exec("docker", ["run", "--rm", "--entrypoint", "cat", ref, "/app/releases.json"]);
    return r.code === 0 ? parseReleases(r.out) : [];
  }

  /** What runs now, what the channel has, and the release notes in between. */
  async function check() {
    if (checking) throw new Error("check already running");
    checking = true;
    try {
      const channelRef = `${backendImage}:${o.channel}`;
      await quiet("docker", ["pull", "--quiet", channelRef]);
      const current = await running();
      const latest = (await imageInfo(channelRef)) ?? { version: null, commit: null, buildDate: null };
      const all = await imageReleases(channelRef);
      const releases = latest.version ? releasesBetween(all, current.version, latest.version) : [];
      const newer = compareVersions(latest.version, current.version) >= 0;
      return {
        channel: o.channel,
        current,
        latest,
        available: !!latest.version && !!latest.commit && VERSION_RE.test(latest.version) && newer && !sameCommit(latest.commit, current.commit),
        releases,
        manual: releases.flatMap((r) => r.manual),
        checkedAt: now().toISOString(),
      };
    } finally {
      checking = false;
    }
  }

  async function waitContainer(name, ok) {
    const until = now().getTime() + healthTimeoutMs;
    while (now().getTime() < until) {
      const st = await inspectJson("container", name, "{{json .State}}");
      if (st && (await ok(st))) return true;
      await sleep(3000);
    }
    return false;
  }
  /** Backend runs `commit` and is healthy (or running, for images without a HEALTHCHECK). */
  const backendUp = (commit) =>
    waitContainer("rim-backend", async (st) => {
      const healthy = st.Health ? st.Health.Status === "healthy" : st.Running === true;
      if (!healthy) return false;
      return !commit || sameCommit((await running()).commit, commit);
    });
  const isRunning = (name) => waitContainer(name, async (st) => st.Running === true && st.Restarting !== true);

  async function install(version, commit) {
    const prev = await running();
    state.from = prev.commit;
    state.fromVersion = prev.version;
    state.to = commit;
    state.toVersion = version;
    let phase = "before-files";
    let composeText = null;
    let envText = null;
    try {
      step("prepare", "running");
      log(`${prev.version ?? "?"} (${prev.commit ?? "?"}) → ${version} (${commit}) · channel ${o.channel}`);
      const free = parseDf((await o.exec("df", ["-Pk", o.rimDir])).out);
      if (free && free.avail < MIN_FREE_BYTES) throw new Error("disk full");
      composeText = await o.readFile(composeFile);
      envText = await o.readFile(envFile);
      if (hasHardcodedBuildInfo(composeText)) throw new Error("docker-compose.yml has hardcoded BUILD_DATE/GIT_COMMIT");
      step("prepare", "done");

      step("backup", "running");
      const env = parseEnv(envText);
      const dbUser = env.DB_USER || "rimuser";
      const dbName = env.DB_NAME || "rimdb";
      const stamp = now().toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 15);
      const file = `${o.rimDir}/backups/before_${version}_${stamp}.sql.gz`;
      const exclude = ["licenses", "license_activation_logs", "refresh_tokens", "password_reset_tokens", "push_subscriptions"]
        .map((t) => `--exclude-table-data=${t}`)
        .join(" ");
      await run("mkdir", ["-p", `${o.rimDir}/backups`]);
      await run("sh", ["-c", `set -o pipefail; docker exec rim-db pg_dump -U '${dbUser}' --clean --if-exists ${exclude} '${dbName}' | gzip > '${file}'`]);
      const size = Number.parseInt(await quiet("sh", ["-c", `wc -c < '${file}'`]), 10);
      if (!(size > 100_000)) throw new Error(`database backup too small (${size} bytes)`);
      state.backup = file;
      log(`backup: ${file} (${Math.round(size / 1024)} KB)`);
      step("backup", "done");

      step("pull", "running");
      phase = "files";
      await o.writeFile(composeFile, setComposeVersion(composeText, version, [backendImage, frontendImage]));
      await o.writeFile(envFile, setEnvVersion(envText, version));
      await compose("pull", "backend", "frontend");
      const img = await imageInfo(`${backendImage}:${version}`);
      if (!img || img.version !== version) throw new Error(`backend image is ${img?.version ?? "missing"}, not ${version}`);
      if (!sameCommit(img.commit, commit)) throw new Error(`backend image commit is ${img.commit}, not ${commit}`);
      step("pull", "done");

      step("backend", "running");
      phase = "switched";
      await compose("up", "-d", "--no-deps", "--force-recreate", "backend");
      if (!(await backendUp(commit))) throw new Error("backend did not start");
      step("backend", "done");

      step("frontend", "running");
      await compose("up", "-d", "--no-deps", "--force-recreate", "frontend");
      // nginx caches the backend's address — always recreate it after the backend.
      await compose("up", "-d", "--no-deps", "--force-recreate", "nginx");
      if (!(await isRunning("rim-frontend")) || !(await isRunning("rim-nginx"))) throw new Error("frontend/nginx did not start");
      step("frontend", "done");

      step("finish", "running");
      await o.exec("docker", ["image", "prune", "-af"]);
      step("finish", "done");
      state.status = "done";
    } catch (error) {
      log(`error: ${error instanceof Error ? error.message : String(error)}`);
      state.error = error instanceof Error ? error.message : String(error);
      state.steps = state.steps.map((s) => (s.status === "running" ? { ...s, status: "failed" } : s));
      state.rollingBack = true;
      save(state);
      await rollBack({ phase, prev, composeText, envText });
      state.rollingBack = false;
      state.status = "failed";
    }
    state.finishedAt = now().toISOString();
    state.history = [entryOf(state), ...(state.history ?? [])].slice(0, KEEP_HISTORY);
    save(state);
  }

  async function rollBack({ phase, prev, composeText, envText }) {
    if (phase === "before-files") {
      state.rolledBack = true;
      log("nothing was changed — still on the previous version");
      return;
    }
    // Every step is tried even when an earlier one fails: getting RIM back matters most.
    const attempt = async (what, fn) => {
      try {
        await fn();
        return true;
      } catch (error) {
        log(`roll-back: ${what} failed: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    };
    log("rolling back");
    let ok = true;
    ok = (await attempt("restore docker-compose.yml", () => o.writeFile(composeFile, composeText))) && ok;
    ok = (await attempt("restore .env", () => o.writeFile(envFile, envText))) && ok;
    if (phase === "switched") {
      ok = (await attempt("backend", () => compose("up", "-d", "--no-deps", "--force-recreate", "backend"))) && ok;
      ok = (await backendUp(prev.commit)) && ok;
      ok = (await attempt("frontend", () => compose("up", "-d", "--no-deps", "--force-recreate", "frontend"))) && ok;
      ok = (await attempt("nginx", () => compose("up", "-d", "--no-deps", "--force-recreate", "nginx"))) && ok;
    }
    state.rolledBack = ok;
    log(ok ? "back on the previous version" : "previous version is not fully back — check the server");
    if (state.backup) log(`database backup kept: ${state.backup}`);
  }

  return {
    status: () => state,
    check,
    /** Start installing `version` (`commit` = what /check reported); false when busy. */
    start(version, commit) {
      if (state.status === "running" || checking) return false;
      if (!VERSION_RE.test(String(version)) || !COMMIT_RE.test(String(commit))) throw new Error("bad version/commit");
      state = { ...freshState(), history: state.history ?? [], status: "running", startedAt: now().toISOString() };
      save(state);
      return install(version, commit);
    },
  };
}
