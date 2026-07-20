const { expect, test } = require("bun:test");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

function readProjects() {
  const source = readFileSync(resolve(import.meta.dir, "../assets/js/projects.data.js"), "utf8");
  const browser = {};
  new Function("window", source)(browser);
  return browser.PORTFOLIO_PROJECTS;
}

test("configures featured projects and local preview assets", async () => {
  const projects = readProjects();
  expect(projects.filter((project) => project.featured)).toHaveLength(3);
  expect(new Set(projects.flatMap((project) => project.categories))).toEqual(
    new Set(["data-analysis", "ml-nlp", "visualization", "developer-tools", "apps"]),
  );

  for (const project of projects.filter((item) => item.preview && item.preview.src)) {
    const file = Bun.file(resolve(import.meta.dir, "..", project.preview.src));
    expect(await file.exists()).toBe(true);
    expect(file.size).toBeLessThan(180 * 1024);
    expect(project.preview.alt.trim().length).toBeGreaterThan(0);
  }
});
