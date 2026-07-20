const { expect, test } = require("bun:test");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

test("theme button names destination theme", () => {
  const root = {
    theme: "dark",
    getAttribute() { return this.theme; },
    setAttribute(name, value) { if (name === "data-theme") this.theme = value; },
  };
  const button = {
    attrs: {},
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(name, handler) { if (name === "click") this.click = handler; },
  };
  const document = {
    documentElement: root,
    readyState: "complete",
    getElementById() { return button; },
  };
  const source = readFileSync(resolve(import.meta.dir, "../assets/js/theme.js"), "utf8");
  new Function("document", "localStorage", source)(document, { setItem() {} });
  expect(button.attrs["aria-label"]).toBe("Switch to light theme");
  button.click();
  expect(button.attrs["aria-label"]).toBe("Switch to dark theme");
});
