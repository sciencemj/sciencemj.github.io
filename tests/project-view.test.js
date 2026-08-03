const { describe, expect, test } = require("bun:test");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const View = require("../assets/js/project-view.js");

const github = {
  description: "GitHub description",
  language: "Python",
  pushed_at: "2026-07-01T00:00:00Z",
  topics: ["data-analysis", "machine-learning"],
  has_pages: true,
  html_url: "https://github.com/sciencemj/demo",
};

describe("project view", () => {
  test("renders real preview dimensions and alt", () => {
    const html = View.renderPreview({ repo: "demo", preview: { kind: "chart", src: "assets/img/projects/demo.webp", alt: "Demo chart", fallback: false } }, "Demo", false);
    expect(html).toContain('src="assets/img/projects/demo.webp"');
    expect(html).toContain('alt="Demo chart"');
    expect(html).toContain('width="1280" height="800"');
  });

  test("renders terminal and workflow fallbacks", () => {
    expect(View.renderPreview({ repo: "cli", preview: { kind: "terminal", fallback: true } }, "CLI", true)).toContain("preview-terminal");
    expect(View.renderPreview({ repo: "flow", preview: { kind: "workflow", fallback: true } }, "Flow", true)).toContain("preview-workflow");
  });

  test("renders one lead, two featured, and one compact card", () => {
    const projects = [
      { repo: "a", featured: true, categories: [], preview: { kind: "workflow", fallback: true } },
      { repo: "b", featured: true, categories: [], preview: { kind: "workflow", fallback: true } },
      { repo: "c", featured: true, categories: [], preview: { kind: "workflow", fallback: true } },
      { repo: "d", categories: [], preview: { kind: "workflow", fallback: true } },
    ];
    const html = View.renderProjectSections(projects, [github, github, github, github]);
    expect((html.match(/project-card--lead/g) || []).length).toBe(1);
    expect((html.match(/project-card--featured/g) || []).length).toBe(2);
    expect((html.match(/project-card--compact/g) || []).length).toBe(1);
  });

  test("renders local cards before GitHub metadata arrives", () => {
    const html = View.renderProjectSections([
      { repo: "local", featured: true, highlight: "Local evidence", categories: ["data-analysis"], preview: { kind: "workflow" } },
    ], []);
    expect(html).toContain("Local evidence");
    expect(html).toContain("project-card--lead");
  });

  test("renders five category filters plus All", () => {
    const html = View.renderFilters([]);
    expect((html.match(/<button/g) || []).length).toBe(6);
    expect(html).toContain("ML &amp; NLP");
  });

  test("hidden cards and layout groups always leave the layout", () => {
    const css = readFileSync(resolve(import.meta.dir, "../assets/css/site.css"), "utf8");
    expect(css).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
  });
});
