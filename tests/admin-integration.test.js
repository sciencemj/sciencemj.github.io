import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { createAdminApp } from "../admin/app.js";
import { serializeProjects } from "../admin/projects-store.js";

const roots = [];
const origin = { origin: "http://127.0.0.1:4747" };

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("real handler persists valid multipart save and leaves bytes intact after invalid save", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "admin-integration-"));
  roots.push(root);
  await mkdir(resolve(root, "assets/js"), { recursive: true });
  await mkdir(resolve(root, "assets/img/projects"), { recursive: true });
  const validBytes = new Uint8Array(await readFile(resolve(import.meta.dir, "../assets/img/projects/lcc-review.webp")));
  const oldProject = { repo: "demo", categories: ["data-analysis"], preview: { kind: "chart", src: "assets/img/projects/old.webp", alt: "Old" } };
  await writeFile(resolve(root, "assets/js/projects.data.js"), serializeProjects([oldProject]));
  await writeFile(resolve(root, "assets/img/projects/old.webp"), validBytes);
  const app = createAdminApp({ root, owner: "sciencemj", port: 4747 });

  const nextProject = { ...oldProject, highlight: "Updated", preview: { ...oldProject.preview, src: "assets/img/projects/demo.webp", alt: "New" } };
  const validBody = new FormData();
  validBody.set("projects", JSON.stringify([nextProject]));
  validBody.set("asset:demo", new File([validBytes], "demo.webp", { type: "image/webp" }));
  const saved = await app.fetch(new Request("http://127.0.0.1:4747/api/save", { method: "POST", headers: origin, body: validBody }));
  expect(saved.status).toBe(200);
  const savedResult = await saved.json();
  expect(savedResult).toMatchObject({ ok: true, savedAssets: ["assets/img/projects/demo.webp"] });
  expect(savedResult.archivedAssets).toHaveLength(1);
  expect(await Bun.file(resolve(root, savedResult.archivedAssets[0])).exists()).toBe(true);

  const projectsResponse = await app.fetch(new Request("http://127.0.0.1:4747/api/projects"));
  expect((await projectsResponse.json()).projects).toEqual([nextProject]);
  const assetsResponse = await app.fetch(new Request("http://127.0.0.1:4747/api/assets"));
  expect((await assetsResponse.json()).assets.map((asset) => asset.path)).toEqual(["assets/img/projects/demo.webp"]);

  const configBefore = new Uint8Array(await readFile(resolve(root, "assets/js/projects.data.js")));
  const assetBefore = new Uint8Array(await readFile(resolve(root, "assets/img/projects/demo.webp")));
  const invalidBody = new FormData();
  invalidBody.set("projects", JSON.stringify([{ ...nextProject, highlight: "Must not persist" }]));
  invalidBody.set("asset:demo", new File([new Uint8Array([1, 2, 3])], "demo.webp", { type: "image/webp" }));
  const rejected = await app.fetch(new Request("http://127.0.0.1:4747/api/save", { method: "POST", headers: origin, body: invalidBody }));
  expect(rejected.status).toBe(400);
  expect(new Uint8Array(await readFile(resolve(root, "assets/js/projects.data.js")))).toEqual(configBefore);
  expect(new Uint8Array(await readFile(resolve(root, "assets/img/projects/demo.webp")))).toEqual(assetBefore);
});
