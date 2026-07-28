import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseManifestFile } from "../../../scripts/release/parse-manifest.mjs";
import { validateManifest } from "../../../scripts/release/validate-manifest.mjs";

const validFixturePath = fileURLToPath(
  new URL("../../fixtures/releases/valid.yaml", import.meta.url),
);

describe("release manifest schema", () => {
  it("accepts a complete immutable release manifest", async () => {
    const manifest = await parseManifestFile(validFixturePath);
    const result = await validateManifest(manifest);

    expect(result).toEqual({
      errors: [],
      valid: true,
    });
  });
});
