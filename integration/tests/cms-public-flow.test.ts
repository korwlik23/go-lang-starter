import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type Seed = {
  site: {
    enabledLocales: string[];
    defaultLocale: string;
  };
  content: Array<{
    id: string;
    translations: Record<string, { status: string }>;
  }>;
  media: Array<{ visibility: string }>;
  redirects: Array<{ destination: string; statusCode: number }>;
  flow: {
    authorReviewPublish: string[];
    preview: { exchange: string; replay: string };
    cache: { invalidation: string };
  };
};

const fixturePath = resolve(process.cwd(), "integration/fixtures/cms/seed.yaml");

function readSeed(): Seed {
  return parse(readFileSync(fixturePath, "utf8")) as Seed;
}

describe("M3 CMS/public integration fixture", () => {
  it("keeps the author-to-public scenario deterministic and bounded", () => {
    const seed = readSeed();
    const statuses = seed.content.flatMap((item) =>
      Object.values(item.translations).map((translation) => translation.status),
    );

    expect(seed.site.enabledLocales.length).toBeGreaterThanOrEqual(2);
    expect(seed.site.defaultLocale).toBe("th");
    expect(statuses).toContain("published");
    expect(statuses).toContain("draft");
    expect(statuses).toContain("scheduled");
    expect(statuses).toContain("missing");
    expect(seed.media).toEqual([
      expect.objectContaining({ visibility: "private" }),
    ]);
    expect(seed.redirects).toEqual([
      expect.objectContaining({ destination: "/about", statusCode: 308 }),
    ]);
    expect(seed.flow.authorReviewPublish).toEqual([
      "draft",
      "review",
      "published",
    ]);
    expect(seed.flow.preview).toEqual({ exchange: "one-time", replay: "rejected" });
    expect(seed.flow.cache.invalidation).toBe("content-version");
  });

  it.skipIf(process.env.CMS_E2E !== "1")(
    "requires an explicitly configured live API and public site",
    async () => {
      const apiBase = process.env.CMS_API_BASE_URL;
      const publicBase = process.env.CMS_PUBLIC_BASE_URL;
      expect(apiBase, "CMS_API_BASE_URL is required for CMS_E2E").toBeTruthy();
      expect(publicBase, "CMS_PUBLIC_BASE_URL is required for CMS_E2E").toBeTruthy();

      const [apiResponse, publicResponse] = await Promise.all([
        fetch(new URL("/readyz", apiBase).href),
        fetch(new URL("/th/about", publicBase).href),
      ]);
      expect(apiResponse.ok).toBe(true);
      expect(publicResponse.ok).toBe(true);
    },
  );
});
