const { describe, expect, test } = require("bun:test");
const Model = require("../admin/editor-model.js");

const projects = [
  { repo: "one", featured: true, highlight: "One", categories: ["data-analysis"], preview: { kind: "chart", src: "assets/img/projects/one.webp", alt: "One chart" } },
  { repo: "two", featured: true, categories: ["apps"], preview: { kind: "app" } },
  { repo: "three", featured: true, categories: ["ml-nlp"], preview: { kind: "terminal" } },
  { repo: "four", categories: ["visualization"], preview: { kind: "workflow" } },
];

describe("admin editor model", () => {
  test("normalizes complete independent drafts", () => {
    const drafts = Model.normalizeDrafts(projects);
    expect(drafts[0]).not.toBe(projects[0]);
    expect(drafts[0].categories).not.toBe(projects[0].categories);
    expect(drafts[0].preview).not.toBe(projects[0].preview);
    expect(drafts[3].featured).toBe(false);
    expect(drafts[3].report).toBe("");
  });

  test("creates a complete draft from a repository", () => {
    expect(Model.draftFromRepository({ name: "new-repo", has_pages: true })).toEqual({
      repo: "new-repo", report: "report.html", featured: false, highlight: "",
      categories: [], preview: { kind: "workflow" },
    });
  });

  test("rejects a fourth featured project", () => {
    const result = Model.setFeatured(projects, 3, true);
    expect(result.error).toBe("Only three projects can be featured.");
    expect(result.projects[3].featured).toBe(false);
  });

  test("keeps edits while moving projects and builds a clean payload", () => {
    const edited = Model.updateProject(projects, 1, { highlight: "  Edited  ", report: "  report.html " });
    const moved = Model.moveProject(edited, 1, 0);
    expect(Model.buildPayload(moved)[0].highlight).toBe("Edited");
    expect(Model.buildPayload(moved)[0].report).toBe("report.html");
  });

  test("computes centered 16:10 crop rectangles", () => {
    expect(Model.cropRect(1600, 900)).toEqual({ sx: 80, sy: 0, sw: 1440, sh: 900 });
    expect(Model.cropRect(800, 1200)).toEqual({ sx: 0, sy: 350, sw: 800, sh: 500 });
  });

  test("preserves an existing basename and creates a safe new target", () => {
    expect(Model.targetPathFor(projects[0])).toBe("assets/img/projects/one.webp");
    expect(Model.targetPathFor({ repo: "Book Review / Demo", preview: { kind: "chart" } })).toBe("assets/img/projects/book-review-demo.webp");
  });

  test("requires categories and alt text for raster previews", () => {
    expect(Model.validateDrafts([{ repo: "x", categories: [], preview: { kind: "chart", src: "assets/img/projects/x.webp", alt: "" } }])).toEqual({
      0: { categories: "Choose at least one category.", "preview.alt": "Describe the preview image." },
    });
  });

  test("summarizes changed projects, uploads, and archive candidates", () => {
    const drafts = Model.updateProject(projects, 0, { highlight: "Changed" });
    const uploads = new Map([["one", { target: "assets/img/projects/one.webp" }]]);
    expect(Model.summarizeChanges(projects, drafts, uploads)).toEqual({ changedProjects: 1, newImages: 1, archivedCandidates: 1 });
  });
});
