const { describe, expect, test } = require("bun:test");
const Model = require("../assets/js/project-model.js");

describe("project model", () => {
  test("normalizes supported asset previews", () => {
    const project = Model.normalizeProject({
      repo: "demo",
      featured: true,
      categories: ["data-analysis", "invalid"],
      preview: { kind: "chart", src: "assets/img/projects/demo.webp", alt: "Demo chart" },
    });
    expect(project.featured).toBe(true);
    expect(project.categories).toEqual(["data-analysis"]);
    expect(project.preview).toEqual({ kind: "chart", src: "assets/img/projects/demo.webp", alt: "Demo chart", fallback: false });
  });

  test("uses type-specific fallback for incomplete asset metadata", () => {
    const project = Model.normalizeProject({ repo: "demo", preview: { kind: "app", src: "assets/img/projects/demo.webp" } });
    expect(project.preview).toEqual({ kind: "app", src: "", alt: "", fallback: true });
  });

  test.each([
    "assets/img/projects/../secret.webp",
    "assets/img/projects/nested/../../secret.webp",
    "assets/img/projects\\secret.webp",
    "assets/img/projects/%2e%2e/secret.webp",
    "assets/img/projects/%252e%252e/secret.webp",
    "assets/img/projects/%5c..%5csecret.webp",
  ])("rejects unsafe local preview path %s", (src) => {
    expect(Model.normalizePreview({ kind: "chart", src, alt: "Unsafe preview" })).toEqual({
      kind: "chart", src: "", alt: "", fallback: true,
    });
  });

  test("exposes the category keys other tools derive from", () => {
    expect(Model.CATEGORIES.map((category) => category.key)).toEqual([
      "data-analysis", "ml-nlp", "visualization", "developer-tools", "apps",
    ]);
  });
});
