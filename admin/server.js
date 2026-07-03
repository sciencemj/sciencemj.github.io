// Local admin tool for the portfolio's featured-projects list.
// Zero dependencies — Bun stdlib only. Localhost only. Run: `bun admin/server.js`.
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const DATA_FILE = resolve(ROOT, "assets/js/projects.data.js");
const ADMIN_INDEX = resolve(import.meta.dir, "index.html");
const OWNER = "sciencemj";
const PORT = Number(process.env.PORT) || 4747;

// --- projects.data.js serialization (must stay byte-exact) ------------------
const HEADER =
  "/* Portfolio projects list — single source of truth for which repos appear on the site.\n" +
  "   Edited by the local admin tool (`bun admin/server.js`) or by hand.\n" +
  "   Array body must stay valid JSON: projects.js and the admin server both parse it. */";

function serialize(projects) {
  return (
    HEADER +
    "\n" +
    "window.PORTFOLIO_PROJECTS = [\n" +
    projects
      .map(
        (p) =>
          '  { "repo": ' +
          JSON.stringify(p.repo) +
          (p.report ? ', "report": ' + JSON.stringify(p.report) : "") +
          " }"
      )
      .join(",\n") +
    "\n];\n"
  );
}

async function readProjects() {
  try {
    const text = await Bun.file(DATA_FILE).text();
    // Greedy to the LAST `];` — the file always ends with the array terminator,
    // so a report string containing `];` no longer truncates the capture.
    const match = text.match(/window\.PORTFOLIO_PROJECTS\s*=\s*(\[[\s\S]*\]);/);
    if (!match) return [];
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

// --- validation -------------------------------------------------------------
const REPO_RE = /^[A-Za-z0-9_.-]+$/;

function validate(projects) {
  if (!Array.isArray(projects)) return "projects must be an array";
  for (const p of projects) {
    if (!p || typeof p !== "object") return "each project must be an object";
    if (typeof p.repo !== "string" || !REPO_RE.test(p.repo)) {
      return "invalid repo name: " + JSON.stringify(p.repo);
    }
    if (p.report !== undefined && p.report !== null && p.report !== "") {
      if (typeof p.report !== "string") return "report must be a string";
      if (p.report.startsWith("/")) return 'report must not start with "/"';
      if (p.report.split("/").includes("..")) return 'report must not contain a ".." segment';
    }
  }
  return null;
}

// --- git --------------------------------------------------------------------
async function run(cmd) {
  const proc = Bun.spawn(cmd, { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  return { cmd: cmd.join(" "), code, output: (stdout + stderr).trim() };
}

async function gitPush(message) {
  const steps = [];
  const add = await run(["git", "add", "assets/js/projects.data.js"]);
  steps.push(add);
  if (add.code !== 0) return { ok: false, steps };

  const commit = await run(["git", "commit", "-m", message]);
  steps.push(commit);
  if (commit.code !== 0) {
    // git phrases an empty commit differently depending on tree state:
    // "nothing to commit, working tree clean" / "nothing added to commit but
    // untracked files present" / "no changes added to commit".
    if (/nothing to commit|nothing added to commit|no changes added to commit/i.test(commit.output)) {
      return { ok: false, nothingToCommit: true, steps };
    }
    return { ok: false, steps };
  }

  const push = await run(["git", "push"]);
  steps.push(push);
  return { ok: push.code === 0, steps };
}

// --- helpers ----------------------------------------------------------------
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

async function readBody(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// Reject browser-driven cross-site requests to the mutating endpoints (CSRF).
// Modern browsers always attach Sec-Fetch-Site and cannot forge it from script;
// non-browser clients (curl) send neither header and are not a CSRF vector.
function isSameOrigin(req) {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";
  const origin = req.headers.get("origin");
  if (origin) return origin === "http://127.0.0.1:" + PORT;
  return true;
}

// --- server -----------------------------------------------------------------
Bun.serve({
  hostname: "127.0.0.1",
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/") {
      return new Response(null, { status: 302, headers: { Location: "/admin/" } });
    }

    if (path === "/admin/" || path === "/admin/index.html") {
      return new Response(Bun.file(ADMIN_INDEX), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (path === "/api/projects" && req.method === "GET") {
      return json({ owner: OWNER, projects: await readProjects() });
    }

    if (path === "/api/save" && req.method === "POST") {
      if (!isSameOrigin(req)) return json({ ok: false, error: "cross-origin request rejected" }, 403);
      const body = await readBody(req);
      const raw = body && body.projects;
      // Trim report values BEFORE validating so the guards run on the exact
      // string that gets serialized (leading whitespace can't smuggle past them).
      const projects = Array.isArray(raw)
        ? raw.map((p) =>
            p && typeof p === "object" && typeof p.report === "string"
              ? { ...p, report: p.report.trim() }
              : p
          )
        : raw;
      const err = validate(projects);
      if (err) return json({ ok: false, error: err }, 400);
      const clean = projects.map((p) => {
        const o = { repo: p.repo };
        if (typeof p.report === "string" && p.report !== "") o.report = p.report;
        return o;
      });
      await Bun.write(DATA_FILE, serialize(clean));
      return json({ ok: true, count: clean.length });
    }

    if (path === "/api/git" && req.method === "POST") {
      if (!isSameOrigin(req)) return json({ ok: false, error: "cross-origin request rejected" }, 403);
      const body = await readBody(req);
      const message =
        typeof body.message === "string" && body.message.trim()
          ? body.message.trim()
          : "Update featured projects";
      return json(await gitPush(message));
    }

    if (path.startsWith("/assets/")) {
      const decoded = decodeURIComponent(path);
      if (decoded.includes("..")) return new Response("Forbidden", { status: 403 });
      const resolved = resolve(ROOT + decoded);
      if (!resolved.startsWith(ROOT + "/assets/")) {
        return new Response("Forbidden", { status: 403 });
      }
      const file = Bun.file(resolved);
      if (!(await file.exists())) return new Response("Not found", { status: 404 });
      return new Response(file);
    }

    return new Response("Not found", { status: 404 });
  },
});

const homeUrl = "http://127.0.0.1:" + PORT + "/admin/";
console.log("Admin tool: " + homeUrl);
if (!process.argv.includes("--no-open")) {
  Bun.spawn(["open", homeUrl]);
}
