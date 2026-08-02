import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { collectStructure } from "../../../scripts/verify-structure.mjs";

const root = resolve(import.meta.dirname, "..", "..", "..");

describe("M3 structure gate", () => {
  it("keeps the approved bounded-context layout measurable", () => {
    const result = collectStructure(root);

    expect(result.missingRequiredFiles).toEqual([]);
    expect(result.generatedBoundaryViolations).toEqual([]);
    expect(result.maxLines).toBeLessThan(500);
    expect(result.components.api.files).toBeGreaterThan(0);
    expect(result.components.api.controllerFiles).toBeGreaterThan(0);
    expect(result.components.admin.routeFiles).toBeGreaterThan(0);
    expect(result.components.site.routeFiles).toBeGreaterThan(0);
  });
});
