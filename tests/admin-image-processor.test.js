import { describe, expect, test } from "bun:test";
import Processor from "../admin/image-processor.js";

describe("admin image processor", () => {
  test("uses bounded descending quality steps", () => {
    expect(Processor.qualitySteps()).toEqual([.82, .78, .74, .70, .66, .62, .58, .54, .50]);
  });

  test("rejects unsupported source MIME types before decode", async () => {
    await expect(Processor.processImage({ type: "image/gif" })).rejects.toMatchObject({ code: "unsupported-image-type" });
  });

  test("crops to 1280x800 and lowers quality until under 180KB", async () => {
    const qualities = [];
    const draws = [];
    const revoked = [];
    let created = 0;
    const canvas = {
      getContext: () => ({ drawImage: (...args) => draws.push(args) }),
      toBlob(callback, _type, quality) {
        qualities.push(quality);
        callback(new Blob([new Uint8Array(quality === .82 ? 190 * 1024 : 170 * 1024)], { type: "image/webp" }));
      },
    };
    const result = await Processor.processImage({ type: "image/png" }, {
      decode: async () => ({ source: { width: 2000, height: 1000 }, width: 2000, height: 1000, url: "input-url" }),
      createCanvas: (width, height) => { expect([width, height]).toEqual([1280, 800]); return canvas; },
      createObjectURL: () => `blob:output-${++created}`,
      revokeObjectURL: (url) => revoked.push(url),
    });
    expect(qualities).toEqual([.82, .78]);
    expect(draws[0].slice(1)).toEqual([200, 0, 1600, 1000, 0, 0, 1280, 800]);
    expect(result).toMatchObject({ url: "blob:output-1", width: 1280, height: 800, size: 170 * 1024 });
    expect(revoked).toEqual(["input-url"]);
  });

  test("returns stable decode and encoding failures", async () => {
    await expect(Processor.processImage({ type: "image/jpeg" }, {
      decode: async () => { throw new Error("decoder detail"); },
    })).rejects.toMatchObject({ code: "image-decode-failed" });

    const canvas = {
      getContext: () => ({ drawImage() {} }),
      toBlob(callback) { callback(null); },
    };
    await expect(Processor.processImage({ type: "image/webp" }, {
      decode: async () => ({ source: { width: 1280, height: 800 }, width: 1280, height: 800 }),
      createCanvas: () => canvas,
      createObjectURL: () => "unused",
      revokeObjectURL() {},
    })).rejects.toMatchObject({ code: "webp-encode-failed" });
  });

  test("rejects output that stays over limit", async () => {
    const canvas = {
      getContext: () => ({ drawImage() {} }),
      toBlob(callback) { callback(new Blob([new Uint8Array(181 * 1024)], { type: "image/webp" })); },
    };
    await expect(Processor.processImage({ type: "image/png" }, {
      decode: async () => ({ source: { width: 1280, height: 800 }, width: 1280, height: 800 }),
      createCanvas: () => canvas,
      createObjectURL: () => "unused",
      revokeObjectURL() {},
    })).rejects.toMatchObject({ code: "asset-too-large" });
  });
});
