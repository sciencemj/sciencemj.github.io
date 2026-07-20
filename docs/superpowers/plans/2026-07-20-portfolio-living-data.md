# Portfolio Living Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the static portfolio into a responsive Living Data Lab with an interactive hero, project-specific previews, three featured case studies, five editorial filters, and a preview schema ready for later admin editing.

**Architecture:** Keep static HTML/CSS/classic-script deployment. Extract pure project normalization and rendering into UMD modules usable by browser and Bun tests; keep `projects.js` responsible for GitHub enrichment and DOM orchestration. Render hero with inline SVG plus a tested scene model, store previews locally, and minimally update admin serialization so saves preserve new metadata.

**Tech Stack:** HTML5, CSS custom properties, vanilla JavaScript, inline SVG, GitHub REST API, Bun test runner, GitHub Pages.

## Global Constraints

- No framework, bundler, backend, or runtime dependency.
- Preserve light/dark themes, existing brand fonts, GitHub API enrichment, and `sessionStorage` caching.
- Use exactly five categories: Data Analysis, ML & NLP, Visualization, Developer Tools, Apps.
- Support preview kinds `image`, `chart`, `app`, `terminal`, and `workflow`.
- Keep raster previews below 180 KB under `assets/img/projects/`.
- Respect `prefers-reduced-motion: reduce`; static content remains useful without JavaScript.
- Keep page free of horizontal overflow at 390 CSS pixels.
- Do not add enhancement game or admin thumbnail-editing UI.
- Follow test-first red-green-refactor for every behavior change.

---

## File Map

- Create `assets/js/project-model.js`: preview/category normalization and filtering.
- Create `assets/js/project-view.js`: pure preview, card, section, and filter markup.
- Modify `assets/js/projects.js`: API fetch and DOM orchestration only.
- Modify `assets/js/projects.data.js`: featured, highlight, categories, and preview fields.
- Create `assets/js/data-canvas-model.js`: deterministic Raw/Pattern/Decision scenes.
- Create `assets/js/data-canvas.js`: SVG interaction and reduced-motion handling.
- Modify `index.html`, `assets/css/site.css`, and `assets/css/bg-art.css`: visual system.
- Create `admin/projects-store.js`; modify `admin/server.js`: preserve preview metadata.
- Create `assets/img/projects/*.webp`: real report and app previews.
- Create `tests/*.test.js`: model, renderer, admin, asset, hero, theme, and page contracts.

---

### Task 1: Project metadata model

**Files:**
- Create: `assets/js/project-model.js`
- Create: `tests/project-model.test.js`

**Interfaces:**
- Consumes: raw entries from `window.PORTFOLIO_PROJECTS`.
- Produces: `CATEGORIES`, `normalizeProject(project)`, `splitProjects(projects)`, `matchesAnyCategory(project, activeKeys)`.

- [ ] **Step 1: Write failing tests**

```js
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
```

- [ ] **Step 2: Verify RED**

Run: `bun test tests/project-model.test.js`

Expected: FAIL with `Cannot find module '../assets/js/project-model.js'`.

- [ ] **Step 3: Implement model**

Create a UMD module usable as `window.PortfolioProjectModel` and CommonJS:

```js
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PortfolioProjectModel = api;
})(typeof window !== "undefined" ? window : null, function () {
  var CATEGORIES = [
    { key: "data-analysis", label: "Data Analysis" },
    { key: "ml-nlp", label: "ML & NLP" },
    { key: "visualization", label: "Visualization" },
    { key: "developer-tools", label: "Developer Tools" },
    { key: "apps", label: "Apps" },
  ];
  var KEYS = CATEGORIES.map(function (item) { return item.key; });
  var KINDS = ["image", "chart", "app", "terminal", "workflow"];
  var ASSET_KINDS = ["image", "chart", "app"];

  function text(value) { return typeof value === "string" ? value.trim() : ""; }
  function normalizePreview(raw) {
    raw = raw && typeof raw === "object" ? raw : {};
    var kind = KINDS.indexOf(raw.kind) > -1 ? raw.kind : "workflow";
    var src = text(raw.src), alt = text(raw.alt);
    var needsAsset = ASSET_KINDS.indexOf(kind) > -1;
    var valid = !needsAsset || (src.indexOf("assets/img/projects/") === 0 && alt);
    return { kind: kind, src: valid && needsAsset ? src : "", alt: valid && needsAsset ? alt : "", fallback: !valid || !needsAsset };
  }
  function normalizeProject(raw) {
    raw = raw && typeof raw === "object" ? raw : {};
    var categories = Array.isArray(raw.categories) ? raw.categories : [];
    categories = categories.filter(function (key, index) { return KEYS.indexOf(key) > -1 && categories.indexOf(key) === index; });
    return { repo: text(raw.repo), report: text(raw.report), featured: raw.featured === true, highlight: text(raw.highlight), categories: categories, preview: normalizePreview(raw.preview) };
  }
  function splitProjects(projects) {
    var featured = [], compact = [];
    (projects || []).map(normalizeProject).forEach(function (project) {
      if (project.featured && featured.length < 3) featured.push(project); else compact.push(project);
    });
    return { featured: featured, compact: compact };
  }
  function matchesAnyCategory(project, active) {
    return !active || active.length === 0 || active.some(function (key) { return project.categories.indexOf(key) > -1; });
  }
  return { CATEGORIES: CATEGORIES, normalizePreview: normalizePreview, normalizeProject: normalizeProject, splitProjects: splitProjects, matchesAnyCategory: matchesAnyCategory };
});
```

- [ ] **Step 4: Verify GREEN**

Run: `bun test tests/project-model.test.js`

Expected: 4 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add assets/js/project-model.js tests/project-model.test.js
git commit -m "feat: add project preview model"
```

---

### Task 2: Preserve metadata through admin saves

**Files:**
- Create: `admin/projects-store.js`
- Create: `tests/admin-projects.test.js`
- Modify: `admin/server.js:11-65,145-170`

**Interfaces:**
- Consumes: project arrays from `projects.data.js` and `/api/save`.
- Produces: `parseProjects(text)`, `validateProjects(projects)`, `cleanProjects(projects)`, `serializeProjects(projects)`.

- [ ] **Step 1: Write failing preservation tests**

```js
import { describe, expect, test } from "bun:test";
import { cleanProjects, parseProjects, serializeProjects, validateProjects } from "../admin/projects-store.js";

const project = {
  repo: "demo", report: "report.html", featured: true,
  highlight: "Concrete result.", categories: ["data-analysis", "visualization"],
  preview: { kind: "chart", src: "assets/img/projects/demo.webp", alt: "Demo chart" },
};

describe("admin project store", () => {
  test("round-trips living-data metadata", () => {
    expect(parseProjects(serializeProjects([project]))).toEqual([project]);
  });
  test("cleans known fields without deleting preview metadata", () => {
    expect(cleanProjects([{ ...project, report: " report.html " }])).toEqual([project]);
  });
  test("rejects unsafe preview paths", () => {
    const invalid = [{ ...project, preview: { kind: "chart", src: "../secret.webp", alt: "Bad" } }];
    expect(validateProjects(invalid)).toBe("preview src must be under assets/img/projects/");
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `bun test tests/admin-projects.test.js`

Expected: FAIL with `Cannot find module '../admin/projects-store.js'`.

- [ ] **Step 3: Extract storage helpers**

Create `admin/projects-store.js` with exact approved keys:

```js
const HEADER = "/* Portfolio projects list — single source of truth for which repos appear on the site.\n   Edited by the local admin tool (`bun admin/server.js`) or by hand.\n   Array body must stay valid JSON: projects.js and the admin server both parse it. */";
const REPO_RE = /^[A-Za-z0-9_.-]+$/;
const CATEGORY_KEYS = ["data-analysis", "ml-nlp", "visualization", "developer-tools", "apps"];
const PREVIEW_KINDS = ["image", "chart", "app", "terminal", "workflow"];

export function parseProjects(text) {
  const match = text.match(/window\.PORTFOLIO_PROJECTS\s*=\s*(\[[\s\S]*\]);/);
  return match ? JSON.parse(match[1]) : [];
}
export function validateProjects(projects) {
  if (!Array.isArray(projects)) return "projects must be an array";
  for (const p of projects) {
    if (!p || typeof p !== "object") return "each project must be an object";
    if (typeof p.repo !== "string" || !REPO_RE.test(p.repo)) return "invalid repo name: " + JSON.stringify(p.repo);
    if (p.report && (typeof p.report !== "string" || p.report.startsWith("/") || p.report.split("/").includes(".."))) return "invalid report path";
    if (p.categories && (!Array.isArray(p.categories) || p.categories.some((key) => !CATEGORY_KEYS.includes(key)))) return "invalid project category";
    if (p.preview) {
      if (!PREVIEW_KINDS.includes(p.preview.kind)) return "invalid preview kind";
      if (p.preview.src && !p.preview.src.startsWith("assets/img/projects/")) return "preview src must be under assets/img/projects/";
      if (p.preview.src && (!p.preview.alt || typeof p.preview.alt !== "string")) return "preview alt is required when src is set";
    }
  }
  return null;
}
export function cleanProjects(projects) {
  return projects.map((p) => {
    const clean = { repo: p.repo };
    if (typeof p.report === "string" && p.report.trim()) clean.report = p.report.trim();
    if (p.featured === true) clean.featured = true;
    if (typeof p.highlight === "string" && p.highlight.trim()) clean.highlight = p.highlight.trim();
    if (Array.isArray(p.categories)) clean.categories = [...p.categories];
    if (p.preview && typeof p.preview === "object") {
      clean.preview = { kind: p.preview.kind };
      if (typeof p.preview.src === "string" && p.preview.src.trim()) clean.preview.src = p.preview.src.trim();
      if (typeof p.preview.alt === "string" && p.preview.alt.trim()) clean.preview.alt = p.preview.alt.trim();
    }
    return clean;
  });
}
export function serializeProjects(projects) {
  const rows = projects.map((project) => "  " + JSON.stringify(project)).join(",\n");
  return HEADER + "\nwindow.PORTFOLIO_PROJECTS = [\n" + rows + "\n];\n";
}
```

- [ ] **Step 4: Wire `admin/server.js` to helpers**

Import the four helpers. Replace local parse/validate/serialize functions. Use:

```js
async function readProjects() {
  try { return parseProjects(await Bun.file(DATA_FILE).text()); }
  catch { return []; }
}
```

In `/api/save`:

```js
const projects = body && body.projects;
const err = validateProjects(projects);
if (err) return json({ ok: false, error: err }, 400);
const clean = cleanProjects(projects);
await Bun.write(DATA_FILE, serializeProjects(clean));
return json({ ok: true, count: clean.length });
```

- [ ] **Step 5: Verify GREEN**

Run: `bun test tests/admin-projects.test.js tests/project-model.test.js`

Expected: 7 pass, 0 fail.

- [ ] **Step 6: Commit**

```bash
git add admin/projects-store.js admin/server.js tests/admin-projects.test.js
git commit -m "fix: preserve project preview metadata"
```

---

### Task 3: Configure mixed previews and real assets

**Files:**
- Modify: `assets/js/projects.data.js`
- Create: `assets/img/projects/lcc-review.webp`
- Create: `assets/img/projects/steam-review.webp`
- Create: `assets/img/projects/book-review.webp`
- Create: `assets/img/projects/seoul-bike.webp`
- Create: `assets/img/projects/pybacktest.webp`
- Create: `tests/project-assets.test.js`

**Interfaces:**
- Consumes: schema from Task 1.
- Produces: nine projects, exactly three featured, five real assets, four deterministic fallbacks.

- [ ] **Step 1: Write failing asset/config test**

```js
const { expect, test } = require("bun:test");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

function readProjects() {
  const source = readFileSync(resolve(import.meta.dir, "../assets/js/projects.data.js"), "utf8");
  const browser = {};
  new Function("window", source)(browser);
  return browser.PORTFOLIO_PROJECTS;
}
test("configures featured projects and local preview assets", async () => {
  const projects = readProjects();
  expect(projects.filter((project) => project.featured)).toHaveLength(3);
  expect(new Set(projects.flatMap((project) => project.categories))).toEqual(new Set(["data-analysis", "ml-nlp", "visualization", "developer-tools", "apps"]));
  for (const project of projects.filter((item) => item.preview && item.preview.src)) {
    const file = Bun.file(resolve(import.meta.dir, "..", project.preview.src));
    expect(await file.exists()).toBe(true);
    expect(file.size).toBeLessThan(180 * 1024);
    expect(project.preview.alt.trim().length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Verify RED**

Run: `bun test tests/project-assets.test.js`

Expected: FAIL because current config has zero featured projects.

- [ ] **Step 3: Capture real previews**

Capture 16:10 crops, maximum 1280 × 800, WebP quality 78–82:

- LCC primary sentiment-cluster result from `https://sciencemj.github.io/LCC_Review_Sentiment_Cluster/report.html`.
- Steam churn-impact result from `https://sciencemj.github.io/steam-review/index.html`.
- Book main rank-prediction result from `https://sciencemj.github.io/book-review-rank-predict/report.html`.
- Seoul demand/supply map from `https://sciencemj.github.io/seoul-bike-analysis/report.html`.
- Pybacktest main workspace from `https://pybacktest.streamlit.app/`.

Use only these real project outputs. Save to exact paths listed under Files.

- [ ] **Step 4: Add approved project records**

Use these values in `projects.data.js`:

```js
window.PORTFOLIO_PROJECTS = [
  { "repo": "LCC_Review_Sentiment_Cluster", "report": "report.html", "featured": true, "highlight": "Prioritized high-intensity, low-cost airline complaint fixes.", "categories": ["data-analysis", "ml-nlp", "visualization"], "preview": { "kind": "chart", "src": "assets/img/projects/lcc-review.webp", "alt": "Airline review sentiment clusters and complaint priorities" } },
  { "repo": "steam-review", "report": "index.html", "featured": true, "highlight": "Separated loud complaints from complaints that actually drive churn.", "categories": ["data-analysis", "ml-nlp"], "preview": { "kind": "chart", "src": "assets/img/projects/steam-review.webp", "alt": "Steam review complaint impact and churn analysis" } },
  { "repo": "book-review-rank-predict", "report": "report.html", "featured": true, "highlight": "Tested whether book copy predicts sales across 1,814 titles.", "categories": ["data-analysis", "ml-nlp", "visualization"], "preview": { "kind": "chart", "src": "assets/img/projects/book-review.webp", "alt": "Book sales rank analysis across 1,814 titles" } },
  { "repo": "seoul-bike-analysis", "report": "report.html", "highlight": "Mapped station-level demand and supply gaps across Seoul.", "categories": ["data-analysis", "visualization"], "preview": { "kind": "chart", "src": "assets/img/projects/seoul-bike.webp", "alt": "Seoul bike station demand and supply map" } },
  { "repo": "data-analysis-project", "highlight": "Built a gated nine-stage data-analysis workflow.", "categories": ["data-analysis", "developer-tools"], "preview": { "kind": "workflow" } },
  { "repo": "pybacktest", "highlight": "Turned strategy backtests into an interactive workflow.", "categories": ["data-analysis", "developer-tools", "apps", "visualization"], "preview": { "kind": "app", "src": "assets/img/projects/pybacktest.webp", "alt": "Pybacktest interactive strategy analysis workspace" } },
  { "repo": "pyile_manager", "highlight": "Explored local-AI file renaming in a native desktop workflow.", "categories": ["developer-tools", "apps"], "preview": { "kind": "app" } },
  { "repo": "routine-timer", "highlight": "Designed a focused macOS timer with long-term routine feedback.", "categories": ["apps", "visualization"], "preview": { "kind": "app" } },
  { "repo": "whisper-transcribe", "highlight": "Made local audio transcription repeatable from the command line.", "categories": ["ml-nlp", "developer-tools"], "preview": { "kind": "terminal" } }
];
```

- [ ] **Step 5: Verify GREEN**

Run: `bun test tests/project-assets.test.js tests/admin-projects.test.js`

Expected: all pass; every raster exists below 180 KB.

- [ ] **Step 6: Commit**

```bash
git add assets/js/projects.data.js assets/img/projects tests/project-assets.test.js
git commit -m "feat: add project-specific previews"
```

---

### Task 4: Render featured and compact project cards

**Files:**
- Create: `assets/js/project-view.js`
- Create: `tests/project-view.test.js`
- Modify: `assets/js/projects.js:13-205`
- Modify: `index.html:96-97,199-201`

**Interfaces:**
- Consumes: `PortfolioProjectModel`, project config, GitHub metadata.
- Produces: `renderPreview`, `renderCard`, `renderProjectSections`, `renderFilters`.

- [ ] **Step 1: Write failing view tests**

```js
const { describe, expect, test } = require("bun:test");
const View = require("../assets/js/project-view.js");
const github = { description: "GitHub description", language: "Python", pushed_at: "2026-07-01T00:00:00Z", topics: ["data-analysis", "machine-learning"], has_pages: true, html_url: "https://github.com/sciencemj/demo" };

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
});
```

- [ ] **Step 2: Verify RED**

Run: `bun test tests/project-view.test.js`

Expected: FAIL with `Cannot find module '../assets/js/project-view.js'`.

- [ ] **Step 3: Implement pure view module**

Use UMD. CommonJS loads `require("./project-model.js")`; browser reads
`root.PortfolioProjectModel`. Retain current escaping, humanized titles, GitHub
topic formatting, relative time, and safe link logic.

Use this preview implementation:

```js
function renderPreview(project, title, lazy) {
  var preview = project.preview;
  if (!preview.fallback && preview.src) {
    return '<figure class="pc-preview pc-preview--' + esc(preview.kind) + '"><img src="' + esc(preview.src) + '" alt="' + esc(preview.alt) + '" width="1280" height="800"' + (lazy ? ' loading="lazy"' : '') + '><span class="preview-kind">' + esc(preview.kind) + '</span></figure>';
  }
  if (preview.kind === "terminal") return '<div class="pc-preview pc-preview--fallback preview-terminal" aria-hidden="true"><span>$ whisper-transcribe ./interview.wav</span><span>detecting language...</span><span class="ok">transcript ready</span></div>';
  if (preview.kind === "app") return '<div class="pc-preview pc-preview--fallback preview-app" aria-hidden="true"><span class="app-sidebar"></span><span class="app-row wide"></span><span class="app-row"></span><span class="app-row short"></span></div>';
  return '<div class="pc-preview pc-preview--fallback preview-workflow" aria-hidden="true"><span>Raw</span><i></i><span>Reframe</span><i></i><span>Ship</span></div>';
}
```

`renderCard(project, data, variant, index)` uses:

```js
var classes = "project-card project-card--" + variant;
var categories = project.categories.join("|");
var description = project.highlight || (data && data.description) || "Open the project repository on GitHub.";
```

Show at most two GitHub topic tags. Lazy-load all images except lead. Output
lead card, `.featured-projects__pair`, then `.compact-projects`.
`renderProjectSections` must call `Model.normalizeProject` for every raw record,
so callers do not need to pre-normalize configuration.

- [ ] **Step 4: Reduce `projects.js` to orchestration**

Require globals and render local cards before API requests:

```js
var Model = window.PortfolioProjectModel;
var View = window.PortfolioProjectView;
if (!Model || !View) return;

grid.innerHTML = View.renderProjectSections(PROJECTS, []);
filterBar.innerHTML = View.renderFilters([]);
filterBar.hidden = false;
```

Keep one click handler. Track active category keys, redraw buttons, and set each
card's hidden state with `Model.matchesAnyCategory`. Hide empty layout groups.
`All` clears active keys. After `Promise.all` resolves, rerender with GitHub
results, set `aria-busy="false"`, then reapply active filters. A failed API
request contributes `null` and never removes its local card.

- [ ] **Step 5: Load dependencies in `index.html`**

```html
<script src="assets/js/theme.js" defer></script>
<script src="assets/js/projects.data.js" defer></script>
<script src="assets/js/project-model.js" defer></script>
<script src="assets/js/project-view.js" defer></script>
<script src="assets/js/projects.js" defer></script>
```

- [ ] **Step 6: Verify GREEN**

Run: `bun test tests/project-model.test.js tests/project-view.test.js tests/project-assets.test.js`

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add index.html assets/js/projects.js assets/js/project-view.js tests/project-view.test.js
git commit -m "feat: redesign project presentation"
```

---

### Task 5: Build the living-data hero

**Files:**
- Create: `assets/js/data-canvas-model.js`
- Create: `assets/js/data-canvas.js`
- Create: `tests/data-canvas.test.js`
- Modify: `index.html:75-85,199-202`
- Modify: `assets/css/site.css:98-102`

**Interfaces:**
- Consumes: `#data-canvas`, `.data-point`, `[data-scene-label]`, scroll/pointer position, reduced-motion preference.
- Produces: `createScenes(count)`, `interpolatePoint(from, to, progress)`, `clampProgress(value)`.

- [ ] **Step 1: Write failing scene tests**

```js
const { describe, expect, test } = require("bun:test");
const Model = require("../assets/js/data-canvas-model.js");

describe("data canvas model", () => {
  test("builds deterministic Raw, Pattern, Decision scenes", () => {
    const scenes = Model.createScenes(48);
    expect(Object.keys(scenes)).toEqual(["raw", "pattern", "decision"]);
    expect(scenes.raw).toHaveLength(48);
    expect(scenes.pattern).toHaveLength(48);
    expect(scenes.decision).toHaveLength(48);
    expect(Model.createScenes(48)).toEqual(scenes);
  });
  test("interpolates position and opacity", () => {
    expect(Model.interpolatePoint({ x: 0, y: 10, opacity: .2 }, { x: 20, y: 30, opacity: 1 }, .5)).toEqual({ x: 10, y: 20, opacity: .6 });
  });
  test("clamps progress", () => {
    expect(Model.clampProgress(-1)).toBe(0);
    expect(Model.clampProgress(2)).toBe(1);
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `bun test tests/data-canvas.test.js`

Expected: FAIL with `Cannot find module '../assets/js/data-canvas-model.js'`.

- [ ] **Step 3: Implement deterministic scenes**

Use Task 1 UMD pattern and a fixed linear congruential generator seeded with
`20260720`; never use `Math.random()`.

```js
function clampProgress(value) { return Math.max(0, Math.min(1, value)); }
function interpolatePoint(from, to, progress) {
  var t = clampProgress(progress);
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, opacity: from.opacity + (to.opacity - from.opacity) * t };
}
```

`createScenes(48)` uses 560 × 420 coordinates. Raw spans the plot. Pattern uses
clusters centered at `(155,250)`, `(295,165)`, `(420,275)`. Decision follows
`y = 330 - 0.42x`. Point indexes remain stable between scenes.

- [ ] **Step 4: Add static SVG shell**

```html
<header class="hero">
  <div class="hero-copy">
    <span class="eyebrow">Business × Computer Science</span>
    <h1 class="hero-title">Turning messy data into <span class="accent">decisions</span> people can trust.</h1>
    <p class="hero-lead">I'm MJ — exploring where analytics, machine learning, and clear visual storytelling meet.</p>
    <div class="hero-actions">
      <a href="#work" class="btn btn-primary">View my work</a>
      <a href="https://github.com/sciencemj" class="btn btn-secondary" target="_blank" rel="noopener">GitHub</a>
    </div>
  </div>
  <div class="data-lab" aria-hidden="true">
    <div class="data-lab__head"><span>Living dataset</span><span data-scene-label>Decision</span></div>
    <svg id="data-canvas" viewBox="0 0 560 420" role="presentation">
      <g class="data-grid">
        <line x1="40" y1="80" x2="520" y2="80"></line>
        <line x1="40" y1="160" x2="520" y2="160"></line>
        <line x1="40" y1="240" x2="520" y2="240"></line>
        <line x1="40" y1="320" x2="520" y2="320"></line>
        <line x1="80" y1="48" x2="80" y2="360"></line>
        <line x1="160" y1="48" x2="160" y2="360"></line>
        <line x1="240" y1="48" x2="240" y2="360"></line>
        <line x1="320" y1="48" x2="320" y2="360"></line>
        <line x1="400" y1="48" x2="400" y2="360"></line>
        <line x1="480" y1="48" x2="480" y2="360"></line>
      </g>
      <path class="decision-line" d="M45 329 L515 132"></path>
      <rect class="decision-zone" x="382" y="128" width="118" height="72" rx="12"></rect>
      <g class="data-points"></g>
    </svg>
    <div class="data-lab__steps"><span>Raw</span><span>Pattern</span><span>Decision</span></div>
  </div>
</header>
```

- [ ] **Step 5: Implement bounded interaction**

`data-canvas.js` appends 48 circles, pauses through `IntersectionObserver`, maps
scroll progress 0–.5 Raw-to-Pattern and .5–1 Pattern-to-Decision, applies at most
8 SVG units pointer displacement inside 90 units, and updates label at `.34` and
`.68`. Reduced motion renders Decision immediately with no event listeners.

Use this control flow and queue only one frame:

```js
(function () {
  var Model = window.DataCanvasModel;
  var svg = document.getElementById("data-canvas");
  if (!Model || !svg) return;
  var hero = svg.closest(".hero");
  var layer = svg.querySelector(".data-points");
  var label = hero.querySelector("[data-scene-label]");
  var line = svg.querySelector(".decision-line");
  var zone = svg.querySelector(".decision-zone");
  var scenes = Model.createScenes(48);
  var circles = scenes.raw.map(function (_, index) {
    var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("class", "data-point data-point--" + (index % 3));
    circle.setAttribute("r", index % 5 === 0 ? "5" : "3.5");
    layer.appendChild(circle);
    return circle;
  });
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var visible = true, frame = 0, progress = reduced ? 1 : 0, pointer = null;

  function pointFor(index) {
    if (progress < .5) return Model.interpolatePoint(scenes.raw[index], scenes.pattern[index], progress * 2);
    return Model.interpolatePoint(scenes.pattern[index], scenes.decision[index], (progress - .5) * 2);
  }
  function render() {
    circles.forEach(function (circle, index) {
      var point = pointFor(index), dx = 0, dy = 0;
      if (pointer) {
        var px = point.x - pointer.x, py = point.y - pointer.y;
        var distance = Math.sqrt(px * px + py * py) || 1;
        if (distance < 90) { var force = 8 * (1 - distance / 90); dx = px / distance * force; dy = py / distance * force; }
      }
      circle.setAttribute("cx", (point.x + dx).toFixed(2));
      circle.setAttribute("cy", (point.y + dy).toFixed(2));
      circle.setAttribute("opacity", point.opacity.toFixed(2));
    });
    label.textContent = progress < .34 ? "Raw" : progress < .68 ? "Pattern" : "Decision";
    line.style.opacity = progress > .68 ? String((progress - .68) / .32) : "0";
    zone.style.opacity = progress > .82 ? String((progress - .82) / .18) : "0";
  }
function requestRender() {
  if (!visible || frame) return;
  frame = requestAnimationFrame(function () { frame = 0; render(); });
}
  render();
  if (reduced) return;
  new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; if (visible) requestRender(); }).observe(hero);
  addEventListener("scroll", function () {
    var rect = hero.getBoundingClientRect();
    progress = Model.clampProgress((64 - rect.top) / Math.max(1, rect.height * .55));
    requestRender();
  }, { passive: true });
  svg.addEventListener("pointermove", function (event) {
    var rect = svg.getBoundingClientRect();
    pointer = { x: (event.clientX - rect.left) * 560 / rect.width, y: (event.clientY - rect.top) * 420 / rect.height };
    requestRender();
  });
  svg.addEventListener("pointerleave", function () { pointer = null; requestRender(); });
})();
```

- [ ] **Step 6: Add hero layout styles**

```css
.hero { padding: 72px 0 68px; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(360px, .95fr); align-items: center; gap: clamp(42px, 7vw, 84px); }
.hero-copy { display: flex; flex-direction: column; align-items: flex-start; gap: 24px; }
.hero-title { font-size: clamp(42px, 5.6vw, 68px); max-width: 720px; }
.data-lab { overflow: hidden; border: 1px solid var(--border-2); border-radius: 28px; background: color-mix(in srgb, var(--surface) 88%, transparent); box-shadow: var(--shadow-lg); min-width: 0; }
.data-lab__head, .data-lab__steps { display: flex; justify-content: space-between; gap: 12px; font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
#data-canvas { display: block; width: 100%; height: auto; }
.data-grid line { stroke: var(--border); stroke-width: 1; }
.data-point { fill: var(--signal, var(--accent)); }
.decision-line { stroke: var(--accent); stroke-width: 3; stroke-linecap: round; }
.decision-zone { fill: color-mix(in srgb, var(--viz-teal) 18%, transparent); stroke: var(--viz-teal); }
@media (max-width: 820px) { .hero { grid-template-columns: 1fr; } }
```

Load `data-canvas-model.js` before `data-canvas.js`.

- [ ] **Step 7: Verify GREEN**

Run: `bun test tests/data-canvas.test.js`

Expected: 3 pass, 0 fail.

- [ ] **Step 8: Commit**

```bash
git add index.html assets/css/site.css assets/js/data-canvas-model.js assets/js/data-canvas.js tests/data-canvas.test.js
git commit -m "feat: add living data hero"
```

---

### Task 6: Style cards and accessibility states

**Files:**
- Create: `tests/theme.test.js`
- Modify: `assets/css/site.css:47-180,287-298`
- Modify: `assets/css/bg-art.css:1-73`
- Modify: `assets/js/theme.js:12-24`

**Interfaces:**
- Consumes: classes emitted by `project-view.js` and current theme.
- Produces: responsive card layouts, mixed fallbacks, 40-pixel controls, quieter background, destination-aware theme labels.

- [ ] **Step 1: Write failing theme-label test**

```js
const { expect, test } = require("bun:test");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

test("theme button names destination theme", () => {
  const root = { theme: "dark", getAttribute() { return this.theme; }, setAttribute(name, value) { if (name === "data-theme") this.theme = value; } };
  const button = { attrs: {}, setAttribute(name, value) { this.attrs[name] = value; }, addEventListener(name, handler) { if (name === "click") this.click = handler; } };
  const document = { documentElement: root, readyState: "complete", getElementById() { return button; } };
  const source = readFileSync(resolve(import.meta.dir, "../assets/js/theme.js"), "utf8");
  new Function("document", "localStorage", source)(document, { setItem() {} });
  expect(button.attrs["aria-label"]).toBe("Switch to light theme");
  button.click();
  expect(button.attrs["aria-label"]).toBe("Switch to dark theme");
});
```

- [ ] **Step 2: Verify RED**

Run: `bun test tests/theme.test.js`

Expected: FAIL because `sync()` does not set `aria-label`.

- [ ] **Step 3: Update existing `sync`**

```js
function sync(btn) {
  if (!btn) return;
  var dark = current() === "dark";
  btn.innerHTML = dark ? SUN : MOON;
  btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  btn.setAttribute("title", dark ? "Switch to light theme" : "Switch to dark theme");
}
```

- [ ] **Step 4: Replace project layout CSS**

```css
.project-grid { display: flex; flex-direction: column; gap: 22px; }
.featured-projects { display: grid; gap: 18px; }
.featured-projects__pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.compact-projects { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.project-card { color: var(--ink); background: var(--surface); border: 1px solid var(--border); overflow: hidden; }
.project-card--lead { display: grid; grid-template-columns: minmax(0, 1.22fr) minmax(320px, .78fr); border-radius: 26px; }
.project-card--featured { display: flex; flex-direction: column; border-radius: 22px; }
.project-card--compact { display: grid; grid-template-columns: 164px 1fr; border-radius: 18px; }
.pc-preview { position: relative; overflow: hidden; min-height: 180px; background: var(--surface-2); }
.pc-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
.project-card--lead .pc-preview { min-height: 340px; }
.project-card--featured .pc-preview { aspect-ratio: 16 / 10; }
.project-card--compact .pc-preview { min-height: 156px; }
.preview-terminal { padding: 24px; display: flex; flex-direction: column; gap: 12px; font-family: var(--font-mono); font-size: 12px; }
.preview-app { display: grid; grid-template-columns: 30% 1fr; grid-template-rows: repeat(3, 1fr); gap: 10px; padding: 22px; }
.preview-app .app-sidebar { grid-row: 1 / -1; border-radius: 10px; background: color-mix(in srgb, var(--viz-slate) 24%, var(--surface)); }
.preview-app .app-row { align-self: center; height: 12px; border-radius: 999px; background: var(--border-2); }
.preview-app .app-row.short { width: 58%; }
.preview-workflow { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; place-items: center; gap: 8px; padding: 24px; }
.preview-workflow i { width: 28px; border-top: 1px solid var(--accent); }
.filter-chip { min-height: 40px; padding: 8px 15px; }
.icon-btn, .icon-link { min-width: 40px; min-height: 40px; }
@media (max-width: 820px) {
  .featured-projects__pair, .compact-projects { grid-template-columns: 1fr; }
  .project-card--lead { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .wrap { padding-inline: 20px; }
  .project-card--compact { grid-template-columns: 1fr; }
  .pc-meta { white-space: normal; }
}
```

Keep hover, focus, skeleton, status, tag, metadata, theme rules. Remove generic
`.pc-bars` and cover-gradient dependency.

- [ ] **Step 5: Quiet background art**

Set light orb opacity `.18`, dark opacity `.24`, add 18 pixels to blur values,
and double every drift duration. Keep reduced-motion block unchanged.

- [ ] **Step 6: Verify GREEN**

Run: `bun test`

Expected: all pass, 0 fail.

- [ ] **Step 7: Commit**

```bash
git add assets/css/site.css assets/css/bg-art.css assets/js/theme.js tests/theme.test.js
git commit -m "feat: polish living data layouts"
```

---

### Task 7: Integration and visual verification

**Files:**
- Create: `tests/page-contract.test.js`
- Modify: only files needed to fix failures found here.

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: verified desktop/mobile light/dark design with no console or asset errors.

- [ ] **Step 1: Write integration contract test**

```js
const { expect, test } = require("bun:test");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

test("loads living-data scripts in dependency order", () => {
  const html = readFileSync(resolve(import.meta.dir, "../index.html"), "utf8");
  const model = html.indexOf('src="assets/js/project-model.js"');
  const view = html.indexOf('src="assets/js/project-view.js"');
  const projects = html.indexOf('src="assets/js/projects.js"');
  const sceneModel = html.indexOf('src="assets/js/data-canvas-model.js"');
  const scene = html.indexOf('src="assets/js/data-canvas.js"');
  expect(html).toContain('id="data-canvas"');
  expect(model).toBeGreaterThan(-1);
  expect(view).toBeGreaterThan(model);
  expect(projects).toBeGreaterThan(view);
  expect(scene).toBeGreaterThan(sceneModel);
});
```

- [ ] **Step 2: Run contract test**

Run: `bun test tests/page-contract.test.js`

Expected: PASS. If it fails, fix only missing hook or script order named by the assertion.

- [ ] **Step 3: Run automated verification**

Run: `bun test`

Expected: all pass, 0 fail.

Run: `git diff --check`

Expected: exit 0 with no whitespace errors.

- [ ] **Step 4: Start local site**

Run: `python3 -m http.server 8000`

Open `http://127.0.0.1:8000/`.

- [ ] **Step 5: Verify desktop**

At 1440 × 900, light and dark:

- capture full-page screenshots;
- confirm two-column hero and Decision state;
- confirm one lead, two featured, six compact cards;
- confirm only All plus five filters;
- toggle two filters and verify OR behavior;
- verify all real previews and fallbacks;
- verify no console warnings or errors.

- [ ] **Step 6: Verify mobile and accessibility**

At 390 × 844, light and dark:

- capture full-page screenshots;
- confirm no horizontal overflow;
- confirm copy precedes hero visualization;
- confirm one-column cards and 16:10 previews;
- keyboard-tab through navigation, filters, cards, CTA;
- confirm visible focus and 40-pixel controls;
- emulate reduced motion and confirm static Decision scene;
- confirm theme control announces destination theme.

- [ ] **Step 7: Review scope diff**

Run: `git diff --stat main...HEAD`

Run: `git diff -- docs/superpowers/specs/2026-07-20-portfolio-living-data-design.md index.html assets/css assets/js admin tests`

Every changed production line must map to hero, previews, layout, filter,
accessibility, or metadata preservation. Remove unrelated edits.

- [ ] **Step 8: Commit verification fixes only if needed**

```bash
git add index.html assets admin tests
git commit -m "fix: finish living data responsive polish"
```

Do not create an empty commit.

---

## Final Verification Gate

Run fresh:

```bash
bun test
git diff --check
git status --short --branch
```

Required evidence:

- all Bun tests pass with zero failures;
- `git diff --check` exits 0;
- desktop/mobile screenshots inspected in both themes;
- browser console contains no errors;
- all five raster previews load and remain under 180 KB.
