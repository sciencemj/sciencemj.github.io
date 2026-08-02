const { describe, expect, test } = require("bun:test");
const View = require("../admin/editor-view.js");

const projects = [
  { repo: "one<script>", featured: true, highlight: "A result", categories: ["data-analysis", "visualization"], report: "report.html", preview: { kind: "chart", src: "assets/img/projects/one.webp", alt: "Chart preview" } },
  { repo: "two", featured: false, categories: ["apps"], preview: { kind: "app" } },
];

describe("admin editor view", () => {
  test("renders searchable master rows and selected state safely", () => {
    const html = View.renderList(projects, { selectedIndex: 1, query: "" });
    expect((html.match(/data-project-index=/g) || []).length).toBe(projects.length);
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("Move up");
    expect(html).not.toContain("one<script>");
    expect(html).toContain("one&lt;script&gt;");
  });

  test("filters rows without changing original indexes", () => {
    const html = View.renderList(projects, { selectedIndex: 1, query: "two" });
    expect((html.match(/data-project-index=/g) || []).length).toBe(1);
    expect(html).toContain('data-project-index="1"');
  });

  test("renders every curated field and both source modes", () => {
    const html = View.renderInspector(projects[0], { index: 0, sourceMode: "upload", errors: {}, assets: [] });
    for (const name of ["Featured", "Highlight", "Categories", "Report path", "Preview kind", "Existing path", "Alt text"]) {
      expect(html).toContain(name);
    }
    expect(html).toContain('role="tablist"');
    expect(html).toContain('type="file"');
    expect(html).toContain('aria-selected="true"');
  });

  test("connects field errors and renders pending image metrics", () => {
    const html = View.renderInspector(projects[0], {
      index: 0,
      sourceMode: "existing",
      errors: { "preview.alt": "Describe image" },
      assets: [],
      upload: { url: "blob:preview", width: 1280, height: 800, size: 120000, target: "assets/img/projects/one.webp" },
    });
    expect(html).toContain('aria-describedby="error-preview-alt"');
    expect(html).toContain("Describe image");
    expect(html).toContain("1280 × 800");
    expect(html).toContain("117.2 KB");
  });

  test("renders a generic server preview error beside source controls", () => {
    const html = View.renderInspector(projects[0], {
      index: 0, sourceMode: "upload", errors: { preview: "Preview is missing" }, assets: [],
    });
    expect(html).toContain('id="error-preview"');
    expect(html).toContain("Preview is missing");
  });

  test("renders card preview and change summary", () => {
    expect(View.renderCardPreview(projects[0], { url: "blob:preview" })).toContain("blob:preview");
    expect(View.renderCardPreview(projects[1])).toContain("APP PREVIEW");
    expect(View.renderChangeSummary({ changedProjects: 2, newImages: 1, archivedCandidates: 1 })).toContain("2 projects");
  });
});
