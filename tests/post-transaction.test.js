import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { imageBytesError, imagePathError, sanitizeSvg, savePostTransaction } from "../admin/post-transaction.js";
import { parsePosts, serializePosts } from "../admin/posts-store.js";

const REPO = resolve(import.meta.dir, "..");
const META = {
  slug: "backprop", title: "역전파의 원리", date: "2026-08-04",
  kind: "Post", lang: "ko", lead: "체인 룰.", tags: ["Deep learning"],
};
const roots = [];

async function makeRoot(existingPosts = []) {
  const root = await mkdtemp(resolve(tmpdir(), "post-txn-"));
  roots.push(root);
  await mkdir(resolve(root, "assets/js"), { recursive: true });
  await mkdir(resolve(root, "templates"), { recursive: true });
  await mkdir(resolve(root, "posts"), { recursive: true });
  await writeFile(resolve(root, "assets/js/posts.data.js"), serializePosts(existingPosts));
  await writeFile(
    resolve(root, "templates/post-template.html"),
    '<html lang="{{LANG}}"><title>{{TITLE}}</title><meta content="{{DESCRIPTION}}">' +
    '<div class="post-meta">{{META}}</div><p class="post-lead">{{LEAD}}</p>' +
    '<article class="post-body">\n{{BODY}}\n</article></html>',
  );
  return root;
}

const save = (root, overrides = {}) => savePostTransaction({
  root, transactionId: "test-txn", meta: META,
  markdown: "## 소제목\n\n본문 $a_1$.", bodyHtml: "<h2>소제목</h2>\n<p>본문 $a_1$.</p>",
  ...overrides,
});

afterEach(async () => {
  while (roots.length) await rm(roots.pop(), { recursive: true, force: true });
});

const svgBytes = (markup) => new TextEncoder().encode(markup);
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';

describe("image guards", () => {
  test("names must sit under posts/assets and match the slug", () => {
    expect(imagePathError("assets/backprop-1.webp", "backprop")).toBeNull();
    expect(imagePathError("assets/backprop-2.svg", "backprop")).toBeNull();
    expect(imagePathError("assets/other-1.webp", "backprop")).not.toBeNull();
    expect(imagePathError("../../etc/passwd", "backprop")).not.toBeNull();
    expect(imagePathError("assets/backprop-1.png", "backprop")).not.toBeNull();
    expect(imagePathError("/assets/backprop-1.webp", "backprop")).not.toBeNull();
  });

  test("bytes must actually be a WebP", () => {
    expect(imageBytesError(new Uint8Array([1, 2, 3]))).not.toBeNull();
    expect(imageBytesError(new Uint8Array(0))).not.toBeNull();
    expect(imageBytesError(new Uint8Array(500 * 1024))).toContain("400KB");
  });

  test("an SVG is judged as markup, not as WebP", () => {
    expect(imageBytesError(svgBytes(SVG), "assets/backprop-1.svg")).toBeNull();
    expect(imageBytesError(svgBytes("<html>nope</html>"), "assets/backprop-1.svg")).not.toBeNull();
    expect(imageBytesError(svgBytes(SVG.padEnd(300 * 1024, " ")), "assets/backprop-1.svg")).toContain("200KB");
  });
});

describe("sanitizeSvg", () => {
  test("keeps the drawing", () => {
    expect(sanitizeSvg(SVG).text).toContain("<rect");
    expect(sanitizeSvg(SVG).error).toBeUndefined();
  });

  test("strips scripts and event handlers", () => {
    const hostile = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">' +
      '<script>fetch("/steal")</script><rect onclick=\'alert(2)\' width="4" height="4"/></svg>';
    const { text } = sanitizeSvg(hostile);
    expect(text).not.toMatch(/<script/i);
    expect(text).not.toMatch(/onload/i);
    expect(text).not.toMatch(/onclick/i);
    expect(text).toContain("<rect");
  });

  test("strips javascript: links, foreignObject and entity doctypes", () => {
    const hostile = '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>' +
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect/></a>' +
      "<foreignObject><body>hi</body></foreignObject></svg>";
    const { text } = sanitizeSvg(hostile);
    expect(text).not.toMatch(/javascript:/i);
    expect(text).not.toMatch(/ENTITY/i);
    expect(text).not.toMatch(/foreignObject/i);
  });

  test("drops references that would phone out to another origin", () => {
    const { text } = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.test/x.png"/></svg>');
    expect(text).not.toContain("evil.test");
  });

  test("rejects anything that is not an SVG", () => {
    expect(sanitizeSvg("<html></html>").error).toBeTruthy();
    expect(sanitizeSvg("").error).toBeTruthy();
  });

  test("accepts a real WebP from the repository", async () => {
    const bytes = new Uint8Array(await readFile(resolve(REPO, "assets/img/projects/lcc-review.webp")));
    expect(imageBytesError(bytes)).toBeNull();
  });
});

describe("savePostTransaction", () => {
  test("writes the page, the markdown source and the list entry", async () => {
    const root = await makeRoot();
    const result = await save(root);

    expect(result.created).toBe(true);
    expect(result.url).toBe("posts/backprop.html");

    const page = await readFile(resolve(root, "posts/backprop.html"), "utf8");
    expect(page).toContain("<h2>소제목</h2>");
    expect(page).toContain('<html lang="ko">');
    expect(page).not.toMatch(/\{\{[A-Z_]+\}\}/);

    expect(await readFile(resolve(root, "posts/backprop.md"), "utf8")).toContain("## 소제목");

    const posts = parsePosts(await readFile(resolve(root, "assets/js/posts.data.js"), "utf8"));
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ url: "posts/backprop.html", title: META.title, lang: "ko" });
  });

  test("saving again updates in place rather than appending", async () => {
    const root = await makeRoot();
    await save(root);
    const second = await save(root, { meta: { ...META, title: "Renamed" } });

    expect(second.created).toBe(false);
    const posts = parsePosts(await readFile(resolve(root, "assets/js/posts.data.js"), "utf8"));
    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe("Renamed");
  });

  test("stores an SVG as vector, sanitized", async () => {
    const root = await makeRoot();
    const hostile = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">' +
      "<script>bad()</script><circle r='4'/></svg>";
    const result = await save(root, { images: new Map([["assets/backprop-1.svg", svgBytes(hostile)]]) });

    expect(result.images).toEqual(["posts/assets/backprop-1.svg"]);
    const written = await readFile(resolve(root, "posts/assets/backprop-1.svg"), "utf8");
    expect(written).toContain("<circle");
    expect(written).not.toMatch(/<script|onload/i);
  });

  test("stores an image next to the post", async () => {
    const root = await makeRoot();
    const bytes = new Uint8Array(await readFile(resolve(REPO, "assets/img/projects/lcc-review.webp")));
    const result = await save(root, { images: new Map([["assets/backprop-1.webp", bytes]]) });

    expect(result.images).toEqual(["posts/assets/backprop-1.webp"]);
    expect(await Bun.file(resolve(root, "posts/assets/backprop-1.webp")).exists()).toBe(true);
  });

  test("rejects an image whose name does not match the slug, and writes nothing", async () => {
    const root = await makeRoot();
    const bytes = new Uint8Array(await readFile(resolve(REPO, "assets/img/projects/lcc-review.webp")));
    await expect(save(root, { images: new Map([["assets/elsewhere-1.webp", bytes]]) })).rejects.toThrow();

    expect(await Bun.file(resolve(root, "posts/backprop.html")).exists()).toBe(false);
    expect(parsePosts(await readFile(resolve(root, "assets/js/posts.data.js"), "utf8"))).toEqual([]);
  });

  test("rejects invalid metadata before touching the repository", async () => {
    const root = await makeRoot();
    await expect(save(root, { meta: { ...META, slug: "../escape" } })).rejects.toThrow();
    expect(parsePosts(await readFile(resolve(root, "assets/js/posts.data.js"), "utf8"))).toEqual([]);
  });

  test("rejects an empty body", async () => {
    const root = await makeRoot();
    await expect(save(root, { markdown: "   ", bodyHtml: "" })).rejects.toThrow();
  });

  test("a missing shell leaves the existing list untouched", async () => {
    const root = await makeRoot([{ date: "2025-01-01", kind: "Post", lang: "en", title: "Old", url: "posts/old.html" }]);
    await rm(resolve(root, "templates/post-template.html"));
    await expect(save(root)).rejects.toThrow();

    const posts = parsePosts(await readFile(resolve(root, "assets/js/posts.data.js"), "utf8"));
    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe("Old");
  });

  test("keeps other entries and re-sorts newest first", async () => {
    const root = await makeRoot([
      { date: "2026-12-01", kind: "Post", lang: "en", title: "Future", url: "posts/future.html" },
      { date: "2020-01-01", kind: "Post", lang: "en", title: "Ancient", url: "posts/ancient.html" },
    ]);
    await save(root);
    const posts = parsePosts(await readFile(resolve(root, "assets/js/posts.data.js"), "utf8"));
    expect(posts.map((post) => post.date)).toEqual(["2026-12-01", "2026-08-04", "2020-01-01"]);
  });
});
