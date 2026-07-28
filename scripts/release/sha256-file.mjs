import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";

export async function sha256File(filePath) {
  const hash = createHash("sha256");

  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}
