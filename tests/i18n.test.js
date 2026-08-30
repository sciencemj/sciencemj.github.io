const { expect, test } = require("bun:test");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const SOURCE = readFileSync(resolve(import.meta.dir, "../assets/js/i18n.js"), "utf8");

function node(attrs) {
  return {
    attrs: { ...attrs },
    textContent: "",
    innerHTML: "",
    getAttribute(name) { return this.attrs[name] == null ? null : this.attrs[name]; },
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(name, handler) { if (name === "click") this.click = handler; },
  };
}

/* Enough of a document for i18n.js: an element list it can query by attribute,
   a documentElement to stamp lang on, and the toggle button. */
function documentOf(nodes) {
  const button = node({});
  return {
    documentElement: node({}),
    readyState: "complete",
    getElementById(id) { return id === "lang-toggle" ? button : null; },
    querySelectorAll(selector) {
      const name = selector.slice(1, -1);
      return nodes.filter((entry) => entry.attrs[name] != null);
    },
    button,
  };
}

function load(doc, stored) {
  const store = { value: stored };
  const win = {
    document: doc,
    localStorage: {
      getItem() { return store.value == null ? null : store.value; },
      setItem(name, value) { if (name === "lang") store.value = value; },
    },
  };
  new Function("window", SOURCE)(win);
  return { i18n: win.PortfolioI18n, store };
}

test("first visit reads English and the button offers Korean", () => {
  const doc = documentOf([node({ "data-i18n": "nav.writing" })]);
  const { i18n } = load(doc, null);
  expect(i18n.lang()).toBe("en");
  expect(doc.documentElement.attrs.lang).toBe("en");
  expect(doc.button.textContent).toBe("KO");
});

test("a stored Korean choice survives the reload", () => {
  const writing = node({ "data-i18n": "nav.writing" });
  const doc = documentOf([writing]);
  const { i18n } = load(doc, "ko");
  expect(i18n.lang()).toBe("ko");
  expect(doc.documentElement.attrs.lang).toBe("ko");
  expect(writing.textContent).toBe("글");
  expect(doc.button.textContent).toBe("EN");
});

test("clicking swaps the copy, the lang attribute and the stored choice", () => {
  const writing = node({ "data-i18n": "nav.writing" });
  const when = node({ "data-i18n-html": "edu.when" });
  const brand = node({ "data-i18n-attr": "aria-label:brand.aria" });
  const doc = documentOf([writing, when, brand]);
  const { store } = load(doc, null);

  expect(writing.textContent).toBe("Writing");
  expect(when.innerHTML).toContain("– present");
  expect(brand.attrs["aria-label"]).toBe("MJ Park — home");

  doc.button.click();

  expect(writing.textContent).toBe("글");
  expect(when.innerHTML).toContain("– 현재");
  expect(brand.attrs["aria-label"]).toBe("박민준 — 홈");
  expect(doc.documentElement.attrs.lang).toBe("ko");
  expect(store.value).toBe("ko");
  expect(doc.button.textContent).toBe("EN");
});

test("the button names its destination in the language it switches to", () => {
  const doc = documentOf([]);
  load(doc, null);
  expect(doc.button.attrs["aria-label"]).toBe("한국어로 보기");
  doc.button.click();
  expect(doc.button.attrs["aria-label"]).toBe("Switch to English");
});

test("onChange listeners hear the new language", () => {
  const doc = documentOf([]);
  const { i18n } = load(doc, null);
  const seen = [];
  i18n.onChange((lang) => seen.push(lang));
  doc.button.click();
  doc.button.click();
  expect(seen).toEqual(["ko", "en"]);
});

test("every English key has a Korean translation and nothing is left in English", () => {
  const { i18n } = load(documentOf([]), null);
  const en = i18n.keys("en");
  expect(en.length).toBeGreaterThan(0);
  expect(i18n.keys("ko").sort()).toEqual([...en].sort());
});
