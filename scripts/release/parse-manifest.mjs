import { readFile } from "node:fs/promises";

import { parseDocument } from "yaml";

export async function parseManifestFile(manifestPath) {
  const source = await readFile(manifestPath, "utf8");
  const document = parseDocument(source, {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
  });

  if (document.errors.length > 0) {
    const message = document.errors[0]?.message ?? "unknown YAML error";
    throw new Error(`Invalid release manifest YAML: ${message}`);
  }

  return document.toJS({
    maxAliasCount: 0,
  });
}
