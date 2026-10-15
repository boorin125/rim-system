// node --test deploy/updater/updater.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createUpdater, compareVersions, sameCommit, parseReleases, releasesBetween,
  setEnvVersion, setComposeVersion, hasHardcodedBuildInfo, parseEnv,
} from "./updater.mjs";

test("compareVersions", () => {
  assert.equal(compareVersions("1.0.29", "1.0.28"), 1);
  assert.equal(compareVersions("1.0.28", "1.0.28"), 0);
  assert.equal(compareVersions("1.0.9", "1.0.10"), -1);
  assert.equal(compareVersions(null, "1.0.0"), -1);
});

test("sameCommit matches short and long hashes", () => {
  assert.ok(sameCommit("a0c16db", "a0c16dbffffffff"));
  assert.ok(!sameCommit("a0c16db", "b0c16db"));
  assert.ok(!sameCommit(null, "a0c16db"));
});

test("releasesBetween: newer versions, or the same version when rebuilt", () => {
  const all = parseReleases(JSON.stringify({ releases: [
    { version: "1.0.30", date: "x", changes: [{ type: "new", text: "c" }], manual: ["run SQL"] },
    { version: "1.0.29", date: "x", changes: [{ type: "new", text: "b" }] },
    { version: "1.0.28", date: "x", changes: [{ type: "new", text: "a" }] },
  ] }));
  assert.deepEqual(releasesBetween(all, "1.0.28", "1.0.30").map((r) => r.version), ["1.0.30", "1.0.29"]);
  assert.deepEqual(releasesBetween(all, "1.0.28", "1.0.28").map((r) => r.version), ["1.0.28"]);
  assert.deepEqual(all[0].manual, ["run SQL"]);
  assert.deepEqual(parseReleases("not json"), []);
});

test("setComposeVersion / setEnvVersion / hardcoded build info", () => {
  const compose = "image: rubjobb/rim-backend:1.0.27\n    image: rubjobb/rim-frontend:latest\n    image: rubjobb/rim-backend:${RIM_VERSION:-latest}";
  const out = setComposeVersion(compose, "1.0.28", ["rubjobb/rim-backend", "rubjobb/rim-frontend"]);
  assert.match(out, /rim-backend:1\.0\.28\n/);
  assert.match(out, /rim-frontend:1\.0\.28/);
  assert.match(out, /\$\{RIM_VERSION:-latest\}/);
  assert.equal(setEnvVersion("A=1\nRIM_VERSION=1.0.27\n", "1.0.28"), "A=1\nRIM_VERSION=1.0.28\n");
  assert.equal(setEnvVersion("A=1\n", "1.0.28"), "A=1\nRIM_VERSION=1.0.28\n");
  assert.ok(hasHardcodedBuildInfo('      BUILD_DATE: "2026-06-08"'));
  assert.ok(!hasHardcodedBuildInfo("      BUILD_DATE: ${BUILD_DATE:-unknown}"));
  assert.deepEqual(parseEnv('DB_USER="rim"\n# c\nX=1'), { DB_USER: "rim", X: "1" });
});

/** A fake server: containers report the env of the image they were last created from. */
function fakeServer({ failBackendStart = false, imageVersion = "1.0.29", imageCommit = "bbbbbbb" } = {}) {
  const files = {
    "/srv/rim/docker-compose.yml": "image: rubjobb/rim-backend:1.0.28\nimage: rubjobb/rim-frontend:1.0.28\n",
    "/srv/rim/.env": "DB_USER=rimuser\nRIM_VERSION=1.0.28\n",
  };
  let backendEnv = ["RIM_VERSION=1.0.28", "GIT_COMMIT=aaaaaaa"];
  const calls = [];
  const images = {
    "rubjobb/rim-backend:stable": { Labels: { "rim.version": imageVersion, "rim.commit": imageCommit }, Env: [] },
    [`rubjobb/rim-backend:${imageVersion}`]: { Labels: { "rim.version": imageVersion, "rim.commit": imageCommit }, Env: [] },
  };
  const exec = async (cmd, args) => {
    const line = `${cmd} ${args.join(" ")}`;
    calls.push(line);
    if (cmd === "df") return { code: 0, out: "Filesystem 1K-blocks Used Available Use% Mounted\n/dev/x 100000000 1000 90000000 1% /" };
    if (cmd === "sh" && args[1].startsWith("wc -c")) return { code: 0, out: "2000000" };
    if (cmd === "docker" && args[0] === "container" && args[1] === "inspect") {
      if (args[4].includes(".Config.Env")) return { code: 0, out: JSON.stringify(backendEnv) };
      return { code: 0, out: JSON.stringify({ Running: true, Health: { Status: "healthy" } }) };
    }
    if (cmd === "docker" && args[0] === "image" && args[1] === "inspect") {
      const img = images[args[2]];
      return img ? { code: 0, out: JSON.stringify(img) } : { code: 1, out: "no such image" };
    }
    if (cmd === "docker" && args[0] === "run") return { code: 0, out: JSON.stringify({ releases: [{ version: imageVersion, changes: [{ type: "new", text: "x" }] }] }) };
    if (cmd === "docker" && args[0] === "compose" && args.includes("up") && args.at(-1) === "backend") {
      const target = files["/srv/rim/.env"].match(/RIM_VERSION=(.*)/)[1];
      if (failBackendStart && target !== "1.0.28") return { code: 1, out: "boom" };
      backendEnv = target === "1.0.28" ? ["RIM_VERSION=1.0.28", "GIT_COMMIT=aaaaaaa"] : [`RIM_VERSION=${target}`, `GIT_COMMIT=${imageCommit}`];
    }
    return { code: 0, out: "" };
  };
  return {
    files, calls,
    updater: createUpdater({
      exec, channel: "stable", rimDir: "/srv/rim", project: "rim",
      readFile: async (p) => files[p], writeFile: async (p, t) => { files[p] = t; },
      sleep: async () => {}, healthTimeoutMs: 1,
    }),
  };
}

test("check reports a newer version with its notes", async () => {
  const { updater } = fakeServer();
  const r = await updater.check();
  assert.equal(r.available, true);
  assert.deepEqual(r.current, { version: "1.0.28", commit: "aaaaaaa", buildDate: null });
  assert.equal(r.latest.version, "1.0.29");
  assert.deepEqual(r.releases.map((x) => x.version), ["1.0.29"]);
});

test("install: backup → set version → pull → backend → frontend+nginx", async () => {
  const s = fakeServer();
  await s.updater.start("1.0.29", "bbbbbbb");
  const st = s.updater.status();
  assert.equal(st.status, "done", st.error);
  assert.ok(st.steps.every((x) => x.status === "done"));
  assert.match(s.files["/srv/rim/docker-compose.yml"], /rim-backend:1\.0\.29/);
  assert.match(s.files["/srv/rim/.env"], /RIM_VERSION=1\.0\.29/);
  const order = s.calls.map((c) => (c.includes("pg_dump") ? "backup" : c.includes("compose") && c.includes(" pull ") ? "pull" : c.match(/force-recreate (\w+)/)?.[1])).filter(Boolean);
  assert.deepEqual(order, ["backup", "pull", "backend", "frontend", "nginx"]);
  assert.equal(st.history[0].toVersion, "1.0.29");
});

test("install rolls back files and containers when the backend does not start", async () => {
  const s = fakeServer({ failBackendStart: true });
  await s.updater.start("1.0.29", "bbbbbbb");
  const st = s.updater.status();
  assert.equal(st.status, "failed");
  assert.equal(st.rolledBack, true);
  assert.match(s.files["/srv/rim/docker-compose.yml"], /rim-backend:1\.0\.28/);
  assert.match(s.files["/srv/rim/.env"], /RIM_VERSION=1\.0\.28/);
});

test("install refuses an image whose commit differs from the checked one", async () => {
  const s = fakeServer({ imageCommit: "ccccccc" });
  await s.updater.start("1.0.29", "bbbbbbb");
  const st = s.updater.status();
  assert.equal(st.status, "failed");
  assert.match(st.error, /commit/);
  assert.match(s.files["/srv/rim/.env"], /RIM_VERSION=1\.0\.28/);
  assert.ok(!s.calls.some((c) => c.includes("force-recreate")), "nothing restarted");
});

test("start rejects bad input and a second install", async () => {
  const s = fakeServer();
  assert.throws(() => s.updater.start("v1.0.29", "bbbbbbb"));
  const job = s.updater.start("1.0.29", "bbbbbbb");
  assert.equal(s.updater.start("1.0.29", "bbbbbbb"), false);
  await job;
});
