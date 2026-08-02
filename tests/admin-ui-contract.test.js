import { expect, test } from "bun:test";

const html = await Bun.file(new URL("../admin/index.html", import.meta.url)).text();
const css = await Bun.file(new URL("../admin/admin.css", import.meta.url)).text().catch(() => "");
const script = await Bun.file(new URL("../admin/admin.js", import.meta.url)).text().catch(() => "");

test("loads external admin assets in dependency order", () => {
  expect(html).toContain('/assets/css/tokens.css');
  expect(html).toContain('/admin/admin.css');
  const files = ["editor-model.js", "image-processor.js", "editor-view.js", "admin.js"];
  const positions = files.map((file) => html.indexOf(`/admin/${file}`));
  expect(positions.every((position) => position > -1)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  expect(html).not.toContain("<style>");
  expect(html).not.toContain("(function () {\n  \"use strict\";");
});

test("provides semantic editor regions and live announcements", () => {
  for (const id of ["command-bar", "project-list", "project-inspector", "add-project-dialog", "status-live", "gitlog"]) {
    expect(html).toContain(`id="${id}"`);
  }
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain('id="error-live"');
});

test("implements approved responsive and accessibility contracts", () => {
  expect(css).toContain("grid-template-columns: minmax(280px, .72fr) minmax(0, 1.28fr)");
  expect(css).toContain("@media (max-width: 900px)");
  expect(css).toContain("@media (max-width: 430px)");
  expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  expect(css).toContain(":focus-visible");
  expect(css).toContain("aspect-ratio: 16 / 10");
  expect(css).toContain(".command-actions .button-secondary { display: none; }");
  expect(css).not.toContain("\n  .button-secondary { display: none; }");
  expect(script).toContain("new Map()");
  expect(script).toContain('asset:" + repo');
  expect(script).toContain("Switch to light theme");
  expect(script).toContain("Switch to dark theme");
  expect(script).toContain("state.drafts.findIndex");
  expect(script).toContain("error.repo");
});
