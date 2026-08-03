import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const execute = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const apiRoot = fileURLToPath(new URL("../../../api/", import.meta.url));

describe("child OpenAPI contract pins", () => {
  it("keeps Admin and Site locks aligned with the checked-out API revision", async () => {
    const apiCommit = await gitValue(["-C", apiRoot, "rev-parse", "HEAD"]);
    const manifest = parse(
      await readFile(
        fileURLToPath(
          new URL("../../fixtures/releases/valid.yaml", import.meta.url),
        ),
        "utf8",
      ),
    ) as {
      components: { api: { commit: string } };
    };
    const adminLock = JSON.parse(
      await readFile(
        fileURLToPath(
          new URL("../../../admin/contracts/admin.openapi.lock.json", import.meta.url),
        ),
        "utf8",
      ),
    ) as { commit: string };
    const siteLock = JSON.parse(
      await readFile(
        fileURLToPath(
          new URL("../../../site/contracts/openapi.lock.json", import.meta.url),
        ),
        "utf8",
      ),
    ) as { commit: string };

    expect(manifest.components.api.commit).toBe(apiCommit);
    expect(adminLock.commit).toBe(apiCommit);
    expect(siteLock.commit).toBe(apiCommit);
  });

  it("keeps generated contract metadata aligned with each lock", async () => {
    const adminLock = JSON.parse(
      await readFile(
        fileURLToPath(
          new URL("../../../admin/contracts/admin.openapi.lock.json", import.meta.url),
        ),
        "utf8",
      ),
    ) as { commit: string };
    const adminMetadata = JSON.parse(
      await readFile(
        fileURLToPath(
          new URL("../../../admin/src/generated/api/contract.meta.json", import.meta.url),
        ),
        "utf8",
      ),
    ) as { commit: string };
    const siteLock = JSON.parse(
      await readFile(
        fileURLToPath(
          new URL("../../../site/contracts/openapi.lock.json", import.meta.url),
        ),
        "utf8",
      ),
    ) as { commit: string };
    const siteMetadata = JSON.parse(
      await readFile(
        fileURLToPath(
          new URL("../../../site/src/api/contract.meta.json", import.meta.url),
        ),
        "utf8",
      ),
    ) as { commit: string };

    expect(adminMetadata.commit).toBe(adminLock.commit);
    expect(siteMetadata.commit).toBe(siteLock.commit);
  });
});

async function gitValue(args: string[]): Promise<string> {
  const { stdout } = await execute("git", args, { cwd: repositoryRoot });
  return stdout.trim();
}
