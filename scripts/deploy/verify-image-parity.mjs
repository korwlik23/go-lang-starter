import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const dockerBinary = process.env.DOCKER_BIN ?? "docker";
const IMAGE_REF_PATTERN = /^(.+)@(sha256:[a-f0-9]{64})$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;

export class ImageParityVerificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ImageParityVerificationError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new ImageParityVerificationError(code, message);
}

async function defaultRunDocker(args) {
  try {
    const result = await execFile(dockerBinary, args, {
      encoding: "utf8",
      windowsHide: true,
    });
    return result.stdout;
  } catch {
    throw new ImageParityVerificationError(
      "IMAGE_DOCKER_COMMAND_FAILED",
      "Docker image verification command failed",
    );
  }
}

function parseDigestOutput(output) {
  const text = String(output ?? "").trim();
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "string" && DIGEST_PATTERN.test(parsed)) return parsed;
  } catch {
    // Some Docker versions return the digest without JSON quoting.
  }
  const match = /sha256:[a-f0-9]{64}/.exec(text);
  if (!match) fail("IMAGE_REGISTRY_DIGEST_MISSING", "Registry did not return an OCI digest");
  return match[0];
}

function parseRepoDigests(output) {
  let parsed;
  try {
    parsed = JSON.parse(String(output ?? "").trim());
  } catch {
    fail("IMAGE_REPO_DIGESTS_INVALID", "Docker did not return valid RepoDigests");
  }
  if (Array.isArray(parsed)) {
    if (parsed.every((item) => typeof item === "string")) return parsed;
    const nested = parsed.flatMap((item) =>
      item && typeof item === "object" && Array.isArray(item.RepoDigests)
        ? item.RepoDigests
        : [],
    );
    if (nested.length > 0) return nested;
  }
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.RepoDigests)) return parsed.RepoDigests;
  fail("IMAGE_REPO_DIGESTS_INVALID", "Docker did not return valid RepoDigests");
}

export async function verifyImageParity({
  component,
  componentRelease,
  targetImage,
  migrationImage,
  runDocker = defaultRunDocker,
}) {
  const manifestImage = componentRelease?.image;
  const imageMatch = IMAGE_REF_PATTERN.exec(manifestImage ?? "");
  if (!imageMatch || !componentRelease?.tag || componentRelease.tag.includes("@")) {
    fail("IMAGE_MANIFEST_INVALID", `Release image for ${component} is not a digest reference`);
  }
  if (!IMAGE_REF_PATTERN.test(targetImage ?? "")) fail("IMAGE_TARGET_NOT_IMMUTABLE", `Target ${component} image is not digest-pinned`);
  if (component === "api" && !IMAGE_REF_PATTERN.test(migrationImage ?? "")) fail("IMAGE_MIGRATION_NOT_IMMUTABLE", "API migration image is not digest-pinned");
  if (targetImage !== manifestImage) fail("IMAGE_TARGET_MISMATCH", `Target ${component} image does not match the release manifest`);
  if (component === "api" && migrationImage !== manifestImage) fail("IMAGE_MIGRATION_MISMATCH", "API migration image does not match the runtime release image");

  const [, repository, expectedDigest] = imageMatch;
  const tagRef = `${repository}:${componentRelease.tag}`;
  let registryDigest;
  try {
    registryDigest = parseDigestOutput(await runDocker([
      "buildx",
      "imagetools",
      "inspect",
      tagRef,
      "--format",
      "{{json .Manifest.Digest}}",
    ]));
  } catch (error) {
    if (error instanceof ImageParityVerificationError) throw error;
    fail("IMAGE_REGISTRY_COMMAND_FAILED", "Registry digest lookup failed");
  }
  if (registryDigest !== expectedDigest) fail("IMAGE_REGISTRY_DIGEST_MISMATCH", `Registry digest for ${component} tag does not match the release manifest`);

  try {
    await runDocker(["pull", manifestImage]);
    const repoDigests = parseRepoDigests(await runDocker([
      "image",
      "inspect",
      manifestImage,
      "--format",
      "{{json .RepoDigests}}",
    ]));
    if (!repoDigests.includes(manifestImage)) fail("IMAGE_REPO_DIGEST_MISMATCH", `Local ${component} image RepoDigests do not match the release digest`);
  } catch (error) {
    if (error instanceof ImageParityVerificationError) throw error;
    fail("IMAGE_PULL_OR_INSPECT_FAILED", `Docker could not verify the ${component} image`);
  }

  return {
    component,
    tagRef,
    image: manifestImage,
    digest: expectedDigest,
    ...(component === "api" ? { migrationImage: manifestImage } : {}),
  };
}
