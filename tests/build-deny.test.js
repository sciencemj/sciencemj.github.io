/* The build copies the repo root as-is, so anything the deny list misses is
   published. Agent and editor tooling keeps adding dot-directories that hold
   absolute local paths and a code index — this pins them out of dist/. */
const { expect, test } = require("bun:test");
const { readdirSync } = require("node:fs");
const { resolve } = require("node:path");

const REPO = resolve(import.meta.dir, "..");

test("the build publishes no dot-directory and no local tooling config", async () => {
  const build = Bun.spawnSync(["bun", "tools/build-site.js"], { cwd: REPO });
  expect(build.exitCode).toBe(0);

  const entries = readdirSync(resolve(REPO, "dist"), { withFileTypes: true });

  const dotDirs = entries.filter((e) => e.isDirectory() && e.name.startsWith("."));
  expect(dotDirs.map((e) => e.name)).toEqual([]);

  const names = new Set(entries.map((e) => e.name));
  [".mcp.json", "opencode.jsonc", "CLAUDE.md", "AGENTS.md", "GEMINI.md", "README.md"]
    .forEach((name) => expect(names.has(name)).toBe(false));

  /* .nojekyll is the one dotfile Pages needs; denying dotfiles wholesale would
     silently turn the site over to Jekyll. */
  expect(names.has(".nojekyll")).toBe(true);
});
