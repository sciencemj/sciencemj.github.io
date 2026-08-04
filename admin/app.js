import { resolve, sep } from "node:path";
import { listActiveAssets } from "./asset-store.js";
import { parseProjects } from "./projects-store.js";
import { saveProjectTransaction } from "./save-transaction.js";
import { parsePosts, postUrl, slugError } from "./posts-store.js";
import { savePostTransaction } from "./post-transaction.js";

const ADMIN_FILES = new Map([
  ["/admin/", ["index.html", "text/html; charset=utf-8"]],
  ["/admin/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/admin/admin.css", ["admin.css", "text/css; charset=utf-8"]],
  ["/admin/admin.js", ["admin.js", "text/javascript; charset=utf-8"]],
  ["/admin/editor-model.js", ["editor-model.js", "text/javascript; charset=utf-8"]],
  ["/admin/editor-view.js", ["editor-view.js", "text/javascript; charset=utf-8"]],
  ["/admin/image-processor.js", ["image-processor.js", "text/javascript; charset=utf-8"]],
  ["/admin/posts", ["posts.html", "text/html; charset=utf-8"]],
  ["/admin/posts.html", ["posts.html", "text/html; charset=utf-8"]],
  ["/admin/posts.css", ["posts.css", "text/css; charset=utf-8"]],
  ["/admin/posts.js", ["posts.js", "text/javascript; charset=utf-8"]],
  ["/admin/posts-store.js", ["posts-store.js", "text/javascript; charset=utf-8"]],
  ["/admin/markdown.js", ["markdown.js", "text/javascript; charset=utf-8"]],
  ["/admin/draft.js", ["draft.js", "text/javascript; charset=utf-8"]],
]);

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

function clientError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.expose = true;
  return error;
}

function safePathname(pathname) {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(decodeURIComponent(pathname));
  } catch {
    return null;
  }
  if (decoded.includes("\\") || decoded.split("/").includes("..")) return null;
  return decoded;
}

function sameOrigin(request, port) {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";
  const origin = request.headers.get("origin");
  return !origin || origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw clientError("invalid-json", "Request body must be valid JSON.");
  }
}

async function readSaveBody(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    const body = await readJson(request);
    return { projects: body?.projects, uploads: new Map() };
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    throw clientError("invalid-multipart", "Request body must be valid multipart data.");
  }
  let projects;
  try {
    projects = JSON.parse(String(form.get("projects") || "null"));
  } catch {
    throw clientError("invalid-projects", "Projects must be valid JSON.");
  }
  const uploads = new Map();
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("asset:") || typeof value === "string") continue;
    const repo = key.slice(6);
    const matches = Array.isArray(projects) ? projects.filter((project) => project?.repo === repo) : [];
    if (matches.length !== 1 || !matches[0].preview?.src) {
      throw clientError("upload-target-mismatch", `Upload does not match project ${repo}.`);
    }
    uploads.set(repo, {
      bytes: new Uint8Array(await value.arrayBuffer()),
      target: matches[0].preview.src,
    });
  }
  return { projects, uploads };
}

async function readPostSaveBody(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    throw clientError("invalid-multipart", "Request body must be multipart data.");
  }
  let form;
  try {
    form = await request.formData();
  } catch {
    throw clientError("invalid-multipart", "Request body must be valid multipart data.");
  }
  let meta;
  try {
    meta = JSON.parse(String(form.get("meta") || "null"));
  } catch {
    throw clientError("invalid-meta", "Post metadata must be valid JSON.");
  }
  const images = new Map();
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("image:") || typeof value === "string") continue;
    images.set(key.slice(6), new Uint8Array(await value.arrayBuffer()));
  }
  return {
    meta,
    markdown: String(form.get("markdown") || ""),
    bodyHtml: String(form.get("html") || ""),
    images,
  };
}

function publicError(error) {
  const exposed = error?.expose === true;
  const code = exposed ? error.code : "save-failed";
  const status = exposed ? 400 : 500;
  const message = exposed ? error.message : "Unable to save.";
  return json({ ok: false, code, error: message, field: error.field || undefined, repo: error.repo || undefined }, status);
}

export function createAdminApp({ root, owner, port, gitRunner }) {
  const adminRoot = resolve(root, "admin");
  const assetsRoot = resolve(root, "assets");
  const postsRoot = resolve(root, "posts");
  const templatesRoot = resolve(root, "templates");
  const run = gitRunner || (async (command) => {
    const process = Bun.spawn(command, { cwd: root, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ]);
    return { cmd: command.join(" "), code, output: (stdout + stderr).trim() };
  });

  async function gitPush(message) {
    const steps = [];
    const add = await run([
      "git", "add",
      "assets/js/projects.data.js", "assets/img/projects",
      "assets/js/posts.data.js", "posts",
    ]);
    steps.push(add);
    if (add.code !== 0) return { ok: false, steps };
    const commit = await run(["git", "commit", "-m", message]);
    steps.push(commit);
    if (commit.code !== 0) {
      if (/nothing to commit|nothing added to commit|no changes added to commit/i.test(commit.output)) {
        return { ok: false, nothingToCommit: true, steps };
      }
      return { ok: false, steps };
    }
    const push = await run(["git", "push"]);
    steps.push(push);
    return { ok: push.code === 0, steps };
  }

  async function fetch(request) {
    const url = new URL(request.url);
    const pathname = safePathname(url.pathname);
    if (!pathname) return new Response("Forbidden", { status: 403 });

    if (pathname === "/") return new Response(null, { status: 302, headers: { location: "/admin/" } });

    const adminFile = ADMIN_FILES.get(pathname);
    if (adminFile) {
      const file = Bun.file(resolve(adminRoot, adminFile[0]));
      if (!await file.exists()) return new Response("Not found", { status: 404 });
      return new Response(file, { headers: { "content-type": adminFile[1] } });
    }

    if (pathname === "/api/projects" && request.method === "GET") {
      let projects = [];
      try { projects = parseProjects(await Bun.file(resolve(root, "assets/js/projects.data.js")).text()); } catch {}
      return json({ owner, projects });
    }

    if (pathname === "/api/assets" && request.method === "GET") {
      try {
        return json({ assets: await listActiveAssets(root) });
      } catch {
        return json({ assets: [] });
      }
    }

    if (pathname === "/api/posts" && request.method === "GET") {
      let posts = [];
      try { posts = parsePosts(await Bun.file(resolve(root, "assets/js/posts.data.js")).text()); } catch {}
      return json({ posts });
    }

    if (pathname.startsWith("/api/posts/") && request.method === "GET") {
      const slug = pathname.slice("/api/posts/".length);
      if (slugError(slug)) return json({ ok: false, error: "Invalid slug." }, 400);
      const source = Bun.file(resolve(root, "posts", slug + ".md"));
      if (!await source.exists()) return json({ ok: false, error: "No markdown source for this post." }, 404);
      let entry = null;
      try {
        const posts = parsePosts(await Bun.file(resolve(root, "assets/js/posts.data.js")).text());
        entry = posts.find((post) => post?.url === postUrl(slug)) || null;
      } catch {}
      return json({ ok: true, slug, entry, markdown: await source.text() });
    }

    if (pathname === "/api/posts/save" && request.method === "POST") {
      if (!sameOrigin(request, port)) return json({ ok: false, error: "cross-origin request rejected" }, 403);
      try {
        const body = await readPostSaveBody(request);
        const transactionId = new Date().toISOString().replace(/[-:.TZ]/g, "") + "-" + crypto.randomUUID().slice(0, 8);
        const result = await savePostTransaction({ root, transactionId, ...body });
        return json({ ok: true, ...result });
      } catch (error) {
        return publicError(error);
      }
    }

    if (pathname === "/api/save" && request.method === "POST") {
      if (!sameOrigin(request, port)) return json({ ok: false, error: "cross-origin request rejected" }, 403);
      try {
        const body = await readSaveBody(request);
        const transactionId = new Date().toISOString().replace(/[-:.TZ]/g, "") + "-" + crypto.randomUUID().slice(0, 8);
        const result = await saveProjectTransaction({ root, transactionId, ...body });
        return json({ ok: true, ...result });
      } catch (error) {
        return publicError(error);
      }
    }

    if (pathname === "/api/git" && request.method === "POST") {
      if (!sameOrigin(request, port)) return json({ ok: false, error: "cross-origin request rejected" }, 403);
      try {
        const body = await readJson(request);
        const message = typeof body.message === "string" && body.message.trim()
          ? body.message.trim()
          : "Update portfolio projects";
        return json(await gitPush(message));
      } catch (error) {
        return publicError(error);
      }
    }

    /* Read-only static roots the editor previews against. */
    for (const [prefix, base] of [["/assets/", assetsRoot], ["/posts/", postsRoot], ["/templates/", templatesRoot]]) {
      if (!pathname.startsWith(prefix)) continue;
      const target = resolve(root, "." + pathname);
      if (target !== base && !target.startsWith(base + sep)) return new Response("Forbidden", { status: 403 });
      const file = Bun.file(target);
      if (!await file.exists()) return new Response("Not found", { status: 404 });
      return new Response(file);
    }

    return new Response("Not found", { status: 404 });
  }

  return { fetch, gitPush };
}
