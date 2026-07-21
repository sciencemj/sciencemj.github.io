# Admin Project Editor Design

Date: 2026-07-21
Status: Approved design; awaiting written-spec review

## Goal

Upgrade the local portfolio admin page from a featured-project reorder tool into a complete project editor. The editor must manage all curated project metadata, support both image uploads and existing image paths, preview the resulting portfolio card, and save metadata and image changes safely.

The editor remains a local-only, zero-runtime-dependency Bun tool. It does not become a hosted CMS.

## Approved Decisions

- Use a master-detail layout: searchable and reorderable project list on the left, selected-project inspector on the right.
- Edit all curated metadata: `featured`, `highlight`, `categories`, `report`, preview `kind`, preview `src`, and preview `alt`.
- Support both image upload and existing-path modes.
- Convert uploads automatically with a centered 16:10 crop to a 1280 × 800 WebP below 180 KB.
- Move replaced, newly unreferenced images into a local archive instead of deleting them.
- Keep the archive out of Git and out of the deployed site.
- Save project metadata and uploaded images as one validated transaction.
- Keep manual crop controls, remote-image downloading, authentication, and multi-user editing out of scope.

## Audience and Primary Job

The only intended operator is the portfolio owner working on localhost. The page's single job is to keep every public project card accurate without requiring hand edits to `projects.data.js` or manual image conversion.

## Visual Direction

The editor inherits the public portfolio's Paper/Carbon themes, existing Space Grotesk/Hanken Grotesk/JetBrains Mono roles, Decision Orange accent, and restrained surface system. The public Living Data hero remains the portfolio's visual signature; the admin page behaves like a precise editorial instrument.

Controls use a minimum 40-pixel target. Decoration stays quiet so validation state, image quality, and save state remain visually dominant.

## Information Architecture

### Sticky command bar

The existing sticky command bar remains. It contains:

- admin identity and project count;
- unsaved-change indicator;
- theme toggle with destination-aware accessible label;
- `Commit & push`;
- primary `Save changes`.

`Save changes` is disabled when there is no valid dirty state. `Commit & push` stays separate because saving locally and publishing to Git are distinct operations.

### Master project list

The left pane contains:

- a repository-name search field;
- nine current projects, including projects without raster previews;
- 16:10 thumbnail or preview-kind fallback;
- repository name;
- Featured state;
- drag handle plus keyboard-accessible move controls;
- dirty and validation indicators.

Reordering changes the array order without discarding edits in other projects. Search affects visibility only, never payload order.

The existing GitHub-repository discovery list becomes an `Add project` action and search surface below the current-project list. Adding a repository creates a complete draft with safe defaults rather than a partial featured-only record.

### Selected-project inspector

The right pane contains a live rendering that matches the public card's preview treatment, followed by:

- Featured toggle;
- report path;
- highlight textarea;
- exactly five category checkboxes;
- preview-kind select: `image`, `chart`, `app`, `terminal`, `workflow`;
- source-mode tabs: `Upload` and `Existing path`;
- upload dropzone with equivalent click-to-select input;
- existing-path input with known-asset suggestions;
- alt-text input;
- image dimensions and encoded-size readout;
- per-field validation messages.

Switching projects preserves all draft edits. No field writes directly to disk.

## Featured and Category Rules

- At most three projects may have `featured: true`.
- Attempting to enable a fourth Featured project produces an inline error and does not alter the fourth flag.
- Categories use exactly the five public-site keys: `data-analysis`, `ml-nlp`, `visualization`, `developer-tools`, and `apps`.
- A project may have zero categories while being drafted, but save requires at least one category.
- Drag order controls the public-project order. Featured cards still derive from the first three records marked Featured.

## Image Input Modes

### Upload

Accepted source types are PNG, JPEG, and WebP. The browser decodes the image and uses Canvas to:

1. calculate a centered 16:10 crop;
2. render exactly 1280 × 800 pixels;
3. encode WebP starting at quality 0.82;
4. reduce quality in bounded steps to a floor of 0.50 until the blob is below 180 KB;
5. reject the source if it cannot satisfy the limit.

The UI shows the converted image, dimensions, final file size, and target path before save. The original upload is never written to disk.

The default target basename preserves the current preview basename when replacing an existing project image. A project with no current raster uses a filesystem-safe slug of its repository name plus `.webp`. The server rejects a target already owned by another project unless the new payload intentionally shares the same existing path and no new upload overwrites it.

### Existing path

The path must:

- be a relative path under `assets/img/projects/`;
- use forward slashes;
- contain no traversal, encoded traversal, or archive segment;
- name an existing WebP;
- resolve inside the active project-image directory;
- describe a 1280 × 800 image below 180 KB.

Known active files are available as suggestions, but the operator may type a valid path manually.

### Non-raster fallback previews

Kinds `app`, `terminal`, and `workflow` may omit `src` and `alt`, producing the existing deterministic fallback. When a source image is set, non-empty alt text is mandatory regardless of kind.

## Client State and Modules

The current inline page is split into focused zero-build assets:

- `admin/index.html`: semantic shell and script/style loading;
- `admin/admin.css`: responsive layout, component states, theme, focus, and reduced-motion rules;
- `admin/editor-model.js`: draft normalization, field updates, featured/category rules, payload building, safe target naming, crop geometry, and change summary;
- `admin/editor-view.js`: master list, inspector, live card preview, validation messages, and keyboard behavior;
- `admin/image-processor.js`: browser-only decode, crop, Canvas rendering, and bounded WebP encoding;
- `admin/admin.js`: loading, GitHub discovery, event orchestration, save request, and commit/push flow.

Pure model behavior uses a UMD/CommonJS-compatible boundary so Bun tests can exercise it without a browser. Browser-only APIs stay isolated in `image-processor.js`.

## Server Architecture

The Bun server keeps its localhost-only boundary and same-origin mutation checks. The request handler and filesystem transaction logic are separated so tests can use a temporary repository root without touching real portfolio files.

New server responsibilities are divided as follows:

- project metadata validation remains in `projects-store.js`;
- preview-path, WebP header/dimension, size, filename, and archive validation live in `asset-store.js`;
- the HTTP handler accepts JSON-only saves for backward compatibility and multipart saves for uploads;
- `server.js` only configures the real root, starts Bun, and optionally opens the page.

### Read endpoints

- `GET /api/projects` returns owner and normalized project records.
- `GET /api/assets` returns active WebP path, size, width, and height for existing-path suggestions.

### Save endpoint

`POST /api/save` accepts either:

- the existing JSON body `{ projects }` when there are no new uploads; or
- `multipart/form-data` with a `projects` JSON field and zero or more `asset:<repo>` WebP blobs.

The project JSON already contains each upload's final `preview.src`, allowing the server to verify a one-to-one association between upload fields and target paths.

The response includes:

```json
{
  "ok": true,
  "count": 9,
  "savedAssets": ["assets/img/projects/example.webp"],
  "archivedAssets": [".admin-archive/project-previews/2026-07-21T18-30-00/example.webp"]
}
```

Validation failures return HTTP 400 with a stable field-level error code and human-readable message. Filesystem or rollback failures return HTTP 500 without exposing arbitrary local paths.

## Transaction and Rollback

No production file changes until every project, path, upload association, WebP header, dimension, size, and reference rule passes validation.

After validation:

1. create `.admin-tmp/project-editor/<transaction-id>/` under the repository root;
2. write the serialized project config and uploaded WebPs into that directory;
3. identify old active images that become unreferenced in the new payload;
4. move those old images to a timestamped `.admin-archive/project-previews/<transaction>/` directory;
5. move staged uploads into their final active paths;
6. atomically replace `assets/js/projects.data.js` with the staged config;
7. remove the transaction directory.

If any move or replacement fails, the server restores archived images and the previous config, removes partially installed uploads, and reports failure. The archive move only applies to files that were referenced before the save and have zero references afterward. Shared images are never archived while still referenced.

`.admin-archive/` and `.admin-tmp/` are ignored by Git. Archive files are recoverable local backups and are never served by the admin HTTP asset route.

## Commit and Push

The existing confirmed `Commit & push` action stages only:

- `assets/js/projects.data.js`;
- active files under `assets/img/projects/`.

It does not stage `.admin-archive/`, temporary transaction files, or unrelated working-tree changes. The confirmation message reports the number of metadata records, new/replaced active images, and archived local backups.

## Validation and Error UX

Client validation provides fast feedback, but server validation is authoritative.

- Field errors appear adjacent to the responsible control and are connected with `aria-describedby`.
- The selected project and master-list row both indicate invalid state.
- The command bar shows a concise error summary and moves focus to the first invalid field after a failed save.
- Upload conversion reports unsupported type, decode failure, size-limit failure, and missing alt text distinctly.
- Existing-path mode reports missing, unsafe, incorrectly sized, or oversized files distinctly.
- Network and filesystem failures preserve the draft and offer retry; they do not clear dirty state.
- Successful save clears dirty state and reports record, active-image, and archive counts.

## Accessibility and Responsive Behavior

- Every input has a visible label.
- All interactive targets are at least 40 × 40 CSS pixels.
- Drag reordering has Move up and Move down button equivalents.
- Source-mode tabs expose correct tab semantics and selected state.
- The dropzone is not the sole upload mechanism; a labeled native file input remains operable.
- Keyboard focus is visible in light and dark themes.
- Status changes use a polite live region; blocking errors use an assertive region only when necessary.
- Reduced motion removes nonessential transitions.
- At 900 pixels and below, the project list stacks before the inspector.
- At 390 pixels, controls fit without horizontal overflow and the live preview remains 16:10.

## Testing Strategy

### Unit tests

- centered 16:10 crop geometry for landscape, portrait, square, and exact-ratio inputs;
- safe upload target naming and current-basename preservation;
- Featured maximum and category validation;
- draft switching, reordering, payload construction, and metadata preservation;
- safe project path and archive-path generation;
- WebP signature and 1280 × 800 dimension parsing;
- upload-to-project association and shared-reference rules.

### Filesystem integration tests

Using a temporary repository root:

- JSON-only saves remain backward compatible;
- multipart upload saves config and image together;
- invalid type, size, dimensions, path, or association writes nothing;
- replacement moves the old unreferenced asset to archive;
- a still-shared asset is not archived;
- injected write or rename failure restores config and assets;
- commit staging excludes archive and unrelated changes.

### Browser tests

- select and switch projects without losing drafts;
- edit every metadata field and save;
- upload PNG/JPEG/WebP and observe automatic WebP preview;
- choose an existing path and validate it;
- reorder with pointer and keyboard controls;
- enforce three Featured projects;
- confirm image alt requirements and inline error focus;
- verify light/dark themes, 900-pixel stacking, 390-pixel no-overflow, 40-pixel controls, and visible focus;
- verify no console, page, local-network, or asset errors.

## Out of Scope

- Manual focal-point or crop-position UI;
- remote URL downloading or proxying;
- image formats other than PNG, JPEG, and WebP as upload sources;
- deletion of archive backups from the admin page;
- remote authentication, hosted deployment, multi-user locking, or audit logs;
- editing GitHub-derived language, topics, timestamps, or repository descriptions;
- changing the public portfolio design.

## Acceptance Criteria

The feature is complete when:

- all nine current projects load in a searchable, reorderable master list;
- every approved curated field is editable and preserved;
- upload and existing-path modes both work;
- uploaded sources become 1280 × 800 WebPs below 180 KB before disk write;
- replacement archives the prior newly unreferenced active image locally;
- save is rollback-safe and writes no partial state after a failure;
- archive and transaction files remain outside Git and HTTP serving;
- commit/push stages only config and active preview assets;
- keyboard, theme, responsive, and reduced-motion requirements pass;
- the full Bun test suite and browser verification pass with zero failures or console errors.
