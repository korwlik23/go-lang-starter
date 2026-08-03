import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

import { sha256File } from "../release/sha256-file.mjs";

const DEFAULT_TARGET_FILES = [".env", "docker-compose.yml"];

export class TargetFilesHashError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = "TargetFilesHashError";
    this.code = code;
  }
}

function assertSafeRelativePath(filePath) {
  const segments = typeof filePath === "string" ? filePath.split(/[\\/]/) : [];
  if (
    typeof filePath !== "string" ||
    filePath.length === 0 ||
    filePath.includes("\0") ||
    filePath.includes("\\") ||
    path.isAbsolute(filePath) ||
    path.posix.isAbsolute(filePath) ||
    path.win32.isAbsolute(filePath) ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new TargetFilesHashError(
      "TARGET_FILE_PATH_INVALID",
      "Target file paths must be safe relative POSIX paths",
    );
  }
}

export async function hashTargetFiles({
  targetDirectory,
  files = DEFAULT_TARGET_FILES,
  hashFile = sha256File,
}) {
  if (!Array.isArray(files) || files.length === 0 || new Set(files).size !== files.length) {
    throw new TargetFilesHashError("TARGET_FILE_SET_INVALID", "Target file set must be non-empty and unique");
  }
  const checkoutRoot = path.resolve(targetDirectory);
  const canonicalCheckout = await realpath(checkoutRoot).catch(() => null);
  if (!canonicalCheckout || canonicalCheckout !== checkoutRoot) {
    throw new TargetFilesHashError("TARGET_DIRECTORY_PATH_INVALID", "Target project directory must be canonical");
  }
  const result = {};
  for (const filePath of files) {
    assertSafeRelativePath(filePath);
    const absolutePath = path.resolve(checkoutRoot, filePath);
    const relativePath = path.relative(checkoutRoot, absolutePath);
    if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
      throw new TargetFilesHashError("TARGET_FILE_PATH_INVALID", "Target file must remain inside its project directory");
    }
    const fileStat = await lstat(absolutePath).catch(() => null);
    if (!fileStat || !fileStat.isFile() || fileStat.isSymbolicLink()) {
      throw new TargetFilesHashError("TARGET_FILE_NOT_REGULAR", `Target file ${filePath} must be a regular file`);
    }
    result[filePath] = (await hashFile(absolutePath)).toLowerCase();
  }
  return result;
}

export function compareTargetFileHashes(before, after) {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") {
    throw new TargetFilesHashError("TARGET_FILE_SNAPSHOT_INVALID", "Target file snapshots must be objects");
  }
  const beforePaths = Object.keys(before).sort();
  const afterPaths = Object.keys(after).sort();
  if (
    beforePaths.length !== afterPaths.length ||
    beforePaths.some((filePath, index) => filePath !== afterPaths[index])
  ) {
    throw new TargetFilesHashError("TARGET_FILES_MUTATED", "Target file set changed during deployment");
  }
  for (const filePath of beforePaths) {
    if (before[filePath] !== after[filePath]) {
      throw new TargetFilesHashError("TARGET_FILES_MUTATED", `Target file ${filePath} changed during deployment`);
    }
  }
  return true;
}
