/* Builds the deployable site into dist/.

   Posts are the only generated thing: posts/<slug>.md is the source of truth and
   posts/<slug>.html is built here, so changing templates/post-template.html
   re-renders every post instead of leaving published ones on an old shell.

   Everything else is copied as-is. The deny list keeps the local admin tool, the
   tests and the specs off the public site. */

import { marked } from "marked";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { render } from "../admin/markdown.js";
import { cleanMeta, metaError, parsePosts, renderPostPage } from "../admin/posts-store.js";

const ROOT = resolve(import.meta.dir, "..");
const OUT = resolve(ROOT, "dist");

/* Directories and files that exist for development, not for readers. */
const DENY_DIRS = new Set([
  ".git", ".github", ".claude", ".superpowers", ".worktrees", ".admin-tmp", ".admin-archive",
  "node_modules", "dist", "admin", "tests", "tools", "docs", "templates",
]);
const DENY_FILES = new Set([
  "package.json", "bun.lock", "bun.lockb", ".DS_Store", ".gitignore", "README.md",
]);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = relative(ROOT, full);
    if (entry.isDirectory()) {
      if (DENY_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else {
      if (DENY_FILES.has(entry.name)) continue;
      /* Markdown sources and the posts README are inputs, not output. */
      if (rel.startsWith("posts/") && (rel.endsWith(".md"))) continue;
      yield rel;
    }
  }
}

async function copyStatic() {
  let count = 0;
  for await (const rel of walk(ROOT)) {
    /* Post pages are written by buildPosts, not copied — a stale one may be
       sitting in the working tree from the local editor. */
    if (/^posts\/[^/]+\.html$/.test(rel)) continue;
    const target = resolve(OUT, rel);
    await mkdir(dirname(target), { recursive: true });
    await Bun.write(target, Bun.file(resolve(ROOT, rel)));
    count += 1;
  }
  return count;
}

async function buildPosts() {
  const template = await Bun.file(resolve(ROOT, "templates/post-template.html")).text();
  const posts = parsePosts(await Bun.file(resolve(ROOT, "assets/js/posts.data.js")).text());
  const built = [];

  for (const post of posts) {
    const match = /^posts\/([a-z0-9-]+)\.html$/.exec(String(post.url || ""));
    if (!match) continue;
    const slug = match[1];
    const source = Bun.file(resolve(ROOT, "posts", slug + ".md"));
    if (!await source.exists()) {
      throw new Error(`posts.data.js lists ${post.url} but posts/${slug}.md is missing`);
    }
    const meta = cleanMeta({ ...post, slug, lead: post.lead || "" });
    const invalid = metaError(meta);
    if (invalid) throw new Error(`${slug}: ${invalid}`);

    const body = render(await source.text(), { parse: (text) => marked.parse(text) });
    const target = resolve(OUT, post.url);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, renderPostPage(template, meta, body));
    built.push(post.url);
  }
  return built;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const copied = await copyStatic();
const built = await buildPosts();
console.log(`dist/ — ${copied} files copied, ${built.length} post${built.length === 1 ? "" : "s"} built`);
built.forEach((url) => console.log("  " + url));
