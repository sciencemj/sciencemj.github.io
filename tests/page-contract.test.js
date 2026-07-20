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

test("keeps every mobile project preview at 16:10", () => {
  const css = readFileSync(resolve(import.meta.dir, "../assets/css/site.css"), "utf8");
  const mobile = css.slice(css.indexOf("@media (max-width: 560px)"), css.indexOf("/* skeleton */"));
  expect(mobile).toMatch(/\.project-card--lead \.pc-preview[\s\S]*?aspect-ratio:\s*16\s*\/\s*10/);
});
