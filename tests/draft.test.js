import { describe, expect, test } from "bun:test";
import { DRAFT_PREFIX, draftKeyFor, imagePaths, makeDraft, shouldOffer, worthKeeping } from "../admin/draft.js";

const META = {
  title: "역전파의 원리", slug: "backprop", date: "2026-08-04",
  kind: "Post", lang: "ko", lead: "체인 룰.", tags: ["Deep learning"],
};

describe("draftKeyFor", () => {
  test("keys an existing post by the slug it was opened with", () => {
    expect(draftKeyFor("backprop")).toBe(DRAFT_PREFIX + "backprop");
  });

  test("a new post gets one stable key, so typing a title cannot scatter drafts", () => {
    expect(draftKeyFor(null)).toBe(draftKeyFor(""));
    expect(draftKeyFor(null)).toBe(draftKeyFor(undefined));
  });
});

describe("makeDraft", () => {
  test("carries every field the editor needs to restore", () => {
    const draft = makeDraft(META, "## 소제목", "2026-08-04T09:00:00.000Z");
    expect(draft).toEqual({ ...META, markdown: "## 소제목", savedAt: "2026-08-04T09:00:00.000Z" });
  });

  test("fills in defaults rather than storing undefined", () => {
    const draft = makeDraft({}, null, "");
    expect(draft.markdown).toBe("");
    expect(draft.tags).toEqual([]);
    expect(draft.kind).toBe("Post");
    expect(JSON.stringify(draft)).not.toContain("null");
  });
});

describe("worthKeeping", () => {
  test("an empty editor is not worth a draft", () => {
    expect(worthKeeping(makeDraft({}, "   ", ""))).toBe(false);
    expect(worthKeeping(null)).toBe(false);
  });

  test("a title alone is enough", () => {
    expect(worthKeeping(makeDraft({ title: "x" }, "", ""))).toBe(true);
  });

  test("body text alone is enough", () => {
    expect(worthKeeping(makeDraft({}, "본문", ""))).toBe(true);
  });
});

describe("shouldOffer", () => {
  const draft = makeDraft(META, "## 소제목", "2026-08-04T09:00:00.000Z");

  test("offers when the draft differs from the loaded post", () => {
    expect(shouldOffer(draft, { markdown: "## 다른 내용", title: META.title })).toBe(true);
    expect(shouldOffer(draft, { markdown: "## 소제목", title: "Different" })).toBe(true);
  });

  test("stays quiet when the draft matches what is already loaded", () => {
    expect(shouldOffer(draft, { markdown: "## 소제목", title: META.title })).toBe(false);
  });

  test("stays quiet when there is no draft or nothing in it", () => {
    expect(shouldOffer(null, { markdown: "", title: "" })).toBe(false);
    expect(shouldOffer(makeDraft({}, "", ""), { markdown: "", title: "" })).toBe(false);
  });

  test("offers a draft written against a blank new post", () => {
    expect(shouldOffer(draft, { markdown: "", title: "" })).toBe(true);
  });
});

describe("imagePaths", () => {
  test("finds each referenced image once", () => {
    const markdown = "![a](assets/backprop-1.webp)\n\ntext\n\n![b](assets/backprop-2.webp)\n\n![a again](assets/backprop-1.webp)";
    expect(imagePaths(markdown)).toEqual(["assets/backprop-1.webp", "assets/backprop-2.webp"]);
  });

  test("ignores anything that is not a local webp", () => {
    expect(imagePaths("![x](https://example.com/a.png)")).toEqual([]);
    expect(imagePaths("")).toEqual([]);
    expect(imagePaths(null)).toEqual([]);
  });
});
