import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  archiveRelativePath,
  listActiveAssets,
  readWebpDimensions,
  resolveInside,
  validatePreviewPath,
  validateWebp,
} from "../admin/asset-store.js";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

function vp8x(width, height) {
  const bytes = new Uint8Array(30);
  bytes.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0);
  new DataView(bytes.buffer).setUint32(4, 22, true);
  bytes.set([..."WEBPVP8X"].map((c) => c.charCodeAt(0)), 8);
  new DataView(bytes.buffer).setUint32(16, 10, true);
  const w = width - 1, h = height - 1;
  bytes[24] = w & 255; bytes[25] = (w >> 8) & 255; bytes[26] = (w >> 16) & 255;
  bytes[27] = h & 255; bytes[28] = (h >> 8) & 255; bytes[29] = (h >> 16) & 255;
  return bytes;
}

describe("admin asset store", () => {
  test("reads and validates dimensions from real project WebPs", async () => {
    const names = ["lcc-review", "steam-review", "book-review", "seoul-bike", "pybacktest"];
    for (const name of names) {
      const bytes = new Uint8Array(await Bun.file(resolve(import.meta.dir, `../assets/img/projects/${name}.webp`)).arrayBuffer());
      expect(readWebpDimensions(bytes)).toEqual({ width: 1280, height: 800 });
      expect(validateWebp(bytes)).toBeNull();
    }
  });

  test("rejects invalid, incorrectly sized, and oversized WebPs", () => {
    expect(validateWebp(new Uint8Array([1, 2, 3]))).toBe("invalid-webp");
    expect(validateWebp(vp8x(640, 400))).toBe("wrong-dimensions");
    const large = new Uint8Array(180 * 1024 + 1);
    large.set(vp8x(1280, 800));
    expect(validateWebp(large)).toBe("asset-too-large");
  });

  test.each([
    "../secret.webp",
    "assets/img/projects/../secret.webp",
    "assets/img/projects/%2e%2e/secret.webp",
    "assets/img/projects/%252e%252e/secret.webp",
    "assets\\img\\projects\\secret.webp",
    "assets/img/projects/archive/old.webp",
    "/assets/img/projects/demo.webp",
    "assets/img/projects/demo.png",
  ])("rejects unsafe active path %s", (path) => {
    expect(validatePreviewPath(path)).not.toBeNull();
  });

  test("accepts one direct active WebP path", () => {
    expect(validatePreviewPath("assets/img/projects/demo.webp")).toBeNull();
  });

  test("creates a safe timestamped archive path", () => {
    expect(archiveRelativePath("20260721T183000", "assets/img/projects/demo.webp"))
      .toBe(".admin-archive/project-previews/20260721T183000/demo.webp");
  });

  test("lists only direct active WebP files with metadata", async () => {
    const assets = await listActiveAssets(resolve(import.meta.dir, ".."));
    expect(assets).toHaveLength(5);
    expect(assets[0]).toHaveProperty("path");
    expect(new Set(assets.map((asset) => `${asset.width}x${asset.height}`))).toEqual(new Set(["1280x800"]));
  });

  test("rejects an active file symlink that resolves outside the repository", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "admin-assets-root-"));
    const outside = await mkdtemp(resolve(tmpdir(), "admin-assets-outside-"));
    try {
      await mkdir(resolve(root, "assets/img/projects"), { recursive: true });
      await writeFile(resolve(outside, "secret.webp"), vp8x(1280, 800));
      await symlink(resolve(outside, "secret.webp"), resolve(root, "assets/img/projects/link.webp"));
      await expect(resolveInside(root, "assets/img/projects/link.webp")).rejects.toThrow("path escapes active directory");
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  test("rejects an active directory symlink that resolves outside the repository", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "admin-assets-root-"));
    const outside = await mkdtemp(resolve(tmpdir(), "admin-assets-outside-"));
    try {
      await mkdir(resolve(root, "assets/img"), { recursive: true });
      await writeFile(resolve(outside, "demo.webp"), vp8x(1280, 800));
      await symlink(outside, resolve(root, "assets/img/projects"));
      await expect(resolveInside(root, "assets/img/projects/demo.webp")).rejects.toThrow("path escapes active directory");
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });
});
