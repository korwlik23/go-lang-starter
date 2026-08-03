import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { parseDeployInputs } from "../../scripts/deploy/parse-inputs.mjs";
import { validateInfraCheckout } from "../../scripts/deploy/validate-infra-checkout.mjs";
import { validateTargetContract } from "../../scripts/deploy/validate-target-contract.mjs";
import {
  compareTargetFileHashes,
  hashTargetFiles,
} from "../../scripts/deploy/hash-target-files.mjs";
import { verifyImageParity } from "../../scripts/deploy/verify-image-parity.mjs";
import { verifyRunningRelease } from "../../scripts/deploy/verify-running-release.mjs";

const checkoutDirectories = [];
const targetDirectories = [];

async function createCheckout() {
  const directory = await mkdtemp(join(tmpdir(), "deploy-contract-"));
  checkoutDirectories.push(directory);
  const scriptPath = join(directory, "scripts", "deploy.sh");
  await mkdir(join(directory, "scripts"));
  await writeFile(scriptPath, "#!/usr/bin/env bash\necho deploy\n");
  return { directory, scriptPath };
}

afterEach(async () => {
  await Promise.all(
    [...checkoutDirectories.splice(0), ...targetDirectories.splice(0)].map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createTarget(env) {
  const directory = await mkdtemp(join(tmpdir(), "deploy-target-"));
  targetDirectories.push(directory);
  await writeFile(
    join(directory, ".env"),
    Object.entries(env)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n",
  );
  await writeFile(join(directory, "docker-compose.yml"), "services: {}\n");
  return directory;
}

function validApiCompose(image) {
  const hardened = {
    image,
    user: "65532:65532",
    read_only: true,
    tmpfs: ["/tmp:size=64m,mode=1777"],
    cap_drop: ["ALL"],
    security_opt: ["no-new-privileges:true"],
    deploy: { resources: { limits: { cpus: "1.00", memory: "512M" } } },
  };
  return {
    services: {
      api: { ...hardened, networks: ["proxy", "backend"] },
      "api-migrate": { ...hardened, networks: ["backend"] },
    },
    networks: {
      proxy: { external: true },
      backend: { external: true, name: "backend" },
    },
  };
}

describe("production deploy contract", () => {
  it("parses the five required deployment inputs", () => {
    const result = parseDeployInputs([
      "--infra-stack-dir",
      "D:/infra-stack",
      "--release-manifest",
      "releases/suite-v0.1.0.yaml",
      "--api-project",
      "go-api",
      "--admin-project",
      "vue-admin",
      "--site-project",
      "astro-site",
    ], "D:/go-lang-starter");

    expect(result).toEqual({
      infraStackDir: resolve("D:/infra-stack"),
      releaseManifest: resolve(
        "D:/go-lang-starter/releases/suite-v0.1.0.yaml",
      ),
      apiProject: "go-api",
      adminProject: "vue-admin",
      siteProject: "astro-site",
    });
  });

  it("rejects a missing required input", () => {
    expect(() =>
      parseDeployInputs([
        "--infra-stack-dir",
        "D:/infra-stack",
        "--release-manifest",
        "releases/suite-v0.1.0.yaml",
        "--api-project",
        "go-api",
        "--admin-project",
        "vue-admin",
      ], "D:/go-lang-starter"),
    ).toThrow("--site-project");
  });

  it("rejects a relative InfraStack path", () => {
    expect(() =>
      parseDeployInputs([
        "--infra-stack-dir",
        "relative/infra-stack",
        "--release-manifest",
        "releases/suite-v0.1.0.yaml",
        "--api-project",
        "go-api",
        "--admin-project",
        "vue-admin",
        "--site-project",
        "astro-site",
      ], "D:/go-lang-starter"),
    ).toThrow("--infra-stack-dir");
  });

  it("rejects a non-canonical InfraStack path", () => {
    expect(() =>
      parseDeployInputs([
        "--infra-stack-dir",
        "D:/infra-stack/../infra-stack",
        "--release-manifest",
        "releases/suite-v0.1.0.yaml",
        "--api-project",
        "go-api",
        "--admin-project",
        "vue-admin",
        "--site-project",
        "astro-site",
      ], "D:/go-lang-starter"),
    ).toThrow("canonical");
  });

  it.each([
    "docs/release.yaml",
    "releases/../docs/release.yaml",
  ])("rejects a release manifest outside releases/: %s", (manifestPath) => {
    expect(() =>
      parseDeployInputs([
        "--infra-stack-dir",
        "D:/infra-stack",
        "--release-manifest",
        manifestPath,
        "--api-project",
        "go-api",
        "--admin-project",
        "vue-admin",
        "--site-project",
        "astro-site",
      ], "D:/go-lang-starter"),
    ).toThrow("--release-manifest");
  });

  it("accepts a clean checkout with a pinned executable deploy script", async () => {
    const { directory, scriptPath } = await createCheckout();
    const manifest = {
      infraStack: {
        commit: "a".repeat(40),
        deployScript: {
          path: "scripts/deploy.sh",
          mode: "100755",
          sha256: "b".repeat(64),
        },
      },
    };
    const runGit = vi.fn(async (_cwd, args) => {
      const command = args.join(" ");
      if (command === "rev-parse --verify HEAD") return `${manifest.infraStack.commit}\n`;
      if (command === "status --porcelain=v1 --untracked-files=all") return "";
      if (command === "ls-files --stage -- scripts/deploy.sh") {
        return `100755 deadbeef 0\tscripts/deploy.sh\n`;
      }
      throw new Error(`unexpected git command: ${command}`);
    });

    const result = await validateInfraCheckout({
      infraStackDir: directory,
      manifest,
      runGit,
      sha256File: async (filePath) => {
        expect(filePath).toBe(scriptPath);
        return manifest.infraStack.deployScript.sha256;
      },
    });

    expect(result).toMatchObject({
      headCommit: manifest.infraStack.commit,
      deployScript: manifest.infraStack.deployScript,
    });
    expect(runGit).toHaveBeenCalledTimes(3);
  });

  it("rejects a dirty checkout before validating the deploy script", async () => {
    const { directory } = await createCheckout();
    const runGit = vi.fn(async (_cwd, args) => {
      const command = args.join(" ");
      if (command === "rev-parse --verify HEAD") return `${"a".repeat(40)}\n`;
      if (command === "status --porcelain=v1 --untracked-files=all") return " M ops/infra-stack/api/.env\n";
      throw new Error(`unexpected git command: ${command}`);
    });

    await expect(
      validateInfraCheckout({
        infraStackDir: directory,
        manifest: {
          infraStack: {
            commit: "a".repeat(40),
            deployScript: {
              path: "scripts/deploy.sh",
              mode: "100755",
              sha256: "b".repeat(64),
            },
          },
        },
        runGit,
      }),
    ).rejects.toMatchObject({ code: "INFRA_CHECKOUT_DIRTY" });
    expect(runGit).toHaveBeenCalledTimes(2);
  });

  it("accepts a hardened API target with digest-pinned runtime and migration images", async () => {
    const image = "ghcr.io/example/go-api@sha256:" + "a".repeat(64);
    const targetDirectory = await createTarget({
      APP_IMAGE: "ghcr.io/example/go-api:v0.1.0",
      APP_IMAGE_DIGEST_REF: image,
      MIGRATE_IMAGE: image,
      DEPLOY_MIGRATE: "0",
      DEPLOY_HEALTH_URL: "https://api.example.test/readyz",
      ROLLOUT_SERVICE: "api",
    });
    const renderCompose = vi.fn(async () => validApiCompose(image));

    const result = await validateTargetContract({
      targetDirectory,
      service: "api",
      expectedImage: image,
      expectedMigrationImage: image,
      expectedTag: "v0.1.0",
      expectedHealthUrl: "https://api.example.test/readyz",
      renderCompose,
    });

    expect(result).toMatchObject({
      service: "api",
      image,
      migrationImage: image,
      healthUrl: "https://api.example.test/readyz",
    });
    expect(renderCompose).toHaveBeenCalledOnce();
  });

  it("rejects an API target that enables deploy-time migration", async () => {
    const image = "ghcr.io/example/go-api@sha256:" + "a".repeat(64);
    const targetDirectory = await createTarget({
      APP_IMAGE: "ghcr.io/example/go-api:v0.1.0",
      APP_IMAGE_DIGEST_REF: image,
      MIGRATE_IMAGE: image,
      DEPLOY_MIGRATE: "1",
      DEPLOY_HEALTH_URL: "https://api.example.test/readyz",
      ROLLOUT_SERVICE: "api",
    });
    const renderCompose = vi.fn();

    await expect(
      validateTargetContract({
        targetDirectory,
        service: "api",
        expectedImage: image,
        expectedMigrationImage: image,
        expectedTag: "v0.1.0",
        expectedHealthUrl: "https://api.example.test/readyz",
        renderCompose,
      }),
    ).rejects.toMatchObject({ code: "TARGET_MIGRATION_FLAG_INVALID" });
    expect(renderCompose).not.toHaveBeenCalled();
  });

  it("rejects a registry target containing a source checkout", async () => {
    const image = "ghcr.io/example/go-api@sha256:" + "a".repeat(64);
    const targetDirectory = await createTarget({
      APP_IMAGE: "ghcr.io/example/go-api:v0.1.0",
      APP_IMAGE_DIGEST_REF: image,
      MIGRATE_IMAGE: image,
      DEPLOY_MIGRATE: "0",
      DEPLOY_HEALTH_URL: "https://api.example.test/readyz",
      ROLLOUT_SERVICE: "api",
    });
    await mkdir(join(targetDirectory, "src", ".git"), { recursive: true });

    await expect(
      validateTargetContract({
        targetDirectory,
        service: "api",
        expectedImage: image,
        expectedMigrationImage: image,
        expectedTag: "v0.1.0",
        renderCompose: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: "TARGET_SOURCE_CHECKOUT_PRESENT" });
  });

  it("detects target file mutation and rejects path traversal", async () => {
    const targetDirectory = await createTarget({
      APP_IMAGE_DIGEST_REF: "ghcr.io/example/site@sha256:" + "a".repeat(64),
      DEPLOY_MIGRATE: "0",
      DEPLOY_HEALTH_URL: "https://example.test/healthz",
      ROLLOUT_SERVICE: "site",
    });
    const before = await hashTargetFiles({ targetDirectory });
    await writeFile(join(targetDirectory, ".env"), "APP_IMAGE_DIGEST_REF=changed\n");
    const after = await hashTargetFiles({ targetDirectory });

    expect(() => compareTargetFileHashes(before, after)).toThrow("TARGET_FILES_MUTATED");
    await expect(
      hashTargetFiles({ targetDirectory, files: ["../outside.env"] }),
    ).rejects.toMatchObject({ code: "TARGET_FILE_PATH_INVALID" });
  });

  it("verifies release tag digest, runtime digest, migration parity, and RepoDigests", async () => {
    const image = "ghcr.io/example/go-api@sha256:" + "a".repeat(64);
    const tagRef = "ghcr.io/example/go-api:v0.1.0";
    const runDocker = vi.fn(async (args) => {
      if (args[0] === "buildx") return '"sha256:' + "a".repeat(64) + '"\n';
      if (args[0] === "pull") return "pulled\n";
      if (args[0] === "image") return JSON.stringify([{
        RepoDigests: [image],
      }]);
      throw new Error(`unexpected docker command: ${args.join(" ")}`);
    });

    const result = await verifyImageParity({
      component: "api",
      componentRelease: { tag: "v0.1.0", image },
      targetImage: image,
      migrationImage: image,
      runDocker,
    });

    expect(result).toMatchObject({ component: "api", image, tagRef });
    expect(runDocker).toHaveBeenCalledTimes(3);
  });

  it("rejects a mutable target image even when the release tag resolves correctly", async () => {
    const image = "ghcr.io/example/go-api@sha256:" + "a".repeat(64);
    await expect(
      verifyImageParity({
        component: "api",
        componentRelease: { tag: "v0.1.0", image },
        targetImage: "ghcr.io/example/go-api:v0.1.0",
        migrationImage: image,
        runDocker: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: "IMAGE_TARGET_NOT_IMMUTABLE" });
  });

  it("keeps the deployment wrapper fail-closed and ordered", async () => {
    const wrapper = await readFile("scripts/deploy-infra-stack.sh", "utf8");
    expect(wrapper).toContain("set -euo pipefail");
    expect(wrapper.indexOf("run --rm --no-deps api-migrate")).toBeGreaterThan(-1);
    expect(wrapper.indexOf('"$deploy_script" "$api_project"')).toBeLessThan(
      wrapper.indexOf('"$deploy_script" "$admin_project"'),
    );
    expect(wrapper.indexOf('"$deploy_script" "$admin_project"')).toBeLessThan(
      wrapper.indexOf('"$deploy_script" "$site_project"'),
    );
    expect(wrapper).toContain("compare_target_hashes");
  });

  it("waits for health and verifies the running container image ID", async () => {
    const image = "ghcr.io/example/site@sha256:" + "c".repeat(64);
    const runDocker = vi.fn(async (args) => {
      if (args[0] === "image") return "sha256:image-id\n";
      if (args[0] === "compose") return "container-123\n";
      if (args[0] === "inspect") return "sha256:image-id\n";
      throw new Error(`unexpected docker command: ${args.join(" ")}`);
    });
    const requestHealth = vi.fn(async () => ({ status: 200 }));

    const result = await verifyRunningRelease({
      service: "site",
      projectName: "astro-site",
      healthUrl: "https://example.test/healthz",
      expectedImage: image,
      runDocker,
      requestHealth,
    });

    expect(result).toMatchObject({
      service: "site",
      containerId: "container-123",
      imageId: "sha256:image-id",
      healthStatus: 200,
    });
    expect(requestHealth).toHaveBeenCalledOnce();
  });

  it("rejects a non-200 health response and image-ID mismatch", async () => {
    await expect(
      verifyRunningRelease({
        service: "admin",
        projectName: "vue-admin",
        healthUrl: "https://example.test/healthz",
        expectedImage: "ghcr.io/example/admin@sha256:" + "d".repeat(64),
        runDocker: vi.fn(),
        requestHealth: vi.fn(async () => ({ status: 503 })),
      }),
    ).rejects.toMatchObject({ code: "RUNNING_HEALTH_NON_200" });

    const runDocker = vi.fn(async (args) => {
      if (args[0] === "image") return "sha256/expected\n";
      if (args[0] === "compose") return "container-456\n";
      if (args[0] === "inspect") return "sha256/actual\n";
      throw new Error(`unexpected docker command: ${args.join(" ")}`);
    });
    await expect(
      verifyRunningRelease({
        service: "admin",
        projectName: "vue-admin",
        healthUrl: "https://example.test/healthz",
        expectedImage: "ghcr.io/example/admin@sha256:" + "d".repeat(64),
        runDocker,
        requestHealth: vi.fn(async () => ({ status: 200 })),
      }),
    ).rejects.toMatchObject({ code: "RUNNING_IMAGE_ID_MISMATCH" });
  });

  it("bounds health polling with a deadline", async () => {
    const now = vi.fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(2);
    await expect(
      verifyRunningRelease({
        service: "site",
        projectName: "astro-site",
        healthUrl: "https://example.test/healthz",
        expectedImage: "ghcr.io/example/site@sha256:" + "c".repeat(64),
        requestHealth: vi.fn(async () => {
          throw new Error("timeout");
        }),
        now,
        deadlineMs: 1,
        intervalMs: 0,
      }),
    ).rejects.toMatchObject({ code: "RUNNING_HEALTH_TIMEOUT" });
  });
});
