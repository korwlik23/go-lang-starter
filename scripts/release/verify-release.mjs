import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseManifestFile } from "./parse-manifest.mjs";
import { validateManifest } from "./validate-manifest.mjs";
import { verifyManifestContracts } from "./verify-contracts.mjs";
import { verifySubmodulePins } from "./verify-submodules.mjs";

export class ReleaseVerificationError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = "ReleaseVerificationError";
    this.code = code;
    this.details = details;
  }
}

function assertTagVersions(manifest) {
  if (manifest.suite.tag !== `suite-v${manifest.suite.version}`) {
    throw new ReleaseVerificationError(
      "SUITE_TAG_VERSION_MISMATCH",
      "Suite tag does not match suite version",
    );
  }

  for (const [component, pin] of Object.entries(manifest.components)) {
    if (pin.tag !== `v${pin.version}`) {
      throw new ReleaseVerificationError(
        "COMPONENT_TAG_VERSION_MISMATCH",
        `Component tag does not match version for ${component}`,
      );
    }
  }
}

export async function verifyRelease({
  contractVerifier = verifyManifestContracts,
  manifestPath,
  releaseMode = false,
  rootDirectory = process.cwd(),
  submoduleVerifier = verifySubmodulePins,
}) {
  const manifest = await parseManifestFile(manifestPath);
  const validation = await validateManifest(manifest);

  if (!validation.valid) {
    throw new ReleaseVerificationError(
      "MANIFEST_INVALID",
      "Release manifest does not match the approved schema",
      validation.errors,
    );
  }

  assertTagVersions(manifest);

  const contracts = await contractVerifier({
    manifest,
    rootDirectory,
  });
  const submodules = await submoduleVerifier({
    components: manifest.components,
    releaseMode,
    rootDirectory,
  });

  return {
    contracts,
    manifestPath: path.resolve(manifestPath),
    submodules,
    suite: manifest.suite,
  };
}

export async function runReleaseCli(args = process.argv.slice(2)) {
  const releaseMode = args.includes("--release");
  const manifestPaths = args.filter(
    (argument) => argument !== "--" && argument !== "--release",
  );

  if (manifestPaths.length !== 1) {
    throw new ReleaseVerificationError(
      "INVALID_ARGUMENTS",
      "Usage: release:verify <manifest-path> [--release]",
    );
  }

  const result = await verifyRelease({
    manifestPath: manifestPaths[0],
    releaseMode,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) {
  runReleaseCli().catch((error) => {
    const code = error?.code ?? "RELEASE_VERIFICATION_FAILED";
    const message = error?.message ?? "Release verification failed";
    process.stderr.write(`${code}: ${message}\n`);
    process.exitCode = 1;
  });
}
