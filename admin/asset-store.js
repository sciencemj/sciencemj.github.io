import { readdir, realpath } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";

export const MAX_BYTES = 180 * 1024;
export const WIDTH = 1280;
export const HEIGHT = 800;

const ACTIVE_PREFIX = "assets/img/projects/";

function text(bytes, start, length) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function uint24(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

export function readWebpDimensions(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 20) return null;
  if (text(bytes, 0, 4) !== "RIFF" || text(bytes, 8, 4) !== "WEBP") return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const kind = text(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const data = offset + 8;
    if (data + size > bytes.length) return null;

    if (kind === "VP8X" && size >= 10) {
      return { width: uint24(bytes, data + 4) + 1, height: uint24(bytes, data + 7) + 1 };
    }
    if (kind === "VP8 " && size >= 10 && text(bytes, data + 3, 3) === "\x9d\x01\x2a") {
      return {
        width: view.getUint16(data + 6, true) & 0x3fff,
        height: view.getUint16(data + 8, true) & 0x3fff,
      };
    }
    if (kind === "VP8L" && size >= 5 && bytes[data] === 0x2f) {
      return {
        width: 1 + bytes[data + 1] + ((bytes[data + 2] & 0x3f) << 8),
        height: 1 + ((bytes[data + 2] >> 6) | (bytes[data + 3] << 2) | ((bytes[data + 4] & 0x0f) << 10)),
      };
    }
    offset = data + size + (size % 2);
  }
  return null;
}

export function validateWebp(bytes) {
  if (bytes.byteLength > MAX_BYTES) return "asset-too-large";
  const dimensions = readWebpDimensions(bytes);
  if (!dimensions) return "invalid-webp";
  if (dimensions.width !== WIDTH || dimensions.height !== HEIGHT) return "wrong-dimensions";
  return null;
}

export function validatePreviewPath(path) {
  if (typeof path !== "string" || path.includes("\\")) return "invalid-preview-path";
  let decoded = path;
  try {
    decoded = decodeURIComponent(decodeURIComponent(path));
  } catch {
    return "invalid-preview-path";
  }
  if (decoded.includes("\\") || decoded.startsWith("/") || decoded.includes("?") || decoded.includes("#")) {
    return "invalid-preview-path";
  }
  const segments = decoded.split("/");
  if (segments.includes("..") || segments.includes(".")) return "invalid-preview-path";
  if (!decoded.startsWith(ACTIVE_PREFIX)) return "invalid-preview-path";
  const filename = decoded.slice(ACTIVE_PREFIX.length);
  if (!filename || filename.includes("/") || !filename.toLowerCase().endsWith(".webp")) {
    return "invalid-preview-path";
  }
  return null;
}

export function archiveRelativePath(transactionId, sourcePath) {
  if (!/^[A-Za-z0-9_-]+$/.test(transactionId)) throw new Error("invalid transaction id");
  if (validatePreviewPath(sourcePath)) throw new Error("invalid preview path");
  return `.admin-archive/project-previews/${transactionId}/${basename(sourcePath)}`;
}

export async function resolveInside(root, relativePath) {
  if (typeof relativePath !== "string" || relativePath.includes("\\") || relativePath.startsWith("/")) {
    throw new Error("path escapes root");
  }
  const target = resolve(root, relativePath);
  const prefix = resolve(root) + sep;
  if (!target.startsWith(prefix)) throw new Error("path escapes root");
  const resolvedRoot = await realpath(root);
  const parent = await realpath(resolve(target, ".."));
  if (parent !== resolvedRoot && !parent.startsWith(resolvedRoot + sep)) throw new Error("path escapes root");
  return target;
}

export async function listActiveAssets(root) {
  const directory = resolve(root, ACTIVE_PREFIX);
  const entries = await readdir(directory, { withFileTypes: true });
  const assets = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".webp")) continue;
    const path = ACTIVE_PREFIX + entry.name;
    const file = Bun.file(resolve(directory, entry.name));
    const bytes = new Uint8Array(await file.arrayBuffer());
    const dimensions = readWebpDimensions(bytes);
    if (!dimensions) continue;
    assets.push({ path, bytes: file.size, ...dimensions });
  }
  return assets.sort((a, b) => a.path.localeCompare(b.path));
}
