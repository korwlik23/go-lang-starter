import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

describe("C4 local Compose contract", () => {
  const source = readFileSync(resolve(process.cwd(), "compose.dev.yml"), "utf8");
  const apiEnvironment = readFileSync(
    resolve(process.cwd(), "api", ".env.example"),
    "utf8",
  );
  const compose = parse(source) as {
    services: Record<string, Record<string, unknown>>;
    networks: Record<string, Record<string, unknown>>;
  };

  it("offers isolated PostgreSQL and MariaDB profiles", () => {
    expect(compose.services.postgres.profiles).toEqual(["postgres"]);
    expect(compose.services.mariadb.profiles).toEqual(["mariadb"]);
    expect(compose.services["api-postgres"].profiles).toEqual(["postgres"]);
    expect(compose.services["api-mariadb"].profiles).toEqual(["mariadb"]);
    expect(compose.networks.database.internal).toBe(true);
  });

  it("runs migrations before each matching API and avoids fixed names", () => {
    expect(compose.services["api-postgres"].depends_on).toHaveProperty(
      "migrate-postgres.condition",
      "service_completed_successfully",
    );
    expect(compose.services["api-mariadb"].depends_on).toHaveProperty(
      "migrate-mariadb.condition",
      "service_completed_successfully",
    );
    expect(source).not.toContain("container_name:");
  });

  it("keeps the local Admin origin aligned with API CORS and CSRF config", () => {
    expect(apiEnvironment).toContain("ADMIN_ORIGIN=http://127.0.0.1:5173");
    expect(apiEnvironment).toContain(
      "CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173",
    );
    expect(compose.services.admin.environment).toMatchObject({
      PUBLIC_API_BASE_URL: "http://127.0.0.1:8080/api/v1",
    });
  });

  it("keeps the private media root writable in read-only API containers", () => {
    for (const serviceName of ["api-postgres", "api-mariadb"]) {
      expect(compose.services[serviceName].environment).toMatchObject({
        MEDIA_STORAGE_ROOT: "/tmp/media",
      });
    }
  });

  it("hardens long-running application containers", () => {
    for (const serviceName of ["api-postgres", "api-mariadb", "admin", "site"]) {
      const service = compose.services[serviceName];
      expect(service.read_only, serviceName).toBe(true);
      expect(service.cap_drop, serviceName).toContain("ALL");
      expect(service.security_opt, serviceName).toContain(
        "no-new-privileges:true",
      );
    }
  });
});
