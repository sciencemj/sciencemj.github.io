# Admin Project Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local master-detail portfolio editor that safely edits every curated project field, accepts uploaded or existing preview assets, converts uploads to constrained WebPs, archives replaced assets, and saves metadata plus images transactionally.

**Architecture:** Split the current inline admin into a pure editor model, pure view renderer, browser-only image processor, filesystem asset validator, rollback-safe save transaction, and testable HTTP handler. The Bun entry point only starts the localhost server; all write behavior accepts an injected repository root so tests use temporary directories.

**Tech Stack:** Static HTML/CSS/JavaScript, Bun HTTP and filesystem APIs, browser Canvas, WebP, Bun test. No framework, bundler, image library, or runtime dependency.

## Global Constraints

- Bind the admin server to `127.0.0.1`; preserve same-origin checks on every mutating endpoint.
- Accept PNG, JPEG, and WebP uploads; write only 1280 × 800 WebPs below 180 KB.
- Browser conversion uses a centered 16:10 crop, quality 0.82 down to a floor of 0.50 in bounded steps.
- Support both upload and existing-path modes.
- Active asset paths stay under `assets/img/projects/` and reject traversal, encoded traversal, backslashes, archive paths, and symlink escape.
- Replaced, newly unreferenced assets move to `.admin-archive/project-previews/<transaction-id>/`; never delete them.
- Temporary writes stay under `.admin-tmp/project-editor/<transaction-id>/`; both local directories are ignored by Git and never served.
- Preserve JSON-only `/api/save` compatibility while adding multipart saves.
- Exactly five category keys remain valid: `data-analysis`, `ml-nlp`, `visualization`, `developer-tools`, `apps`.
- At most three project drafts may be Featured; save requires at least one category per project.
- Keep both light and dark themes, minimum 40-pixel controls, visible focus, reduced motion, keyboard reorder controls, 900-pixel stacking, and no 390-pixel overflow.
- Do not change the public portfolio design or GitHub-derived metadata.

---

### Task 1: Build the pure editor model

**Files:**
- Create: `admin/editor-model.js`
- Create: `tests/admin-editor-model.test.js`

**Interfaces:**
- Consumes: raw project records from `/api/projects`.
- Produces: `normalizeDrafts`, `draftFromRepository`, `updateProject`, `setFeatured`, `moveProject`, `buildPayload`, `cropRect`, `targetPathFor`, `summarizeChanges`, `validateDrafts`.

- [ ] **Step 1: Write failing model tests**

```js
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
  });

  test("rejects a fourth featured project", () => {
    const result = Model.setFeatured(projects, 3, true);
    expect(result.error).toBe("Only three projects can be featured.");
    expect(result.projects[3].featured).toBe(false);
  });

  test("keeps edits while moving projects and builds a clean payload", () => {
    const edited = Model.updateProject(projects, 1, { highlight: "Edited" });
    const moved = Model.moveProject(edited, 1, 0);
    expect(Model.buildPayload(moved)[0].highlight).toBe("Edited");
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
});
```

- [ ] **Step 2: Verify RED**

Run: `bun test tests/admin-editor-model.test.js`

Expected: FAIL with `Cannot find module '../admin/editor-model.js'`.

- [ ] **Step 3: Implement the UMD model**

Use this public shape and immutable updates:

```js
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AdminEditorModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var CATEGORY_KEYS = ["data-analysis", "ml-nlp", "visualization", "developer-tools", "apps"];
  var PREVIEW_KINDS = ["image", "chart", "app", "terminal", "workflow"];

  function clone(project) {
    return Object.assign({ report: "", highlight: "", featured: false, categories: [], preview: { kind: "workflow" } }, project, {
      categories: Array.isArray(project.categories) ? project.categories.slice() : [],
      preview: Object.assign({ kind: "workflow" }, project.preview || {}),
    });
  }

  function cropRect(width, height) {
    var ratio = 16 / 10, current = width / height;
    if (current > ratio) {
      var sw = height * ratio;
      return { sx: (width - sw) / 2, sy: 0, sw: sw, sh: height };
    }
    var sh = width / ratio;
    return { sx: 0, sy: (height - sh) / 2, sw: width, sh: sh };
  }

  return { CATEGORY_KEYS: CATEGORY_KEYS, PREVIEW_KINDS: PREVIEW_KINDS, normalizeDrafts: normalizeDrafts, draftFromRepository: draftFromRepository, updateProject: updateProject, setFeatured: setFeatured, moveProject: moveProject, buildPayload: buildPayload, cropRect: cropRect, targetPathFor: targetPathFor, summarizeChanges: summarizeChanges, validateDrafts: validateDrafts };
});
```

`buildPayload` trims optional strings, preserves valid `featured: false`, emits category arrays, and omits blank `src`/`alt`. `summarizeChanges(original, drafts, pendingUploads)` returns `{ changedProjects, newImages, archivedCandidates }`.

- [ ] **Step 4: Verify GREEN**

Run: `bun test tests/admin-editor-model.test.js tests/admin-projects.test.js`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add admin/editor-model.js tests/admin-editor-model.test.js
git commit -m "feat(admin): add project editor model"
```

---

### Task 2: Validate active assets and WebP files

**Files:**
- Create: `admin/asset-store.js`
- Create: `tests/admin-assets.test.js`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: repository root, relative preview paths, WebP bytes.
- Produces: `validatePreviewPath`, `readWebpDimensions`, `validateWebp`, `listActiveAssets`, `archiveRelativePath`, `resolveInside`.

- [ ] **Step 1: Write failing asset tests**

```js
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { readWebpDimensions, validatePreviewPath, validateWebp, archiveRelativePath } from "../admin/asset-store.js";

describe("admin asset store", () => {
  test("reads dimensions from a real project WebP", async () => {
    const bytes = new Uint8Array(await Bun.file(resolve(import.meta.dir, "../assets/img/projects/lcc-review.webp")).arrayBuffer());
    expect(readWebpDimensions(bytes)).toEqual({ width: 1280, height: 800 });
    expect(validateWebp(bytes)).toBeNull();
  });

  test.each([
    "../secret.webp",
    "assets/img/projects/../secret.webp",
    "assets/img/projects/%2e%2e/secret.webp",
    "assets\\img\\projects\\secret.webp",
    "assets/img/projects/archive/old.webp",
  ])("rejects unsafe active path %s", (path) => {
    expect(validatePreviewPath(path)).not.toBeNull();
  });

  test("creates a safe timestamped archive path", () => {
    expect(archiveRelativePath("20260721T183000", "assets/img/projects/demo.webp"))
      .toBe(".admin-archive/project-previews/20260721T183000/demo.webp");
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `bun test tests/admin-assets.test.js`

Expected: FAIL because `admin/asset-store.js` does not exist.

- [ ] **Step 3: Implement validation and WebP parsing**

Implement RIFF/WEBP validation for `VP8X`, `VP8 `, and `VP8L` dimension layouts. `validateWebp(bytes)` returns one of `invalid-webp`, `wrong-dimensions`, `asset-too-large`, or `null`; use `MAX_BYTES = 180 * 1024`, `WIDTH = 1280`, `HEIGHT = 800`.

`validatePreviewPath` must repeatedly `decodeURIComponent` up to two times, reject decode errors, backslashes, `..` segments, absolute paths, non-WebP extensions, and anything outside `assets/img/projects/` or inside an `archive` segment.

`resolveInside(root, relative)` resolves symlinks for existing files and confirms the real path starts with the real active directory plus a separator.

`listActiveAssets(root)` returns sorted `{ path, size, width, height }` records for direct WebP files in the active directory; it does not recurse into archive or temporary directories.

- [ ] **Step 4: Ignore local archive and transaction directories**

Append exact entries:

```gitignore
.admin-archive/
.admin-tmp/
```

- [ ] **Step 5: Verify GREEN**

Run: `bun test tests/admin-assets.test.js tests/admin-projects.test.js`

Expected: all pass and all five current assets validate.

- [ ] **Step 6: Commit**

```bash
git add .gitignore admin/asset-store.js tests/admin-assets.test.js
git commit -m "feat(admin): validate project preview assets"
```

---

### Task 3: Add rollback-safe project save transactions

**Files:**
- Create: `admin/save-transaction.js`
- Create: `tests/admin-save-transaction.test.js`

**Interfaces:**
- Consumes: `{ root, projects, uploads, transactionId, hooks }`.
- Produces: `saveProjectTransaction(options) -> Promise<{ count, savedAssets, archivedAssets }>`.

`uploads` is a `Map<repo, { bytes: Uint8Array, target: string }>`; `hooks` optionally overrides `beforeInstall`, `beforeConfigReplace`, or filesystem operations for failure injection.

- [ ] **Step 1: Write failing transaction tests**

Create a temporary repository fixture containing `assets/js/projects.data.js`, `assets/img/projects/old.webp`, `.gitignore`, and a valid source WebP copied from the repository.

```js
test("saves config and upload and archives the replaced image", async () => {
  const fixture = await makeFixture();
  const bytes = await validWebpBytes();
  const result = await saveProjectTransaction({
    root: fixture.root,
    transactionId: "tx1",
    projects: [{ repo: "demo", categories: ["data-analysis"], preview: { kind: "chart", src: "assets/img/projects/demo.webp", alt: "Demo chart" } }],
    uploads: new Map([["demo", { bytes, target: "assets/img/projects/demo.webp" }]]),
  });
  expect(result.savedAssets).toEqual(["assets/img/projects/demo.webp"]);
  expect(result.archivedAssets).toEqual([".admin-archive/project-previews/tx1/old.webp"]);
  expect(await Bun.file(resolve(fixture.root, result.archivedAssets[0])).exists()).toBe(true);
});

test("restores config and old image when config replacement fails", async () => {
  const fixture = await makeFixture();
  const before = await Bun.file(fixture.dataFile).text();
  await expect(saveProjectTransaction({ ...fixture.options, hooks: { beforeConfigReplace() { throw new Error("injected"); } } })).rejects.toThrow("injected");
  expect(await Bun.file(fixture.dataFile).text()).toBe(before);
  expect(await Bun.file(fixture.oldAsset).exists()).toBe(true);
});
```

Also test: invalid upload writes nothing; target/upload association mismatch; referenced shared asset is not archived; JSON-only metadata save; duplicate target uploads; temporary directory cleanup.

- [ ] **Step 2: Verify RED**

Run: `bun test tests/admin-save-transaction.test.js`

Expected: FAIL because the transaction module is missing.

- [ ] **Step 3: Implement staged writes and rollback**

Use these fixed locations:

```js
const tempRoot = resolve(root, ".admin-tmp/project-editor", transactionId);
const archiveRoot = resolve(root, ".admin-archive/project-previews", transactionId);
```

Before writing, call `prepareProjects`, validate every referenced active raster, validate every upload target/association, and calculate reference counts from previous and next projects.

Stage config and upload bytes under `tempRoot`. Move newly unreferenced old assets to `archiveRoot`, install uploads, then atomically rename the staged config over `assets/js/projects.data.js`. Track every move. On failure, reverse installed uploads and archive moves, restore the previous config bytes, remove temp content, and rethrow a sanitized transaction error with `code` and `field` when available.

- [ ] **Step 4: Verify GREEN**

Run: `bun test tests/admin-save-transaction.test.js tests/admin-assets.test.js tests/admin-projects.test.js`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add admin/save-transaction.js tests/admin-save-transaction.test.js
git commit -m "feat(admin): save previews transactionally"
```

---

### Task 4: Extract a testable admin HTTP application

**Files:**
- Create: `admin/app.js`
- Create: `tests/admin-server.test.js`
- Modify: `admin/server.js`

**Interfaces:**
- Consumes: `createAdminApp({ root, owner, port, gitRunner })`.
- Produces: `{ fetch(req), gitPush(message) }` for Bun.serve and tests.

- [ ] **Step 1: Write failing endpoint tests**

```js
test("lists validated active assets", async () => {
  const app = createAdminApp(fixture.options);
  const res = await app.fetch(new Request("http://127.0.0.1:4747/api/assets"));
  expect(res.status).toBe(200);
  expect((await res.json()).assets[0]).toMatchObject({ width: 1280, height: 800 });
});

test("accepts multipart projects and repo-keyed uploads", async () => {
  const body = new FormData();
  body.set("projects", JSON.stringify(nextProjects));
  body.set("asset:demo", new File([await validWebpBytes()], "demo.webp", { type: "image/webp" }));
  const res = await app.fetch(new Request("http://127.0.0.1:4747/api/save", { method: "POST", headers: sameOriginHeaders, body }));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, count: 1, savedAssets: ["assets/img/projects/demo.webp"] });
});
```

Also cover JSON-only backward compatibility, malformed multipart JSON, missing upload association, cross-origin rejection, archive route denial, static admin module serving, sanitized 400/500 errors, and a fake `gitRunner` assertion that stages exactly `assets/js/projects.data.js` plus `assets/img/projects` without archive or unrelated paths.

- [ ] **Step 2: Verify RED**

Run: `bun test tests/admin-server.test.js`

Expected: FAIL because `createAdminApp` is missing.

- [ ] **Step 3: Implement `createAdminApp`**

Move current request routing, static asset handling, same-origin checks, project reads, and Git command orchestration into `app.js`. Parse save bodies by `content-type`:

```js
if (contentType.includes("multipart/form-data")) {
  const form = await req.formData();
  projects = JSON.parse(String(form.get("projects") || "null"));
  for (const [key, value] of form.entries()) {
    if (key.startsWith("asset:") && value instanceof File) uploads.set(key.slice(6), value);
  }
} else {
  projects = (await readBody(req)).projects;
}
```

Convert File values to validated `Uint8Array` upload records using each associated project's `preview.src`. Add `GET /api/assets` via `listActiveAssets`.

Git staging must use exact paths:

```js
["git", "add", "assets/js/projects.data.js", "assets/img/projects"]
```

Because archive and temp roots live outside the active directory and are ignored, they cannot be staged by this command.

- [ ] **Step 4: Reduce `server.js` to entry-point configuration**

```js
import { resolve } from "node:path";
import { createAdminApp } from "./app.js";

const ROOT = resolve(import.meta.dir, "..");
const PORT = Number(process.env.PORT) || 4747;
const app = createAdminApp({ root: ROOT, owner: "sciencemj", port: PORT });
Bun.serve({ hostname: "127.0.0.1", port: PORT, fetch: app.fetch });
```

Keep the current optional `open` behavior after startup.

- [ ] **Step 5: Verify GREEN**

Run: `bun test tests/admin-server.test.js tests/admin-save-transaction.test.js`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add admin/app.js admin/server.js tests/admin-server.test.js
git commit -m "feat(admin): add preview asset API"
```

---

### Task 5: Implement browser image conversion

**Files:**
- Create: `admin/image-processor.js`
- Create: `tests/admin-image-processor.test.js`

**Interfaces:**
- Consumes: browser `File`, Canvas and image decode APIs, `AdminEditorModel.cropRect`.
- Produces: `qualitySteps()`, `processImage(file) -> Promise<{ blob, url, width, height, size }>`.

- [ ] **Step 1: Write failing processor-contract tests**

```js
const Processor = require("../admin/image-processor.js");

test("uses bounded descending quality steps", () => {
  expect(Processor.qualitySteps()).toEqual([.82, .78, .74, .70, .66, .62, .58, .54, .50]);
});

test("rejects unsupported source MIME types before decode", async () => {
  await expect(Processor.processImage({ type: "image/gif" })).rejects.toMatchObject({ code: "unsupported-image-type" });
});
```

- [ ] **Step 2: Verify RED**

Run: `bun test tests/admin-image-processor.test.js`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement the UMD browser processor**

`processImage` validates MIME, decodes using `createImageBitmap` when available and an object-URL Image fallback otherwise, draws the model's centered crop into a 1280 × 800 canvas, and calls `canvas.toBlob("image/webp", quality)` for each quality step until size is below 180 KB. It revokes every temporary object URL. It throws stable codes: `unsupported-image-type`, `image-decode-failed`, `webp-encode-failed`, `asset-too-large`.

In CommonJS tests, browser-dependent processing may accept an injected environment as a second argument:

```js
processImage(file, { decode, createCanvas, createObjectURL, revokeObjectURL })
```

Use the injected environment to test successful quality fallback and URL cleanup without mocking unrelated admin behavior.

- [ ] **Step 4: Verify GREEN**

Run: `bun test tests/admin-image-processor.test.js tests/admin-editor-model.test.js`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add admin/image-processor.js tests/admin-image-processor.test.js
git commit -m "feat(admin): convert preview uploads to WebP"
```

---

### Task 6: Build the master-detail editor UI

**Files:**
- Create: `admin/admin.css`
- Create: `admin/editor-view.js`
- Create: `admin/admin.js`
- Create: `tests/admin-view.test.js`
- Create: `tests/admin-ui-contract.test.js`
- Modify: `admin/index.html`

**Interfaces:**
- Consumes: `AdminEditorModel`, `AdminImageProcessor`, `/api/projects`, `/api/assets`, GitHub repositories.
- Produces: `AdminEditorView.renderList`, `renderInspector`, `renderCardPreview`, `renderChangeSummary`; a complete interactive admin page.

- [ ] **Step 1: Write failing pure-view tests**

```js
const View = require("../admin/editor-view.js");

test("renders searchable master rows and selected state", () => {
  const html = View.renderList(projects, { selectedIndex: 1, query: "" });
  expect((html.match(/data-project-index=/g) || []).length).toBe(projects.length);
  expect(html).toContain('aria-current="true"');
  expect(html).toContain("Move up");
});

test("renders every curated field and both source modes", () => {
  const html = View.renderInspector(projects[0], { sourceMode: "upload", errors: {} });
  for (const name of ["Featured", "Highlight", "Categories", "Report path", "Preview kind", "Existing path", "Alt text"]) expect(html).toContain(name);
  expect(html).toContain('role="tablist"');
  expect(html).toContain('type="file"');
});

test("renders a complete safe draft when adding a GitHub repository", () => {
  const draft = Model.draftFromRepository({ name: "new-repo", has_pages: true });
  expect(draft).toEqual({ repo: "new-repo", report: "report.html", featured: false, highlight: "", categories: [], preview: { kind: "workflow" } });
});
```

- [ ] **Step 2: Write failing page-contract tests**

Assert `index.html` loads tokens, `admin.css`, `editor-model.js`, `image-processor.js`, `editor-view.js`, and `admin.js` in dependency order. Assert the old inline `<style>` and application IIFE are absent.

- [ ] **Step 3: Verify RED**

Run: `bun test tests/admin-view.test.js tests/admin-ui-contract.test.js`

Expected: FAIL because the new modules do not exist and the inline page remains.

- [ ] **Step 4: Implement pure HTML renderers with escaping**

Use a UMD view module. Every dynamic string goes through one `esc` helper. Project rows expose stable `data-project-index`; fields expose stable `data-field`; error elements use predictable ids and `aria-describedby`. Add `draftFromRepository` to the Task 1 model export with the exact safe-default record asserted above.

The live card preview uses the same preview-kind labels, 16:10 image dimensions, terminal/app/workflow fallback language, title humanization, and category labels as the public card without importing public orchestration.

- [ ] **Step 5: Replace `index.html` with a semantic shell**

Keep the pre-paint theme bootstrap. The shell includes the sticky command bar, list panel, inspector panel, GitHub add-project dialog, toast/live regions, and git log. Load external scripts with `defer`.

- [ ] **Step 6: Implement `admin.js` orchestration**

Maintain:

```js
var state = {
  original: [], drafts: [], selectedIndex: 0, query: "", sourceMode: "upload",
  pendingUploads: new Map(), assetOptions: [], errors: {}, dirty: false, inFlight: false,
};
```

Use delegated events for list selection, input/change, category toggles, move controls, upload selection/drop, source tabs, save, GitHub add, theme, and commit/push. Field changes update the model immutably and rerender only the affected list/inspector regions while restoring focus by `data-field`. Theme synchronization sets both `aria-label` and `title` to the destination action: `Switch to light theme` or `Switch to dark theme`.

For save, call `validateDrafts`, focus the first invalid field, build FormData when pending uploads exist, attach one `asset:<repo>` file per upload, and otherwise send JSON. On success replace `original` with normalized drafts, clear pending uploads and dirty state, refresh `/api/assets`, and announce the response summary.

- [ ] **Step 7: Implement restrained responsive CSS**

Use `grid-template-columns: minmax(280px, .72fr) minmax(0, 1.28fr)` above 900px, sticky inspector positioning below the command bar, 16:10 preview, compact master rows, 40-pixel controls, explicit focus-visible rings, field error states, and light/dark tokens. At 900px stack list then inspector. At 390px remove fixed widths and keep source tabs, categories, preview, and action buttons inside the viewport. Preserve reduced-motion behavior.

- [ ] **Step 8: Verify GREEN**

Run: `bun test tests/admin-view.test.js tests/admin-ui-contract.test.js tests/admin-ui-metadata.test.js`

Expected: all pass; opaque project metadata remains editable rather than merely preserved.

- [ ] **Step 9: Commit**

```bash
git add admin/index.html admin/admin.css admin/editor-view.js admin/admin.js tests/admin-view.test.js tests/admin-ui-contract.test.js
git commit -m "feat(admin): add master-detail project editor"
```

---

### Task 7: Integration and browser verification

**Files:**
- Create: `tests/admin-integration.test.js`
- Modify: only files needed to fix failures discovered here.

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: verified local editor, API transaction, upload conversion, and responsive accessibility evidence.

- [ ] **Step 1: Add an end-to-end handler contract test**

Using a temporary repository, call the real handler to load projects/assets, submit a valid multipart replacement, reload, and confirm metadata, active image, and archive results. Then submit an invalid replacement and confirm byte-for-byte unchanged config and assets.

- [ ] **Step 2: Run all automated verification**

Run: `bun test`

Expected: all tests pass with zero failures.

Run: `git diff --check`

Expected: exit 0.

- [ ] **Step 3: Start the admin server without opening a system browser**

Run: `bun admin/server.js --no-open`

Open: `http://127.0.0.1:4747/admin/`.

- [ ] **Step 4: Verify desktop light and dark at 1440 × 900**

Capture and inspect both themes. Confirm searchable nine-project master list, selected row, reorder controls, sticky inspector, live card preview, all fields, upload/path tabs, change summary, 40-pixel controls, and no console/page/local-request errors.

- [ ] **Step 5: Exercise an upload without publishing**

Use a disposable copy of an existing PNG/JPEG test fixture, confirm automatic 1280 × 800 WebP conversion and size readout, edit metadata, save to a temporary-root server instance, verify response counts and archive behavior, then confirm a forced validation failure leaves bytes unchanged.

- [ ] **Step 6: Verify keyboard and responsive behavior**

At 390 × 844 in both themes, confirm no horizontal overflow, list-before-inspector stacking, 16:10 preview, visible focus, destination-aware theme label, tab semantics, file-input access, category controls, reordering buttons, GitHub add-project safe defaults, error focus, and polite live announcements. Emulate reduced motion and confirm transitions are disabled.

- [ ] **Step 7: Review scope and run final gate**

Run fresh:

```bash
bun test
git diff --check
git status --short --branch
```

Required evidence: zero test failures; clean diff check; desktop/mobile light/dark screenshots inspected; no browser errors; JSON saves still work; multipart save and rollback work; active previews remain 1280 × 800 and below 180 KB; archive/temp roots remain ignored.

- [ ] **Step 8: Commit verification fixes if needed**

```bash
git add .gitignore admin tests
git commit -m "fix(admin): finish project editor verification"
```

Do not create an empty commit.
