import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { verifyContractArtifact } from "../../../scripts/release/verify-contracts.mjs";

const fixtureRoot = fileURLToPath(
  new URL("../../fixtures/contracts/", import.meta.url),
);
const fixturePath = fileURLToPath(
  new URL("../../fixtures/contracts/admin.openapi.yaml", import.meta.url),
);
const expectedSha256 =
  "937b78e96eabbb70e3e2bdcf4c5452f169aa7a825e666aa15a04aae434ff54da";

describe("release contract checksums", () => {
  it("accepts an artifact when its exact bytes match the pinned checksum", async () => {
    const result = await verifyContractArtifact({
      artifact: {
        path: "admin.openapi.yaml",
        sha256: expectedSha256,
      },
      rootDirectory: fixtureRoot,
    });

    expect(result).toEqual({
      path: "admin.openapi.yaml",
      sha256: expectedSha256,
    });
  });

  it("rejects an artifact when its bytes do not match the pinned checksum", async () => {
    await expect(
      verifyContractArtifact({
        artifact: {
          path: "admin.openapi.yaml",
          sha256:
            "0000000000000000000000000000000000000000000000000000000000000000",
        },
        rootDirectory: fixtureRoot,
      }),
    ).rejects.toMatchObject({
      code: "CHECKSUM_MISMATCH",
      path: "admin.openapi.yaml",
    });
  });

  it("rejects an absolute artifact path", async () => {
    await expect(
      verifyContractArtifact({
        artifact: {
          path: fixturePath,
          sha256: expectedSha256,
        },
        rootDirectory: fixtureRoot,
      }),
    ).rejects.toMatchObject({
      code: "UNSAFE_CONTRACT_PATH",
      path: fixturePath,
    });
  });

  it("rejects a parent-traversal artifact path", async () => {
    const traversalPath = "../contracts/admin.openapi.yaml";

    await expect(
      verifyContractArtifact({
        artifact: {
          path: traversalPath,
          sha256: expectedSha256,
        },
        rootDirectory: fixtureRoot,
      }),
    ).rejects.toMatchObject({
      code: "UNSAFE_CONTRACT_PATH",
      path: traversalPath,
    });
  });
});
