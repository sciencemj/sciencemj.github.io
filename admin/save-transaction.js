import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { archiveRelativePath, resolveInside, validatePreviewPath, validateWebp } from "./asset-store.js";
import { parseProjects, prepareProjects, serializeProjects } from "./projects-store.js";

function transactionError(code, field, message) {
  const error = new Error(message);
  error.code = code;
  if (field) error.field = field;
  return error;
}

function references(projects) {
  const counts = new Map();
  for (const project of projects) {
    const src = project.preview?.src?.trim();
    if (src) counts.set(src, (counts.get(src) || 0) + 1);
  }
  return counts;
}

async function exists(path) {
  return Bun.file(path).exists();
}

export async function saveProjectTransaction(options) {
  const { root, transactionId, hooks = {} } = options;
  const uploads = options.uploads instanceof Map ? options.uploads : new Map();
  if (!root || !/^[A-Za-z0-9_-]+$/.test(transactionId || "")) {
    throw transactionError("invalid-transaction", null, "Invalid save transaction.");
  }

  const prepared = prepareProjects(options.projects);
  if (prepared.error) throw transactionError("invalid-projects", "projects", prepared.error);
  const projects = prepared.projects;
  const dataFile = resolve(root, "assets/js/projects.data.js");
  const beforeText = await Bun.file(dataFile).text();
  const previous = parseProjects(beforeText);
  const nextRefs = references(projects);
  const uploadTargets = new Set();
  const stagedUploads = [];

  for (const [repo, upload] of uploads) {
    const matches = projects.filter((project) => project.repo === repo);
    if (matches.length !== 1 || matches[0].preview?.src !== upload?.target) {
      throw transactionError("upload-target-mismatch", "preview", `Upload does not match project ${repo}.`);
    }
    const pathError = validatePreviewPath(upload.target);
    if (pathError) throw transactionError(pathError, "preview", "Invalid preview path.");
    if (uploadTargets.has(upload.target)) {
      throw transactionError("duplicate-upload-target", "preview", "Two uploads cannot share a target path.");
    }
    uploadTargets.add(upload.target);
    const bytes = upload.bytes instanceof Uint8Array ? upload.bytes : new Uint8Array();
    const fileError = validateWebp(bytes);
    if (fileError) throw transactionError(fileError, "preview", "Preview must be a 1280×800 WebP under 180KB.");
    stagedUploads.push({ repo, target: upload.target, bytes });
  }

  for (const path of nextRefs.keys()) {
    const pathError = validatePreviewPath(path);
    if (pathError) throw transactionError(pathError, "preview", "Invalid preview path.");
    if (uploadTargets.has(path)) continue;
    let bytes;
    try {
      bytes = new Uint8Array(await readFile(await resolveInside(root, path)));
    } catch {
      throw transactionError("missing-preview", "preview", `Preview does not exist: ${path}`);
    }
    const fileError = validateWebp(bytes);
    if (fileError) throw transactionError(fileError, "preview", `Invalid preview: ${path}`);
  }

  const oldRefs = references(previous);
  const archiveSources = new Set();
  for (const path of oldRefs.keys()) {
    if (!nextRefs.has(path)) archiveSources.add(path);
  }
  for (const target of uploadTargets) {
    if (await exists(await resolveInside(root, target))) archiveSources.add(target);
  }

  const tempRoot = resolve(root, ".admin-tmp/project-editor", transactionId);
  const stagedConfig = resolve(tempRoot, "projects.data.js");
  const installed = [];
  const archived = [];
  let configReplaced = false;

  try {
    await mkdir(resolve(tempRoot, "uploads"), { recursive: true });
    await writeFile(stagedConfig, serializeProjects(projects));
    for (const upload of stagedUploads) {
      upload.staged = resolve(tempRoot, "uploads", basename(upload.target));
      await writeFile(upload.staged, upload.bytes);
    }

    for (const source of archiveSources) {
      const sourcePath = await resolveInside(root, source);
      if (!await exists(sourcePath)) continue;
      const relative = archiveRelativePath(transactionId, source);
      const archivePath = resolve(root, relative);
      await mkdir(resolve(archivePath, ".."), { recursive: true });
      await rename(sourcePath, archivePath);
      archived.push({ source, sourcePath, relative, archivePath });
    }

    for (const upload of stagedUploads) {
      if (hooks.beforeInstall) await hooks.beforeInstall(upload);
      const targetPath = await resolveInside(root, upload.target);
      await rename(upload.staged, targetPath);
      installed.push({ target: upload.target, targetPath });
    }

    if (hooks.beforeConfigReplace) await hooks.beforeConfigReplace();
    await rename(stagedConfig, dataFile);
    configReplaced = true;
  } catch (error) {
    if (configReplaced) {
      const restore = resolve(tempRoot, "restore-projects.data.js");
      await writeFile(restore, beforeText);
      await rename(restore, dataFile);
    }
    for (const item of installed.reverse()) await rm(item.targetPath, { force: true });
    for (const item of archived.reverse()) {
      await mkdir(resolve(item.sourcePath, ".."), { recursive: true });
      await rename(item.archivePath, item.sourcePath);
    }
    await rm(tempRoot, { recursive: true, force: true });
    throw error;
  }

  await rm(tempRoot, { recursive: true, force: true });
  return {
    count: projects.length,
    savedAssets: installed.map((item) => item.target),
    archivedAssets: archived.map((item) => item.relative),
  };
}
