/* Post editor. Renders the preview through the same renderPostPage() the server
   uses to write the file, so what you see is the file. */
import { cleanMeta, metaError, renderPostPage } from "./posts-store.js";
import { render } from "./markdown.js";
import { draftKeyFor, imagePaths, makeDraft, shouldOffer, worthKeeping } from "./draft.js";

const MAX_WIDTH = 1600;
const MAX_BYTES = 400 * 1024;
const SVG_MAX_BYTES = 200 * 1024;
const QUALITY_STEPS = [0.86, 0.82, 0.78, 0.74, 0.7, 0.64, 0.58, 0.5];

const el = (id) => document.getElementById(id);
const fields = {
  title: el("f-title"), slug: el("f-slug"), date: el("f-date"),
  kind: el("f-kind"), lang: el("f-lang"), tags: el("f-tags"), lead: el("f-lead"),
};
const markdownInput = el("markdown");

/* The editing surface: CodeMirror when it loads, the textarea when it does not.
   Everything below talks to this, never to a widget directly. */
let surface = {
  getValue: () => markdownInput.value,
  setValue(text) { markdownInput.value = text; },
  insertAtCursor(text) {
    const start = markdownInput.selectionStart;
    const end = markdownInput.selectionEnd;
    const value = markdownInput.value;
    markdownInput.value = value.slice(0, start) + text + value.slice(end);
    markdownInput.selectionStart = markdownInput.selectionEnd = start + text.length;
    markdownInput.focus();
  },
};
const preview = el("preview");
const saveBtn = el("save-btn");
const dirty = el("dirty-indicator");

/* Images the author added but has not saved yet: markdown path -> {blob, url}. */
const pendingImages = new Map();
let template = "";
let slugTouched = false;
let dirtyState = false;
let draftKey = draftKeyFor(null);
let draftTimer = null;
let draftNote = "";
let offeredDraft = null;

function toast(message, tone) {
  const node = el("toast");
  node.textContent = message;
  node.dataset.tone = tone || "info";
  node.classList.add("is-visible");
  setTimeout(() => node.classList.remove("is-visible"), 4000);
  el("status-live").textContent = message;
}

function setDirty(next) {
  dirtyState = next;
  if (!next) draftNote = "";
  dirty.lastElementChild.textContent = next ? "Unsaved changes" + draftNote : "No changes";
  dirty.classList.toggle("is-dirty", next);
  saveBtn.disabled = !next;
}

/* ---------- Drafts ----------
   A crash-and-mis-click net only. Kept in localStorage, cleared the moment the
   post is really saved, and never a substitute for saving. */

function readDraft(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function dropDraft(key) {
  try { localStorage.removeItem(key); } catch { /* nothing to clean up */ }
}

function storeDraft() {
  const draft = makeDraft(readMeta(), surface.getValue(), new Date().toISOString());
  if (!worthKeeping(draft)) { dropDraft(draftKey); return; }
  try {
    localStorage.setItem(draftKey, JSON.stringify(draft));
    draftNote = " · draft kept";
  } catch {
    draftNote = " · draft NOT kept";
  }
  if (dirtyState) setDirty(true);
}

function scheduleDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(storeDraft, 800);
}

function hideDraftBanner() {
  offeredDraft = null;
  el("draft-banner").hidden = true;
}

function offerDraft(draft) {
  offeredDraft = draft;
  const when = draft.savedAt ? new Date(draft.savedAt).toLocaleString() : "earlier";
  el("draft-message").textContent = `Unsaved draft from ${when}. It was never written to the repository.`;
  el("draft-banner").hidden = false;
}

/* A restored draft carries image links but not the image bytes, so say plainly
   which files are not there rather than letting the preview quietly break. */
async function reportMissingImages(markdown) {
  const paths = imagePaths(markdown);
  if (!paths.length) return;
  const missing = [];
  for (const path of paths) {
    try {
      const response = await fetch("/posts/" + path, { method: "HEAD" });
      if (!response.ok) missing.push(path);
    } catch { missing.push(path); }
  }
  if (missing.length) {
    toast(`Re-add ${missing.length === 1 ? "this image" : "these images"}: ${missing.join(", ")}`, "error");
  }
}

function restoreDraft() {
  const draft = offeredDraft;
  hideDraftBanner();
  if (!draft) return;
  fields.title.value = draft.title;
  fields.slug.value = draft.slug;
  fields.date.value = draft.date;
  fields.kind.value = draft.kind;
  fields.lang.value = draft.lang;
  fields.tags.value = (draft.tags || []).join(", ");
  fields.lead.value = draft.lead;
  surface.setValue(draft.markdown);
  slugTouched = true;
  setDirty(true);
  renderPreview();
  reportMissingImages(draft.markdown);
}

function slugify(value) {
  return String(value).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function readMeta() {
  return {
    title: fields.title.value,
    slug: fields.slug.value.trim(),
    date: fields.date.value,
    kind: fields.kind.value,
    lang: fields.lang.value,
    lead: fields.lead.value,
    tags: fields.tags.value.split(",").map((tag) => tag.trim()).filter(Boolean),
  };
}

/* Preview images live as object URLs until they are saved, so the relative
   paths in the markdown are swapped for something the iframe can load. */
function resolvePreviewSrc(src) {
  const pending = pendingImages.get(src);
  if (pending) return pending.url;
  return /^(https?:)?\/\//.test(src) ? src : "/posts/" + src.replace(/^\.?\//, "");
}

function renderPreview() {
  if (!template) return;
  let body;
  try {
    body = render(surface.getValue(), { resolveSrc: resolvePreviewSrc });
  } catch (error) {
    el("preview-note").textContent = error.message;
    return;
  }
  el("preview-note").textContent = "exactly what gets written";
  const raw = readMeta();
  const meta = cleanMeta({ ...raw, slug: raw.slug || "preview", date: raw.date || "2026-01-01" });
  /* Asset URLs in the shell are relative to posts/; the iframe is not. */
  const page = renderPostPage(template, meta, body).replace(/(href|src)="\.\.\//g, '$1="/');
  preview.srcdoc = page;
}

function refresh() {
  setDirty(true);
  renderPreview();
  scheduleDraft();
}

async function decode(file) {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);
  const image = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* Fits inside MAX_WIDTH keeping the aspect ratio, then steps quality down until
   the WebP is small enough. Mirrors what image-processor.js does for cards. */
async function toWebp(file) {
  const source = await decode(file);
  const sw = source.width || source.naturalWidth;
  const sh = source.height || source.naturalHeight;
  if (!sw || !sh) throw new Error("Could not read that image.");
  const scale = Math.min(1, MAX_WIDTH / sw);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (source.close) source.close();

  for (const quality of QUALITY_STEPS) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob) throw new Error("WebP encoding failed.");
    if (blob.size <= MAX_BYTES) return blob;
  }
  throw new Error("Image is still over 400KB after compression.");
}

/* One counter across both extensions so a .svg and a .webp never collide. */
function nextImageName(slug, extension) {
  const used = new Set(pendingImages.keys());
  (surface.getValue().match(/assets\/[a-z0-9-]+-\d+\.(?:webp|svg)/g) || []).forEach((path) => used.add(path));
  const taken = (index) => used.has(`assets/${slug}-${index}.webp`) || used.has(`assets/${slug}-${index}.svg`);
  let index = 1;
  while (taken(index)) index += 1;
  return `assets/${slug}-${index}.${extension}`;
}

/* Dropping or pasting an image adds it, wherever the editing surface lives. */
function imagesFrom(event) {
  const list = event.dataTransfer?.files || event.clipboardData?.files || [];
  return [...list].filter(isImage);
}

function attachDropTarget(node) {
  ["dragenter", "dragover"].forEach((type) => node.addEventListener(type, (event) => {
    event.preventDefault();
    node.classList.add("dropping");
  }));
  ["dragleave", "drop"].forEach((type) => node.addEventListener(type, () => {
    node.classList.remove("dropping");
  }));
  node.addEventListener("drop", (event) => {
    const files = imagesFrom(event);
    if (!files.length) return;
    event.preventDefault();
    addImages(files);
  });
  node.addEventListener("paste", (event) => {
    const files = imagesFrom(event);
    if (!files.length) return;
    event.preventDefault();
    addImages(files);
  });
}

/* Swaps the textarea for CodeMirror once it loads. If the CDN is unreachable
   the textarea simply stays, and everything else keeps working. */
async function mountLiveEditor() {
  try {
    const { createLiveEditor } = await import("./live-markdown.js");
    const host = el("editor-host");
    const editor = createLiveEditor({
      parent: host,
      doc: surface.getValue(),
      onChange: refresh,
      resolveSrc: resolvePreviewSrc,
      onDrop(event) {
        const files = imagesFrom(event);
        if (!files.length) return false;
        event.preventDefault();
        addImages(files);
        return true;
      },
      onPaste(event) {
        const files = imagesFrom(event);
        if (!files.length) return false;
        event.preventDefault();
        addImages(files);
        return true;
      },
    });
    markdownInput.hidden = true;
    host.hidden = false;
    surface = editor;
    attachDropTarget(host);
    el("image-note").textContent =
      "Drag an image in, or paste one. Syntax shows on the line you are editing.";
  } catch (error) {
    el("editor-host").hidden = true;
    el("image-note").textContent =
      "Live preview unavailable — editing plain markdown. " + (error?.message || error);
  }
}

/* A dragged .svg sometimes arrives with an empty type, so fall back to the name. */
function isImage(file) {
  return Boolean(file) && (String(file.type).startsWith("image/") || /\.svg$/i.test(file.name || ""));
}

/* SVG stays vector — rasterising a diagram through canvas would only lose it.
   Everything else is resized and re-encoded as WebP. */
async function prepareImage(file) {
  if (file.type === "image/svg+xml" || /\.svg$/i.test(file.name || "")) {
    if (file.size > SVG_MAX_BYTES) throw new Error("SVG must stay under 200KB.");
    return { blob: file, extension: "svg" };
  }
  return { blob: await toWebp(file), extension: "webp" };
}

async function addImages(files) {
  const slug = fields.slug.value.trim() || slugify(fields.title.value) || "post";
  if (!/^[a-z0-9-]+$/.test(slug)) {
    toast("Set a valid slug before adding images.", "error");
    return;
  }
  for (const file of files) {
    try {
      const { blob, extension } = await prepareImage(file);
      const name = nextImageName(slug, extension);
      pendingImages.set(name, { blob, url: URL.createObjectURL(blob) });
      surface.insertAtCursor(`\n\n![${file.name.replace(/\.[^.]+$/, "")}](${name})\n\n`);
      refresh();
      toast(`Added ${name} (${Math.round(blob.size / 1024)}KB)`, "success");
    } catch (error) {
      toast(error.message || "Could not add that image.", "error");
    }
  }
}

async function save() {
  const raw = readMeta();
  const invalid = metaError(raw);
  if (invalid) { toast(invalid, "error"); return; }
  const meta = cleanMeta(raw);

  let body;
  try {
    body = render(surface.getValue(), {});
  } catch (error) {
    toast(error.message, "error");
    return;
  }
  if (!body.trim()) { toast("The post body is empty.", "error"); return; }

  const form = new FormData();
  form.set("meta", JSON.stringify(meta));
  form.set("markdown", surface.getValue());
  form.set("html", body);
  /* Only ship images the body still references. */
  for (const [name, image] of pendingImages) {
    if (surface.getValue().includes(name)) form.set("image:" + name, image.blob, name.split("/").pop());
  }

  saveBtn.disabled = true;
  try {
    const response = await fetch("/api/posts/save", { method: "POST", body: form });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Save failed.");
    for (const [name, image] of pendingImages) {
      if (surface.getValue().includes(name)) URL.revokeObjectURL(image.url);
    }
    pendingImages.clear();
    clearTimeout(draftTimer);
    dropDraft(draftKey);
    draftKey = draftKeyFor(meta.slug);
    dropDraft(draftKey);
    hideDraftBanner();
    setDirty(false);
    await loadList(meta.slug);
    renderPreview();
    toast(`${result.created ? "Created" : "Updated"} ${result.url}`, "success");
  } catch (error) {
    saveBtn.disabled = false;
    toast(error.message || "Save failed.", "error");
  }
}

async function commit() {
  const log = el("gitlog");
  log.hidden = false;
  log.textContent = "Running git…";
  try {
    const response = await fetch("/api/git", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Publish post: " + (fields.title.value || fields.slug.value) }),
    });
    const result = await response.json();
    log.textContent = (result.steps || []).map((step) => `$ ${step.cmd}\n${step.output}`).join("\n\n");
    toast(result.ok ? "Pushed." : result.nothingToCommit ? "Nothing to commit." : "Git failed — see the log.",
      result.ok ? "success" : "error");
  } catch (error) {
    log.textContent = String(error);
    toast("Git failed.", "error");
  }
}

async function loadList(selected) {
  const response = await fetch("/api/posts");
  const { posts } = await response.json();
  const select = el("post-select");
  select.innerHTML = '<option value="">New post…</option>';
  for (const post of posts || []) {
    const match = /^posts\/([a-z0-9-]+)\.html$/.exec(String(post.url || ""));
    if (!match) continue;
    const option = document.createElement("option");
    option.value = match[1];
    option.textContent = `${post.date}  ${post.title}`;
    select.appendChild(option);
  }
  select.value = selected || "";
}

async function openPost(slug) {
  clearTimeout(draftTimer);
  hideDraftBanner();
  draftKey = draftKeyFor(slug);

  if (!slug) {
    surface.setValue("");
    Object.values(fields).forEach((field) => { if (field.type !== "select-one") field.value = ""; });
    fields.date.value = new Date().toISOString().slice(0, 10);
    slugTouched = false;
    setDirty(false);
    renderPreview();
  } else {
    const response = await fetch("/api/posts/" + slug);
    const result = await response.json();
    if (!result.ok) { toast(result.error || "Could not open that post.", "error"); return; }
    const entry = result.entry || {};
    fields.title.value = entry.title || "";
    fields.slug.value = slug;
    fields.date.value = entry.date || "";
    fields.kind.value = entry.kind || "Post";
    fields.lang.value = entry.lang || "ko";
    fields.tags.value = (entry.tags || []).join(", ");
    surface.setValue(result.markdown);
    slugTouched = true;
    setDirty(false);
    renderPreview();
  }

  const draft = readDraft(draftKey);
  if (shouldOffer(draft, { markdown: surface.getValue(), title: fields.title.value })) offerDraft(draft);
  else if (draft) dropDraft(draftKey);
}

function wire() {
  if (typeof globalThis.marked !== "object") {
    el("offline-warning").hidden = false;
    saveBtn.disabled = true;
    return;
  }

  Object.values(fields).forEach((field) => field.addEventListener("input", refresh));
  fields.slug.addEventListener("input", () => { slugTouched = true; });
  fields.title.addEventListener("input", () => {
    if (!slugTouched) fields.slug.value = slugify(fields.title.value);
  });
  markdownInput.addEventListener("input", refresh);

  el("insert-image-btn").addEventListener("click", () => el("image-input").click());
  el("image-input").addEventListener("change", (event) => {
    addImages([...event.target.files]);
    event.target.value = "";
  });

  attachDropTarget(markdownInput);

  saveBtn.addEventListener("click", save);
  el("commit-btn").addEventListener("click", commit);
  el("draft-restore").addEventListener("click", restoreDraft);
  el("draft-discard").addEventListener("click", () => { dropDraft(draftKey); hideDraftBanner(); });
  el("post-select").addEventListener("change", (event) => openPost(event.target.value));
  el("theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (error) {}
    renderPreview();
  });
  addEventListener("beforeunload", (event) => {
    if (!dirtyState) return;
    /* Write the draft synchronously — the debounce may not have fired yet. */
    clearTimeout(draftTimer);
    storeDraft();
    event.preventDefault();
  });
}

async function start() {
  wire();
  await mountLiveEditor();
  try {
    template = await (await fetch("/templates/post-template.html")).text();
  } catch {
    toast("Could not load the post shell.", "error");
  }
  await loadList("");
  await openPost("");
}

start();
