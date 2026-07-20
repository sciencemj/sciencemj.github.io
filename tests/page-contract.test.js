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
  expect(sceneModel).toBeGreaterThan(-1);
  expect(scene).toBeGreaterThan(sceneModel);
});

test("defines 16:10 previews for lead, featured, and compact mobile cards", () => {
  const css = readFileSync(resolve(import.meta.dir, "../assets/css/site.css"), "utf8");
  const mobile = css.slice(css.indexOf("@media (max-width: 560px)"), css.indexOf("/* skeleton */"));

  function declarationsFor(source, selector) {
    const blocks = [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    const block = blocks.find((match) => match[1].split(",").some((item) => item.trim() === selector));
    return block ? block[2] : "";
  }

  ["lead", "featured", "compact"].forEach((variant) => {
    const selector = `.project-card--${variant} .pc-preview`;
    const source = variant === "featured" ? css : mobile;
    expect(declarationsFor(source, selector)).toMatch(/aspect-ratio:\s*16\s*\/\s*10/);
  });
});
