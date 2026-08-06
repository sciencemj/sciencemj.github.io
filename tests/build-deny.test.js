/* The build copies the repo root as-is, so anything the deny list misses is
   published. Agent and editor tooling keeps adding dot-directories that hold
   absolute local paths and a code index — this pins them out of dist/. */
const { expect, test } = require("bun:test");
const { readdirSync, symlinkSync, unlinkSync } = require("node:fs");
const { resolve } = require("node:path");

const REPO = resolve(import.meta.dir, "..");

function build() {
  const run = Bun.spawnSync(["bun", "tools/build-site.js"], { cwd: REPO });
  /* Without this the assertion is just "1 is not 0" and the reason is lost. */
  if (run.exitCode !== 0) throw new Error(run.stderr.toString() || "build failed");
  return readdirSync(resolve(REPO, "dist"), { withFileTypes: true });
}

test("the build publishes no dot-directory and no local tooling config", () => {
  const entries = build();

  const dotDirs = entries.filter((e) => e.isDirectory() && e.name.startsWith("."));
  expect(dotDirs.map((e) => e.name)).toEqual([]);

  const names = new Set(entries.map((e) => e.name));
  [".mcp.json", "opencode.jsonc", "CLAUDE.md", "AGENTS.md", "GEMINI.md", "README.md"]
    .forEach((name) => expect(names.has(name)).toBe(false));

  /* .nojekyll is the one dotfile Pages needs; denying hidden entries wholesale
     would silently turn the site over to Jekyll. */
  expect(names.has(".nojekyll")).toBe(true);
});

test("a denied entry stays denied when it is a symlink", () => {
  /* readdir reports a symlinked directory as a file, so a deny rule consulted
     after the type check misses it — and copying a directory as a file is a
     hard crash, not a quiet leak. A symlinked node_modules is the real case. */
  const link = resolve(REPO, ".symlinked-tool");
  symlinkSync(resolve(REPO, "docs"), link, "dir");
  try {
    expect(new Set(build().map((e) => e.name)).has(".symlinked-tool")).toBe(false);
  } finally {
    unlinkSync(link);
  }
});
