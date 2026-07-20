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

  test("keeps only three featured projects", () => {
    const split = Model.splitProjects([
      { repo: "a", featured: true }, { repo: "b", featured: true },
      { repo: "c", featured: true }, { repo: "d", featured: true }, { repo: "e" },
    ]);
    expect(split.featured.map((p) => p.repo)).toEqual(["a", "b", "c"]);
    expect(split.compact.map((p) => p.repo)).toEqual(["d", "e"]);
  });

  test("matches categories with OR behavior", () => {
    const project = Model.normalizeProject({ repo: "demo", categories: ["ml-nlp", "visualization"] });
    expect(Model.matchesAnyCategory(project, [])).toBe(true);
    expect(Model.matchesAnyCategory(project, ["apps", "visualization"])).toBe(true);
    expect(Model.matchesAnyCategory(project, ["apps"])).toBe(false);
  });
});
