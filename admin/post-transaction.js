import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { readWebpDimensions } from "./asset-store.js";
import { cleanMeta, metaError, parsePosts, postUrl, renderPostPage, serializePosts, upsertPost } from "./posts-store.js";

export const MAX_IMAGE_BYTES = 400 * 1024;
export const MAX_IMAGE_WIDTH = 1600;
export const MAX_SVG_BYTES = 200 * 1024;

function transactionError(code, message, field) {
  const error = new Error(message);
  error.code = code;
  error.expose = true;
  if (field) error.field = field;
  return error;
}

/* Images are addressed the way the markdown addresses them — relative to
   posts/<slug>.html — and may only land in posts/assets/ under this slug.
   Photos and charts arrive as WebP; diagrams stay vector as SVG. */
export function imagePathError(name, slug) {
  if (typeof name !== "string" || !name) return "An image name is required.";
  if (name.includes("\\") || name.includes("..") || name.startsWith("/")) return "Invalid image path.";
  const expected = new RegExp("^assets/" + slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "-\\d{1,3}\\.(webp|svg)$");
  if (!expected.test(name)) return `Image must be named assets/${slug}-N.webp or .svg.`;
  return null;
}

/* An SVG is markup, and markup can carry script. It is inert inside <img>, but
   the file also sits at a real URL where opening it directly would run whatever
   is inside, so the dangerous parts come out before it is written. */
export function sanitizeSvg(text) {
  const source = String(text == null ? "" : text);
  if (!/<svg[\s>]/i.test(source)) return { error: "That file is not an SVG." };
  const clean = source
    .replace(/<!DOCTYPE[^>]*(\[[\s\S]*?\])?[^>]*>/gi, "")
    .replace(/<\?xml-stylesheet[\s\S]*?\?>/gi, "")
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script[^>]*\/>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/(href|xlink:href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, "")
    .replace(/<(a|use|image)\b([^>]*?)\s(href|xlink:href)\s*=\s*(["'])\s*(https?:)?\/\/[^"']*\4/gi, "<$1$2");
  if (!/<svg[\s>]/i.test(clean)) return { error: "That file is not an SVG." };
  return { text: clean };
}

export function imageBytesError(bytes, name = "") {
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength) return "Image is empty.";
  if (name.toLowerCase().endsWith(".svg")) {
    if (bytes.byteLength > MAX_SVG_BYTES) return "SVG must stay under 200KB.";
    return sanitizeSvg(new TextDecoder().decode(bytes)).error || null;
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) return "Image must stay under 400KB.";
  const dimensions = readWebpDimensions(bytes);
  if (!dimensions) return "Image must be a WebP file.";
  if (dimensions.width > MAX_IMAGE_WIDTH) return `Image must be ${MAX_IMAGE_WIDTH}px wide or less.`;
  return null;
}

function insideRoot(root, relativePath) {
  const target = resolve(root, relativePath);
  if (target !== root && !target.startsWith(root + sep)) throw transactionError("path-escape", "Path escapes the repository.");
  return target;
}

/* Writes posts/<slug>.md, posts/<slug>.html, any new images, and the
   posts.data.js entry. Anything that fails halfway is rolled back. */
export async function savePostTransaction(options) {
  const { root, transactionId, markdown, bodyHtml } = options;
  const images = options.images instanceof Map ? options.images : new Map();
  if (!root || !/^[A-Za-z0-9_-]+$/.test(transactionId || "")) {
    throw transactionError("invalid-transaction", "Invalid save transaction.");
  }

  const invalid = metaError(options.meta);
  if (invalid) throw transactionError("invalid-post", invalid, "meta");
  const meta = cleanMeta(options.meta);

  if (typeof markdown !== "string" || !markdown.trim()) {
    throw transactionError("empty-markdown", "The post body is empty.", "markdown");
  }
  if (typeof bodyHtml !== "string" || !bodyHtml.trim()) {
    throw transactionError("empty-body", "The rendered body is empty.", "markdown");
  }

  const staged = [];
  for (const [name, bytes] of images) {
    const pathError = imagePathError(name, meta.slug);
    if (pathError) throw transactionError("invalid-image-path", pathError, "images");
    const fileError = imageBytesError(bytes, name);
    if (fileError) throw transactionError("invalid-image", fileError, "images");
    /* SVG is written sanitized, not as uploaded. */
    const payload = name.toLowerCase().endsWith(".svg")
      ? new TextEncoder().encode(sanitizeSvg(new TextDecoder().decode(bytes)).text)
      : bytes;
    staged.push({ relative: "posts/" + name, bytes: payload });
  }

  const templatePath = insideRoot(root, "templates/post-template.html");
  let template;
  try {
    template = await Bun.file(templatePath).text();
  } catch {
    throw transactionError("missing-template", "templates/post-template.html is missing.");
  }

  const dataFile = insideRoot(root, "assets/js/posts.data.js");
  const beforeData = await Bun.file(dataFile).text();
  const nextPosts = upsertPost(parsePosts(beforeData), meta);

  const pagePath = insideRoot(root, postUrl(meta.slug));
  const sourcePath = insideRoot(root, "posts/" + meta.slug + ".md");
  const pageExisted = await Bun.file(pagePath).exists();
  const beforePage = pageExisted ? await Bun.file(pagePath).text() : null;
  const beforeSource = await Bun.file(sourcePath).exists() ? await Bun.file(sourcePath).text() : null;

  const tempRoot = resolve(root, ".admin-tmp/post-editor", transactionId);
  const installed = [];
  let pageWritten = false;
  let sourceWritten = false;
  let dataWritten = false;

  try {
    await mkdir(resolve(tempRoot, "images"), { recursive: true });
    await mkdir(resolve(root, "posts/assets"), { recursive: true });

    for (const image of staged) {
      image.staged = resolve(tempRoot, "images", image.relative.split("/").pop());
      await writeFile(image.staged, image.bytes);
    }

    const stagedPage = resolve(tempRoot, "page.html");
    const stagedSource = resolve(tempRoot, "source.md");
    const stagedData = resolve(tempRoot, "posts.data.js");
    await writeFile(stagedPage, renderPostPage(template, meta, bodyHtml));
    await writeFile(stagedSource, markdown);
    await writeFile(stagedData, serializePosts(nextPosts));

    for (const image of staged) {
      const target = insideRoot(root, image.relative);
      await rename(image.staged, target);
      installed.push(target);
    }
    await rename(stagedPage, pagePath);
    pageWritten = true;
    await rename(stagedSource, sourcePath);
    sourceWritten = true;
    await rename(stagedData, dataFile);
    dataWritten = true;
  } catch (error) {
    if (dataWritten) await writeFile(dataFile, beforeData);
    if (sourceWritten) {
      if (beforeSource == null) await rm(sourcePath, { force: true });
      else await writeFile(sourcePath, beforeSource);
    }
    if (pageWritten) {
      if (beforePage == null) await rm(pagePath, { force: true });
      else await writeFile(pagePath, beforePage);
    }
    for (const target of installed.reverse()) await rm(target, { force: true });
    await rm(tempRoot, { recursive: true, force: true });
    throw error;
  }

  await rm(tempRoot, { recursive: true, force: true });
  return {
    slug: meta.slug,
    url: postUrl(meta.slug),
    created: !pageExisted,
    images: staged.map((image) => image.relative),
    count: nextPosts.length,
  };
}
