import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { verifyAllReleases } from "../../../scripts/release/verify-all.mjs";
import { verifyRelease } from "../../../scripts/release/verify-release.mjs";
import { verifySubmodulePins } from "../../../scripts/release/verify-submodules.mjs";

const manifestCommit = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const differentCommit = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const validFixturePath = fileURLToPath(
  new URL("../../fixtures/releases/valid.yaml", import.meta.url),
);

describe("release submodule pins", () => {
  it("rejects a component when its parent gitlink differs from the manifest", async () => {
    await expect(
      verifySubmodulePins({
        components: {
          api: {
            commit: manifestCommit,
            path: "api",
            tag: "v0.1.0",
          },
        },
        inspectComponent: async () => ({
          exactTags: ["v0.1.0"],
          gitlinkCommit: differentCommit,
          headCommit: manifestCommit,
        }),
        rootDirectory: "D:\\suite",
      }),
    ).rejects.toMatchObject({
      code: "GITLINK_MISMATCH",
      component: "api",
    });
  });

  it("rejects a component when its checked-out HEAD differs from the manifest", async () => {
    await expect(
      verifySubmodulePins({
        components: {
          api: {
            commit: manifestCommit,
            path: "api",
            tag: "v0.1.0",
          },
        },
        inspectComponent: async () => ({
          exactTags: ["v0.1.0"],
          gitlinkCommit: manifestCommit,
          headCommit: differentCommit,
        }),
        rootDirectory: "D:\\suite",
      }),
    ).rejects.toMatchObject({
      code: "HEAD_MISMATCH",
      component: "api",
    });
  });

  it("requires the manifest tag to point exactly at HEAD in release mode", async () => {
    await expect(
      verifySubmodulePins({
        components: {
          api: {
            commit: manifestCommit,
            path: "api",
            tag: "v0.1.0",
          },
        },
        inspectComponent: async () => ({
          exactTags: ["v0.1.1"],
          gitlinkCommit: manifestCommit,
          headCommit: manifestCommit,
        }),
        releaseMode: true,
        rootDirectory: "D:\\suite",
      }),
    ).rejects.toMatchObject({
      code: "TAG_MISMATCH",
      component: "api",
    });
  });

  it("reads the parent gitlinks and checked-out child HEADs from Git", async () => {
    const results = await verifySubmodulePins({
      components: {
        api: {
          commit: "8f338e8275181237bbd9b4c68a227979f5f59343",
          path: "api",
          tag: "v0.1.0",
        },
        admin: {
          commit: "0fd4476d50f989e40776470f70e16618ef40b9c9",
          path: "admin",
          tag: "v0.1.0",
        },
        site: {
          commit: "4ad44f0026a790e6df37705955761b89b49b532d",
          path: "site",
          tag: "v0.1.0",
        },
      },
      rootDirectory: repositoryRoot,
    });

    expect(results).toHaveLength(3);
    expect(results.map((result) => result.gitlinkCommit)).toEqual([
      "0fd4476d50f989e40776470f70e16618ef40b9c9",
      "8f338e8275181237bbd9b4c68a227979f5f59343",
      "4ad44f0026a790e6df37705955761b89b49b532d",
    ]);
    expect(results.every((result) => result.headCommit === result.gitlinkCommit)).toBe(
      true,
    );
  });

  it("composes manifest, contract, and submodule verification", async () => {
    const contractVerifier = vi.fn(async () => [
      {
        name: "contracts.openapi.admin",
        path: "api/openapi/dist/admin.openapi.yaml",
      },
    ]);
    const submoduleVerifier = vi.fn(async () => [
      {
        component: "api",
        gitlinkCommit: manifestCommit,
        headCommit: manifestCommit,
      },
    ]);

    const result = await verifyRelease({
      contractVerifier,
      manifestPath: validFixturePath,
      rootDirectory: repositoryRoot,
      submoduleVerifier,
    });

    expect(result).toMatchObject({
      contracts: [{ name: "contracts.openapi.admin" }],
      suite: {
        tag: "suite-v0.1.0",
        version: "0.1.0",
      },
      submodules: [{ component: "api" }],
    });
    expect(contractVerifier).toHaveBeenCalledOnce();
    expect(submoduleVerifier).toHaveBeenCalledWith(
      expect.objectContaining({
        releaseMode: false,
        rootDirectory: repositoryRoot,
      }),
    );
  });

  it("verifies every explicitly selected release manifest", async () => {
    const releaseVerifier = vi.fn(async ({ manifestPath }) => ({
      manifestPath,
    }));

    const results = await verifyAllReleases({
      manifestPaths: ["releases/suite-v0.2.0.yaml", "releases/suite-v0.1.0.yaml"],
      releaseMode: true,
      releaseVerifier,
      rootDirectory: repositoryRoot,
    });

    expect(results.map((result) => result.manifestPath)).toEqual([
      "releases/suite-v0.1.0.yaml",
      "releases/suite-v0.2.0.yaml",
    ]);
    expect(releaseVerifier).toHaveBeenCalledTimes(2);
    expect(releaseVerifier).toHaveBeenCalledWith(
      expect.objectContaining({
        releaseMode: true,
        rootDirectory: repositoryRoot,
      }),
    );
  });

  it("verifies the fixture against the current parent checkout end to end", async () => {
    const result = await verifyRelease({
      manifestPath: validFixturePath,
      rootDirectory: repositoryRoot,
    });

    expect(result.contracts).toHaveLength(5);
    expect(result.submodules).toHaveLength(3);
  });
});
