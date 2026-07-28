import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseManifestFile } from "../../../scripts/release/parse-manifest.mjs";
import { validateManifest } from "../../../scripts/release/validate-manifest.mjs";

const validFixturePath = fileURLToPath(
  new URL("../../fixtures/releases/valid.yaml", import.meta.url),
);

const invalidFixtures = [
  ["missing component", "missing-component.yaml", "/components/site"],
  ["mutable image", "mutable-image.yaml", "/components/api/image"],
  ["invalid semantic version", "invalid-semver.yaml", "/suite/version"],
  [
    "non-immutable InfraStack revision",
    "invalid-infra-revision.yaml",
    "/infraStack/commit",
  ],
  [
    "unsupported database claim",
    "unsupported-db-claim.yaml",
    "/databaseSupport/0/profile",
  ],
] as const;

describe("release manifest schema", () => {
  it("accepts a complete immutable release manifest", async () => {
    const manifest = await parseManifestFile(validFixturePath);
    const result = await validateManifest(manifest);

    expect(result).toEqual({
      errors: [],
      valid: true,
    });
  });

  it.each(invalidFixtures)(
    "rejects %s with a stable field path",
    async (_name, fixtureName, expectedPath) => {
      const fixturePath = fileURLToPath(
        new URL(`../../fixtures/releases/${fixtureName}`, import.meta.url),
      );
      const manifest = await parseManifestFile(fixturePath);
      const result = await validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.map((error) => error.path)).toContain(expectedPath);
    },
  );
});
