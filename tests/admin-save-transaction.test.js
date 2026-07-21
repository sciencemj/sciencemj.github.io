import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { parseProjects, serializeProjects } from "../admin/projects-store.js";
import { saveProjectTransaction } from "../admin/save-transaction.js";

const fixtures = [];
const sourceAsset = resolve(import.meta.dir, "../assets/img/projects/lcc-review.webp");

function project(repo, src, alt = "Preview") {
  return { repo, categories: ["data-analysis"], preview: { kind: "chart", src, alt } };
}

async function makeFixture(projects = [project("demo", "assets/img/projects/old.webp")]) {
  const root = await mkdtemp(resolve(tmpdir(), "admin-save-"));
  fixtures.push(root);
  await mkdir(resolve(root, "assets/js"), { recursive: true });
  await mkdir(resolve(root, "assets/img/projects"), { recursive: true });
  await writeFile(resolve(root, "assets/js/projects.data.js"), serializeProjects(projects));
  const bytes = new Uint8Array(await readFile(sourceAsset));
  for (const src of new Set(projects.map((item) => item.preview?.src).filter(Boolean))) {
    await writeFile(resolve(root, src), bytes);
  }
  return { root, bytes, dataFile: resolve(root, "assets/js/projects.data.js") };
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("project save transaction", () => {
  test("saves config and upload and archives replaced image", async () => {
    const fixture = await makeFixture();
    const projects = [project("demo", "assets/img/projects/demo.webp", "Demo chart")];
    const result = await saveProjectTransaction({
      root: fixture.root,
      transactionId: "tx1",
      projects,
      uploads: new Map([["demo", { bytes: fixture.bytes, target: "assets/img/projects/demo.webp" }]]),
    });

    expect(result).toEqual({
      count: 1,
      savedAssets: ["assets/img/projects/demo.webp"],
      archivedAssets: [".admin-archive/project-previews/tx1/old.webp"],
    });
    expect(await Bun.file(resolve(fixture.root, result.archivedAssets[0])).exists()).toBe(true);
    expect(parseProjects(await Bun.file(fixture.dataFile).text())).toEqual(projects);
  });

  test("restores config and old image when config replacement fails", async () => {
    const fixture = await makeFixture();
    const before = await Bun.file(fixture.dataFile).text();
    const next = [project("demo", "assets/img/projects/demo.webp")];
    await expect(saveProjectTransaction({
      root: fixture.root,
      transactionId: "tx2",
      projects: next,
      uploads: new Map([["demo", { bytes: fixture.bytes, target: "assets/img/projects/demo.webp" }]]),
      hooks: { beforeConfigReplace() { throw new Error("injected"); } },
    })).rejects.toThrow("injected");

    expect(await Bun.file(fixture.dataFile).text()).toBe(before);
    expect(await Bun.file(resolve(fixture.root, "assets/img/projects/old.webp")).exists()).toBe(true);
    expect(await Bun.file(resolve(fixture.root, "assets/img/projects/demo.webp")).exists()).toBe(false);
    expect(await Bun.file(resolve(fixture.root, ".admin-tmp/project-editor/tx2")).exists()).toBe(false);
  });

  test("invalid upload writes nothing", async () => {
    const fixture = await makeFixture();
    const before = await Bun.file(fixture.dataFile).text();
    await expect(saveProjectTransaction({
      root: fixture.root,
      transactionId: "tx3",
      projects: [project("demo", "assets/img/projects/demo.webp")],
      uploads: new Map([["demo", { bytes: new Uint8Array([1, 2, 3]), target: "assets/img/projects/demo.webp" }]]),
    })).rejects.toMatchObject({ code: "invalid-webp", field: "preview" });
    expect(await Bun.file(fixture.dataFile).text()).toBe(before);
    expect(await Bun.file(resolve(fixture.root, "assets/img/projects/old.webp")).exists()).toBe(true);
  });

  test("rejects upload association mismatch and duplicate targets", async () => {
    const fixture = await makeFixture();
    await expect(saveProjectTransaction({
      root: fixture.root,
      transactionId: "tx4",
      projects: [project("demo", "assets/img/projects/demo.webp")],
      uploads: new Map([["other", { bytes: fixture.bytes, target: "assets/img/projects/demo.webp" }]]),
    })).rejects.toMatchObject({ code: "upload-target-mismatch" });

    await expect(saveProjectTransaction({
      root: fixture.root,
      transactionId: "tx5",
      projects: [project("demo", "assets/img/projects/shared.webp"), project("other", "assets/img/projects/shared.webp")],
      uploads: new Map([
        ["demo", { bytes: fixture.bytes, target: "assets/img/projects/shared.webp" }],
        ["other", { bytes: fixture.bytes, target: "assets/img/projects/shared.webp" }],
      ]),
    })).rejects.toMatchObject({ code: "duplicate-upload-target" });
  });

  test("keeps a shared asset when one project still references it", async () => {
    const shared = "assets/img/projects/shared.webp";
    const fixture = await makeFixture([project("one", shared), project("two", shared)]);
    const result = await saveProjectTransaction({
      root: fixture.root,
      transactionId: "tx6",
      projects: [project("one", "assets/img/projects/lcc-review.webp"), project("two", shared)],
      uploads: new Map([["one", { bytes: fixture.bytes, target: "assets/img/projects/lcc-review.webp" }]]),
    });
    expect(result.archivedAssets).toEqual([]);
    expect(await Bun.file(resolve(fixture.root, shared)).exists()).toBe(true);
  });

  test("supports metadata-only save and removes temporary files", async () => {
    const fixture = await makeFixture();
    const projects = [{ ...project("demo", "assets/img/projects/old.webp"), highlight: "Updated" }];
    const result = await saveProjectTransaction({
      root: fixture.root,
      transactionId: "tx7",
      projects,
      uploads: new Map(),
    });
    expect(result).toEqual({ count: 1, savedAssets: [], archivedAssets: [] });
    expect(parseProjects(await Bun.file(fixture.dataFile).text())).toEqual(projects);
    expect(await Bun.file(resolve(fixture.root, ".admin-tmp/project-editor/tx7")).exists()).toBe(false);
  });
});
