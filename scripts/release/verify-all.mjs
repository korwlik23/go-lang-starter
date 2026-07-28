import path from "node:path";
import { fileURLToPath } from "node:url";

import { verifyRelease } from "./verify-release.mjs";

export class ReleaseSetVerificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ReleaseSetVerificationError";
    this.code = code;
  }
}

export async function verifyAllReleases({
  manifestPaths,
  releaseMode = false,
  releaseVerifier = verifyRelease,
  rootDirectory = process.cwd(),
}) {
  if (!Array.isArray(manifestPaths) || manifestPaths.length === 0) {
    throw new ReleaseSetVerificationError(
      "NO_RELEASE_MANIFESTS",
      "At least one explicit release manifest path is required",
    );
  }

  const results = [];

  for (const manifestPath of [...manifestPaths].sort()) {
    results.push(
      await releaseVerifier({
        manifestPath,
        releaseMode,
        rootDirectory,
      }),
    );
  }

  return results;
}

export async function runAllReleasesCli(args = process.argv.slice(2)) {
  const releaseMode = args.includes("--release");
  const manifestPaths = args.filter(
    (argument) => argument !== "--" && argument !== "--release",
  );
  const results = await verifyAllReleases({
    manifestPaths,
    releaseMode,
  });

  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) {
  runAllReleasesCli().catch((error) => {
    const code = error?.code ?? "RELEASE_SET_VERIFICATION_FAILED";
    const message = error?.message ?? "Release set verification failed";
    process.stderr.write(`${code}: ${message}\n`);
    process.exitCode = 1;
  });
}
