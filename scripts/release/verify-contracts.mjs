import path from "node:path";

import { sha256File } from "./sha256-file.mjs";

export class ContractVerificationError extends Error {
  constructor(code, artifactPath, message) {
    super(message);
    this.name = "ContractVerificationError";
    this.code = code;
    this.path = artifactPath;
  }
}

function rejectUnsafePath(artifactPath) {
  const segments =
    typeof artifactPath === "string" ? artifactPath.split(/[\\/]/) : [];

  if (
    typeof artifactPath !== "string" ||
    artifactPath.length === 0 ||
    artifactPath.includes("\0") ||
    path.isAbsolute(artifactPath) ||
    path.posix.isAbsolute(artifactPath) ||
    path.win32.isAbsolute(artifactPath) ||
    artifactPath.includes("\\") ||
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    throw new ContractVerificationError(
      "UNSAFE_CONTRACT_PATH",
      artifactPath,
      "Contract path must be relative",
    );
  }
}

export async function verifyContractArtifact({ artifact, rootDirectory }) {
  rejectUnsafePath(artifact.path);
  const absolutePath = path.resolve(rootDirectory, artifact.path);
  const sha256 = await sha256File(absolutePath);

  if (sha256 !== artifact.sha256) {
    throw new ContractVerificationError(
      "CHECKSUM_MISMATCH",
      artifact.path,
      `Contract checksum mismatch: ${artifact.path}`,
    );
  }

  return {
    path: artifact.path,
    sha256,
  };
}

export async function verifyManifestContracts({ manifest, rootDirectory }) {
  const artifacts = [
    ["contracts.openapi.admin", manifest.contracts.openapi.admin],
    ["contracts.openapi.public", manifest.contracts.openapi.public],
    ["contracts.openapi.siteServer", manifest.contracts.openapi.siteServer],
    ["contracts.localizationCatalog", manifest.contracts.localizationCatalog],
    ["infraStack.deployScript", manifest.infraStack.deployScript],
  ];
  const results = [];

  for (const [name, artifact] of artifacts) {
    results.push({
      name,
      ...(await verifyContractArtifact({
        artifact,
        rootDirectory,
      })),
    });
  }

  return results;
}
