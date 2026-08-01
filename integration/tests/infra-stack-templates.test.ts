import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..", "..");

async function template(name: "api" | "admin" | "site") {
  const [composeSource, environmentSource] = await Promise.all([
    readFile(resolve(root, "ops", "infra-stack", name, "docker-compose.yml"), "utf8"),
    readFile(resolve(root, "ops", "infra-stack", name, ".env.example"), "utf8"),
  ]);
  return { compose: parse(composeSource), composeSource, environmentSource };
}

describe("InfraStack deployment templates", () => {
  it.each(["api", "admin", "site"] as const)(
    "hardens every %s workload without publishing host ports",
    async (name) => {
      const { compose, composeSource, environmentSource } = await template(name);
      expect(environmentSource).toContain("DEPLOY_MIGRATE=0");
      expect(environmentSource).toMatch(/^ROLLOUT_SERVICE=(api|admin|site)$/m);
      expect(environmentSource).toMatch(
        /^APP_IMAGE_DIGEST_REF=.+@sha256:[0-9a-f]{64}$/m,
      );
      expect(composeSource).not.toContain("container_name:");
      for (const service of Object.values(compose.services) as Record<string, unknown>[]) {
        expect(service).not.toHaveProperty("build");
        expect(service).not.toHaveProperty("ports");
        expect(service).toMatchObject({
          read_only: true,
          cap_drop: ["ALL"],
          security_opt: ["no-new-privileges:true"],
        });
        expect(service).toHaveProperty("user");
        expect(service).toHaveProperty("deploy.resources.limits");
      }
    },
  );

  it("isolates migration credentials and network access from the API runtime", async () => {
    const { compose, environmentSource } = await template("api");
    expect(compose.services.api.networks).toEqual(["proxy", "backend"]);
    expect(compose.services["api-migrate"].networks).toEqual(["backend"]);
    expect(compose.services.api.environment.DB_USER).toBe("${DB_RUNTIME_USER}");
    expect(compose.services["api-migrate"].environment.DB_USER).toBe(
      "${DB_MIGRATION_USER}",
    );
    expect(environmentSource).toContain(
      "MIGRATE_IMAGE=ghcr.io/korwlik23/go-api-starter@sha256:",
    );
  });

  it("keeps browser services on the proxy network only", async () => {
    for (const name of ["admin", "site"] as const) {
      const { compose, environmentSource } = await template(name);
      expect(compose.services[name].networks).toEqual(["proxy"]);
      expect(environmentSource).toMatch(/^DEPLOY_HEALTH_URL=https:\/\/.+\/healthz$/m);
    }
  });
});
