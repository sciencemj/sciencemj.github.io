// Local admin tool for the portfolio's featured-projects list.
// Zero dependencies — Bun stdlib only. Localhost only. Run: `bun admin/server.js`.
import { resolve } from "node:path";
import { cleanProjects, parseProjects, serializeProjects, validateProjects } from "./projects-store.js";

const ROOT = resolve(import.meta.dir, "..");
const DATA_FILE = resolve(ROOT, "assets/js/projects.data.js");
const ADMIN_INDEX = resolve(import.meta.dir, "index.html");
const OWNER = "sciencemj";
const PORT = Number(process.env.PORT) || 4747;

async function readProjects() {
  try { return parseProjects(await Bun.file(DATA_FILE).text()); }
  catch { return []; }
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
      const projects = body && body.projects;
      const err = validateProjects(projects);
      if (err) return json({ ok: false, error: err }, 400);
      const clean = cleanProjects(projects);
      await Bun.write(DATA_FILE, serializeProjects(clean));
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
