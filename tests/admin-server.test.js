import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { createAdminApp } from "../admin/app.js";
import { serializeProjects } from "../admin/projects-store.js";

const fixtures = [];
const sameOrigin = { origin: "http://127.0.0.1:4747" };

function project(src = "assets/img/projects/old.webp") {
  return { repo: "demo", categories: ["data-analysis"], preview: { kind: "chart", src, alt: "Demo" } };
}

async function makeFixture() {
  const root = await mkdtemp(resolve(tmpdir(), "admin-app-"));
  fixtures.push(root);
  await mkdir(resolve(root, "assets/js"), { recursive: true });
  await mkdir(resolve(root, "assets/img/projects"), { recursive: true });
  await mkdir(resolve(root, "admin"), { recursive: true });
  const bytes = new Uint8Array(await readFile(resolve(import.meta.dir, "../assets/img/projects/lcc-review.webp")));
  await writeFile(resolve(root, "assets/js/projects.data.js"), serializeProjects([project()]));
  await writeFile(resolve(root, "assets/img/projects/old.webp"), bytes);
  await writeFile(resolve(root, "admin/index.html"), "<h1>Admin</h1>");
  await writeFile(resolve(root, "admin/editor-model.js"), "window.Editor = {};");
  return { root, bytes };
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("admin HTTP app", () => {
  test("lists validated active assets", async () => {
    const fixture = await makeFixture();
    const app = createAdminApp({ root: fixture.root, owner: "sciencemj", port: 4747 });
    const response = await app.fetch(new Request("http://127.0.0.1:4747/api/assets"));
    expect(response.status).toBe(200);
    expect((await response.json()).assets[0]).toMatchObject({ path: "assets/img/projects/old.webp", width: 1280, height: 800 });
  });

  test("accepts multipart projects and repo-keyed uploads", async () => {
    const fixture = await makeFixture();
    const app = createAdminApp({ root: fixture.root, owner: "sciencemj", port: 4747 });
    const body = new FormData();
    body.set("projects", JSON.stringify([project("assets/img/projects/demo.webp")]));
    body.set("asset:demo", new File([fixture.bytes], "demo.webp", { type: "image/webp" }));
    const response = await app.fetch(new Request("http://127.0.0.1:4747/api/save", {
      method: "POST", headers: sameOrigin, body,
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, count: 1, savedAssets: ["assets/img/projects/demo.webp"] });
  });

  test("keeps JSON-only save compatibility", async () => {
    const fixture = await makeFixture();
    const app = createAdminApp({ root: fixture.root, owner: "sciencemj", port: 4747 });
    const response = await app.fetch(new Request("http://127.0.0.1:4747/api/save", {
      method: "POST",
      headers: { ...sameOrigin, "content-type": "application/json" },
      body: JSON.stringify({ projects: [{ ...project(), highlight: "Updated" }] }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, savedAssets: [] });
  });

  test("returns safe client errors for malformed multipart and missing association", async () => {
    const fixture = await makeFixture();
    const app = createAdminApp({ root: fixture.root, owner: "sciencemj", port: 4747 });
    const malformed = new FormData();
    malformed.set("projects", "not json");
    const malformedResponse = await app.fetch(new Request("http://127.0.0.1:4747/api/save", {
      method: "POST", headers: sameOrigin, body: malformed,
    }));
    expect(malformedResponse.status).toBe(400);
    expect(await malformedResponse.json()).toMatchObject({ ok: false, code: "invalid-projects" });

    const mismatch = new FormData();
    mismatch.set("projects", JSON.stringify([project("assets/img/projects/demo.webp")]));
    mismatch.set("asset:other", new File([fixture.bytes], "demo.webp", { type: "image/webp" }));
    const mismatchResponse = await app.fetch(new Request("http://127.0.0.1:4747/api/save", {
      method: "POST", headers: sameOrigin, body: mismatch,
    }));
    expect(mismatchResponse.status).toBe(400);
    expect(await mismatchResponse.json()).toMatchObject({ ok: false, code: "upload-target-mismatch" });
  });

  test("rejects cross-origin writes", async () => {
    const fixture = await makeFixture();
    const app = createAdminApp({ root: fixture.root, owner: "sciencemj", port: 4747 });
    const response = await app.fetch(new Request("http://127.0.0.1:4747/api/save", {
      method: "POST",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: JSON.stringify({ projects: [project()] }),
    }));
    expect(response.status).toBe(403);
  });

  test("serves frontend modules but denies archive paths", async () => {
    const fixture = await makeFixture();
    const app = createAdminApp({ root: fixture.root, owner: "sciencemj", port: 4747 });
    const moduleResponse = await app.fetch(new Request("http://127.0.0.1:4747/admin/editor-model.js"));
    expect(moduleResponse.status).toBe(200);
    expect(moduleResponse.headers.get("content-type")).toContain("javascript");
    const archiveResponse = await app.fetch(new Request("http://127.0.0.1:4747/.admin-archive/project-previews/tx/old.webp"));
    expect(archiveResponse.status).toBe(404);
    const traversal = await app.fetch(new Request("http://127.0.0.1:4747/assets/%252e%252e/.admin-archive/old.webp"));
    expect(traversal.status).toBe(403);
  });

  test("stages only config and active preview directory", async () => {
    const fixture = await makeFixture();
    const commands = [];
    const app = createAdminApp({
      root: fixture.root,
      owner: "sciencemj",
      port: 4747,
      gitRunner: async (command) => { commands.push(command); return { cmd: command.join(" "), code: 0, output: "ok" }; },
    });
    const response = await app.fetch(new Request("http://127.0.0.1:4747/api/git", {
      method: "POST",
      headers: { ...sameOrigin, "content-type": "application/json" },
      body: JSON.stringify({ message: "Update projects" }),
    }));
    expect(response.status).toBe(200);
    expect(commands[0]).toEqual([
      "git", "add",
      "assets/js/projects.data.js", "assets/img/projects",
      "assets/js/posts.data.js", "posts",
    ]);
    expect(commands).toHaveLength(3);
  });

  test("sanitizes unexpected filesystem failures", async () => {
    const fixture = await makeFixture();
    await rm(resolve(fixture.root, "assets/js/projects.data.js"));
    const app = createAdminApp({ root: fixture.root, owner: "sciencemj", port: 4747 });
    const response = await app.fetch(new Request("http://127.0.0.1:4747/api/save", {
      method: "POST",
      headers: { ...sameOrigin, "content-type": "application/json" },
      body: JSON.stringify({ projects: [project()] }),
    }));
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body).toEqual({ ok: false, code: "save-failed", error: "Unable to save." });
    expect(JSON.stringify(body)).not.toContain(fixture.root);
  });

  test("identifies the project responsible for a preview error", async () => {
    const fixture = await makeFixture();
    const app = createAdminApp({ root: fixture.root, owner: "sciencemj", port: 4747 });
    const response = await app.fetch(new Request("http://127.0.0.1:4747/api/save", {
      method: "POST",
      headers: { ...sameOrigin, "content-type": "application/json" },
      body: JSON.stringify({ projects: [project("assets/img/projects/missing.webp")] }),
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, code: "missing-preview", field: "preview", repo: "demo" });
  });
});
