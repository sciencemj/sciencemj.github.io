const { expect, test } = require("bun:test");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const PAGES = ["index.html", "writing.html", "projects.html", "contact.html"];
const read = (name) => readFileSync(resolve(import.meta.dir, "..", name), "utf8");

test("every page loads the shared chrome and links to the other three", () => {
  PAGES.forEach((page) => {
    const html = read(page);
    expect(html).toContain('href="assets/css/tokens.css"');
    expect(html).toContain('href="assets/css/pages.css"');
    expect(html).toContain('src="assets/js/theme.js"');
    expect(html).toContain('src="assets/js/pages.js"');
    PAGES.forEach((target) => {
      if (target !== page) expect(html).toContain(`href="${target}"`);
    });
  });
});

test("pages that render project rows load the model before the renderer", () => {
  ["index.html", "projects.html"].forEach((page) => {
    const html = read(page);
    const data = html.indexOf('src="assets/js/projects.data.js"');
    const model = html.indexOf('src="assets/js/project-model.js"');
    const renderer = html.indexOf('src="assets/js/pages.js"');
    expect(data).toBeGreaterThan(-1);
    expect(model).toBeGreaterThan(data);
    expect(renderer).toBeGreaterThan(model);
    expect(html).toContain('id="projects-list"');
  });
});

test("pages that render writing rows load the post data first", () => {
  ["index.html", "writing.html"].forEach((page) => {
    const html = read(page);
    const data = html.indexOf('src="assets/js/posts.data.js"');
    const renderer = html.indexOf('src="assets/js/pages.js"');
    expect(data).toBeGreaterThan(-1);
    expect(renderer).toBeGreaterThan(data);
    expect(html).toContain('id="writing-list"');
  });
});

test("the landing page caps its lists and links to the full archives", () => {
  const html = read("index.html");
  expect(html).toMatch(/id="writing-list"[^>]*data-limit="4"/);
  expect(html).toMatch(/id="projects-list"[^>]*data-limit="4"/);
  expect(html).toContain('class="more" href="writing.html"');
  expect(html).toContain('class="more" href="projects.html"');
});

test("archive pages render their lists uncapped", () => {
  expect(read("writing.html")).not.toMatch(/id="writing-list"[^>]*data-limit/);
  expect(read("projects.html")).not.toMatch(/id="projects-list"[^>]*data-limit/);
});

test("each page marks its own nav link as current", () => {
  const current = { "writing.html": "writing.html", "projects.html": "projects.html", "contact.html": "contact.html" };
  Object.entries(current).forEach(([page, href]) => {
    expect(read(page)).toContain(`href="${href}" class="nav-link" aria-current="page"`);
  });
  expect(read("index.html")).not.toContain('aria-current="page"');
});

test("project thumbnails keep an explicit height so the aspect ratio wins", () => {
  const css = readFileSync(resolve(import.meta.dir, "../assets/css/pages.css"), "utf8");
  const block = css.slice(css.indexOf(".proj-thumb {"), css.indexOf(".proj-thumb--none"));
  expect(block).toMatch(/height:\s*auto/);
  expect(block).toMatch(/aspect-ratio:\s*16\s*\/\s*10/);
});

test("the skills marquee duplicates an identical set so the loop is seamless", () => {
  const html = read("index.html");
  const sets = [...html.matchAll(/<div class="skills-set"[^>]*>([\s\S]*?)<\/div>/g)]
    .map((match) => match[1].replace(/\s+/g, " ").trim());
  expect(sets).toHaveLength(2);
  expect(sets[0]).toBe(sets[1]);
});

/* ---------- Language toggle ---------- */

const i18nOf = () => {
  const source = readFileSync(resolve(import.meta.dir, "../assets/js/i18n.js"), "utf8");
  const win = {
    document: {
      documentElement: { setAttribute() {} },
      readyState: "complete",
      getElementById() { return null; },
      querySelectorAll() { return []; },
    },
    localStorage: { getItem() { return null; }, setItem() {} },
  };
  new Function("window", source)(win);
  return win.PortfolioI18n;
};

test("every page carries the language toggle and loads i18n before the renderer", () => {
  PAGES.forEach((page) => {
    const html = read(page);
    expect(html).toContain('id="lang-toggle"');
    const i18n = html.indexOf('src="assets/js/i18n.js"');
    const renderer = html.indexOf('src="assets/js/pages.js"');
    expect(i18n).toBeGreaterThan(-1);
    expect(renderer).toBeGreaterThan(i18n);
  });
});

/* A key that is in the markup but not in the dictionary ships an empty element,
   which is invisible in review — so it fails here instead. */
test("every data-i18n key in the markup exists in both dictionaries", () => {
  const i18n = i18nOf();
  const known = new Set(i18n.keys("en"));
  const korean = new Set(i18n.keys("ko"));
  PAGES.forEach((page) => {
    const html = read(page);
    const keys = [
      ...[...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map((match) => match[1]),
      ...[...html.matchAll(/data-i18n-attr="([^"]+)"/g)]
        .flatMap((match) => match[1].split(";"))
        .map((pair) => pair.slice(pair.indexOf(":") + 1).trim()),
    ];
    expect(keys.length).toBeGreaterThan(0);
    keys.forEach((key) => {
      expect(`${page}:${key}:${known.has(key)}`).toBe(`${page}:${key}:true`);
      expect(`${page}:${key}:${korean.has(key)}`).toBe(`${page}:${key}:true`);
    });
  });
});

test("the pages stay English by default so the toggle is the only way into Korean", () => {
  PAGES.forEach((page) => expect(read(page)).toContain('<html lang="en"'));
});
