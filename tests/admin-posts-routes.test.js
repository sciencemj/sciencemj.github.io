import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createAdminApp } from "../admin/app.js";
import { parsePosts, serializePosts } from "../admin/posts-store.js";

const REPO = resolve(import.meta.dir, "..");
const PORT = 4747;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const sameOrigin = { "sec-fetch-site": "same-origin" };
const roots = [];

async function makeApp(posts = []) {
  const root = await mkdtemp(resolve(tmpdir(), "admin-posts-"));
  roots.push(root);
  await mkdir(resolve(root, "assets/js"), { recursive: true });
  await mkdir(resolve(root, "admin"), { recursive: true });
  await mkdir(resolve(root, "posts"), { recursive: true });
  await mkdir(resolve(root, "templates"), { recursive: true });
  await writeFile(resolve(root, "assets/js/posts.data.js"), serializePosts(posts));
  await writeFile(resolve(root, "assets/js/projects.data.js"), "window.PORTFOLIO_PROJECTS = [\n];\n");
  await writeFile(resolve(root, "assets/js/secret.js"), "// not reachable through /posts/");
  for (const name of ["posts.html", "posts.js", "posts.css", "posts-store.js", "markdown.js", "draft.js"]) {
    await writeFile(resolve(root, "admin", name), await readFile(resolve(REPO, "admin", name)));
  }
  await writeFile(resolve(root, "templates/post-template.html"), await readFile(resolve(REPO, "templates/post-template.html")));
  return { root, app: createAdminApp({ root, owner: "sciencemj", port: PORT }) };
}

function saveForm(overrides = {}) {
  const form = new FormData();
  form.set("meta", JSON.stringify(overrides.meta ?? {
    slug: "backprop", title: "역전파의 원리", date: "2026-08-04",
    kind: "Post", lang: "ko", lead: "체인 룰.", tags: ["Deep learning"],
  }));
  form.set("markdown", overrides.markdown ?? "## 소제목\n\n본문 $a_1$.");
  form.set("html", overrides.html ?? "<h2>소제목</h2>\n<p>본문 $a_1$.</p>");
  for (const [name, blob] of Object.entries(overrides.images || {})) form.set("image:" + name, blob, "upload.webp");
  return form;
}

const post = (app, path, init) => app.fetch(new Request(ORIGIN + path, { method: "POST", ...init }));
const get = (app, path) => app.fetch(new Request(ORIGIN + path));

afterEach(async () => {
  while (roots.length) await rm(roots.pop(), { recursive: true, force: true });
});

describe("post editor routes", () => {
  test("serves the editor page and its modules", async () => {
    const { app } = await makeApp();
    for (const path of ["/admin/posts", "/admin/posts.js", "/admin/posts-store.js", "/admin/markdown.js", "/admin/draft.js", "/admin/posts.css"]) {
      expect((await get(app, path)).status, path).toBe(200);
    }
    expect((await get(app, "/templates/post-template.html")).status).toBe(200);
  });

  test("lists existing posts", async () => {
    const { app } = await makeApp([{ date: "2026-01-01", kind: "Post", lang: "en", title: "Old", url: "posts/old.html" }]);
    const body = await (await get(app, "/api/posts")).json();
    expect(body.posts).toHaveLength(1);
    expect(body.posts[0].title).toBe("Old");
  });

  test("saves a post end to end, then reads its markdown back", async () => {
    const { app, root } = await makeApp();
    const response = await post(app, "/api/posts/save", { headers: sameOrigin, body: saveForm() });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({ ok: true, created: true, url: "posts/backprop.html" });

    const page = await readFile(resolve(root, "posts/backprop.html"), "utf8");
    expect(page).toContain("<h2>소제목</h2>");
    expect(page).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(page).not.toContain("Post shell.");

    const posts = parsePosts(await readFile(resolve(root, "assets/js/posts.data.js"), "utf8"));
    expect(posts[0].url).toBe("posts/backprop.html");

    const reopened = await (await get(app, "/api/posts/backprop")).json();
    expect(reopened.ok).toBe(true);
    expect(reopened.markdown).toContain("## 소제목");
    expect(reopened.entry.title).toBe("역전파의 원리");
  });

  test("stores an uploaded image and serves it back for the preview", async () => {
    const { app, root } = await makeApp();
    const bytes = await readFile(resolve(REPO, "assets/img/projects/lcc-review.webp"));
    const images = { "assets/backprop-1.webp": new Blob([bytes], { type: "image/webp" }) };
    const result = await (await post(app, "/api/posts/save", { headers: sameOrigin, body: saveForm({ images }) })).json();

    expect(result.images).toEqual(["posts/assets/backprop-1.webp"]);
    expect(await Bun.file(resolve(root, "posts/assets/backprop-1.webp")).exists()).toBe(true);
    expect((await get(app, "/posts/assets/backprop-1.webp")).status).toBe(200);
  });

  test("accepts a real SVG and serves it back as SVG", async () => {
    const { app, root } = await makeApp();
    const svg = await readFile(resolve(REPO, "assets/img/logomark.svg"));
    const images = { "assets/backprop-1.svg": new Blob([svg], { type: "image/svg+xml" }) };
    const result = await (await post(app, "/api/posts/save", { headers: sameOrigin, body: saveForm({ images }) })).json();

    expect(result.images).toEqual(["posts/assets/backprop-1.svg"]);
    const served = await get(app, "/posts/assets/backprop-1.svg");
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toContain("svg");
    expect(await Bun.file(resolve(root, "posts/assets/backprop-1.svg")).text()).toContain("<svg");
  });

  test("rejects a cross-origin save", async () => {
    const { app, root } = await makeApp();
    const response = await post(app, "/api/posts/save", {
      headers: { "sec-fetch-site": "cross-site" },
      body: saveForm(),
    });
    expect(response.status).toBe(403);
    expect(await Bun.file(resolve(root, "posts/backprop.html")).exists()).toBe(false);
  });

  test("reports invalid metadata without writing anything", async () => {
    const { app, root } = await makeApp();
    const meta = { slug: "Bad Slug", title: "x", date: "2026-08-04", kind: "Post", lang: "ko", tags: [] };
    const response = await post(app, "/api/posts/save", { headers: sameOrigin, body: saveForm({ meta }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/slug/i);
    expect(parsePosts(await readFile(resolve(root, "assets/js/posts.data.js"), "utf8"))).toEqual([]);
  });

  test("an unknown slug does not leak the filesystem", async () => {
    const { app } = await makeApp();
    expect((await get(app, "/api/posts/does-not-exist")).status).toBe(404);
    /* Encoded traversal is caught by the path guard before routing. */
    expect((await get(app, "/api/posts/..%2F..%2Fetc")).status).toBe(403);
  });

  test("the posts route cannot be walked out of", async () => {
    const { app } = await makeApp();
    /* Written encoded on purpose: the URL constructor would silently normalise a
       literal ".." away, and then this would test nothing. */
    expect((await get(app, "/posts/..%2F..%2Fassets/js/secret.js")).status).toBe(403);
    expect((await get(app, "/posts/%2e%2e%2fassets/js/secret.js")).status).toBe(403);
    expect((await get(app, "/posts/nothing-here.webp")).status).toBe(404);
  });
});
