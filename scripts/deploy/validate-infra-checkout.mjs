import { lstat, realpath } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { sha256File as defaultSha256File } from "../release/sha256-file.mjs";

const execFile = promisify(execFileCallback);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;

export class InfraCheckoutValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "InfraCheckoutValidationError";
    this.code = code;
  }
}

async function defaultRunGit(cwd, args) {
  try {
    const result = await execFile("git", args, {
      cwd,
      encoding: "utf8",
      windowsHide: true,
    });
    return result.stdout;
  } catch (error) {
    throw new InfraCheckoutValidationError(
      "INFRA_GIT_COMMAND_FAILED",
      `Git command failed: git ${args.join(" ")}`,
    );
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
    throw new InfraCheckoutValidationError(
      "INFRA_DEPLOY_SCRIPT_PATH_INVALID",
      "InfraStack deploy script path must be a safe relative POSIX path",
    );
  }
}

function parseGitIndexMode(output, expectedPath) {
  const line = output.trim();
  const match = /^(\d{6})\s+\S+\s+\d+\t(.+)$/.exec(line);
  if (!match || match[2] !== expectedPath) {
    throw new InfraCheckoutValidationError(
      "INFRA_DEPLOY_SCRIPT_UNTRACKED",
      "InfraStack deploy script is not tracked by Git",
    );
  }
  return match[1];
}

export async function validateInfraCheckout({
  infraStackDir,
  manifest,
  runGit = defaultRunGit,
  sha256File = defaultSha256File,
}) {
  const infraStack = manifest?.infraStack;
  const expectedCommit = infraStack?.commit;
  const deployScript = infraStack?.deployScript;

  if (!COMMIT_PATTERN.test(expectedCommit ?? "")) {
    throw new InfraCheckoutValidationError(
      "INFRA_COMMIT_INVALID",
      "Manifest InfraStack commit must be a full 40-character SHA-1",
    );
  }
  if (!deployScript || !SHA256_PATTERN.test(deployScript.sha256 ?? "")) {
    throw new InfraCheckoutValidationError(
      "INFRA_DEPLOY_SCRIPT_CHECKSUM_INVALID",
      "Manifest deploy script checksum must be a lowercase SHA-256",
    );
  }
  if (deployScript.mode !== "100755") {
    throw new InfraCheckoutValidationError(
      "INFRA_DEPLOY_SCRIPT_MODE_INVALID",
      "Manifest deploy script mode must be 100755",
    );
  }

  assertSafeRelativePath(deployScript.path);
  const checkoutRoot = path.resolve(infraStackDir);
  const canonicalCheckout = await realpath(checkoutRoot).catch(() => null);
  if (!canonicalCheckout || canonicalCheckout !== checkoutRoot) {
    throw new InfraCheckoutValidationError(
      "INFRA_CHECKOUT_PATH_NOT_CANONICAL",
      "InfraStack checkout path must resolve to a canonical directory",
    );
  }
  const absoluteScriptPath = path.resolve(checkoutRoot, deployScript.path);
  const relativeScriptPath = path.relative(checkoutRoot, absoluteScriptPath);
  if (
    !relativeScriptPath ||
    relativeScriptPath === ".." ||
    relativeScriptPath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeScriptPath)
  ) {
    throw new InfraCheckoutValidationError(
      "INFRA_DEPLOY_SCRIPT_PATH_INVALID",
      "InfraStack deploy script must remain inside the checkout",
    );
  }

  const headCommit = (await runGit(checkoutRoot, ["rev-parse", "--verify", "HEAD"]))
    .trim()
    .toLowerCase();
  if (headCommit !== expectedCommit) {
    throw new InfraCheckoutValidationError(
      "INFRA_HEAD_MISMATCH",
      "InfraStack checkout HEAD does not match the release manifest",
    );
  }

  const status = (await runGit(checkoutRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ])).trim();
  if (status) {
    throw new InfraCheckoutValidationError(
      "INFRA_CHECKOUT_DIRTY",
      "InfraStack checkout must have a clean worktree and index",
    );
  }

  const fileStat = await lstat(absoluteScriptPath).catch(() => null);
  if (!fileStat || !fileStat.isFile() || fileStat.isSymbolicLink()) {
    throw new InfraCheckoutValidationError(
      "INFRA_DEPLOY_SCRIPT_NOT_REGULAR",
      "InfraStack deploy script must be a regular file",
    );
  }

  const indexMode = parseGitIndexMode(
    await runGit(checkoutRoot, ["ls-files", "--stage", "--", deployScript.path]),
    deployScript.path,
  );
  if (indexMode !== deployScript.mode) {
    throw new InfraCheckoutValidationError(
      "INFRA_DEPLOY_SCRIPT_MODE_MISMATCH",
      "InfraStack deploy script Git mode does not match the release manifest",
    );
  }

  const actualSha256 = (await sha256File(absoluteScriptPath)).toLowerCase();
  if (actualSha256 !== deployScript.sha256) {
    throw new InfraCheckoutValidationError(
      "INFRA_DEPLOY_SCRIPT_CHECKSUM_MISMATCH",
      "InfraStack deploy script checksum does not match the release manifest",
    );
  }

  return {
    headCommit,
    deployScript: {
      path: deployScript.path,
      mode: indexMode,
      sha256: actualSha256,
    },
  };
}
