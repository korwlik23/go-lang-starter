import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const dockerBinary = process.env.DOCKER_BIN ?? "docker";

export class RunningReleaseVerificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RunningReleaseVerificationError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new RunningReleaseVerificationError(code, message);
}

async function defaultRunDocker(args) {
  try {
    const result = await execFile(dockerBinary, args, {
      encoding: "utf8",
      windowsHide: true,
    });
    return result.stdout;
  } catch {
    fail("RUNNING_DOCKER_COMMAND_FAILED", "Docker running-release verification command failed");
  }
}

async function defaultRequestHealth(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
    });
    return { status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}

const defaultSleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function requireOutput(output, code, message) {
  const value = String(output ?? "").trim();
  if (!value) fail(code, message);
  return value.split(/\r?\n/)[0].trim();
}

export async function verifyRunningRelease({
  service,
  projectName,
  healthUrl,
  expectedImage,
  requestHealth = defaultRequestHealth,
  runDocker = defaultRunDocker,
  sleep = defaultSleep,
  now = () => Date.now(),
  deadlineMs = 60_000,
  requestTimeoutMs = 3_000,
  intervalMs = 2_000,
}) {
  if (!service || !projectName || !expectedImage) fail("RUNNING_INPUT_INVALID", "Running release verification requires service, project, and image");
  let parsedHealthUrl;
  try {
    parsedHealthUrl = new URL(healthUrl);
  } catch {
    fail("RUNNING_HEALTH_URL_INVALID", "Running release health URL is invalid");
  }
  if (parsedHealthUrl.protocol !== "https:" || parsedHealthUrl.username || parsedHealthUrl.password) {
    fail("RUNNING_HEALTH_URL_INVALID", "Running release health URL must be credential-free HTTPS");
  }
  if (deadlineMs <= 0 || requestTimeoutMs <= 0 || intervalMs < 0) fail("RUNNING_TIMEOUT_CONFIG_INVALID", "Running release timeout values are invalid");

  const deadline = now() + deadlineMs;
  let healthStatus;
  while (now() <= deadline) {
    let response;
    try {
      response = await requestHealth(parsedHealthUrl.toString(), requestTimeoutMs);
    } catch {
      response = null;
    }
    if (response?.status !== undefined) {
      if (response.status !== 200) fail("RUNNING_HEALTH_NON_200", `Running ${service} health endpoint did not return HTTP 200`);
      healthStatus = response.status;
      break;
    }
    if (now() >= deadline) break;
    await sleep(Math.min(intervalMs, Math.max(0, deadline - now())));
  }
  if (healthStatus !== 200) fail("RUNNING_HEALTH_TIMEOUT", `Running ${service} health endpoint did not become ready before the deadline`);

  let expectedImageId;
  let containerId;
  let runningImageId;
  try {
    expectedImageId = requireOutput(
      await runDocker(["image", "inspect", expectedImage, "--format", "{{.Id}}"]),
      "RUNNING_EXPECTED_IMAGE_MISSING",
      "Expected local image ID is missing",
    );
    containerId = requireOutput(
      await runDocker(["compose", "--project-name", projectName, "ps", "--quiet", service]),
      "RUNNING_CONTAINER_MISSING",
      `Running ${service} container was not found`,
    );
    runningImageId = requireOutput(
      await runDocker(["inspect", containerId, "--format", "{{.Image}}"]),
      "RUNNING_IMAGE_ID_MISSING",
      `Running ${service} image ID is missing`,
    );
  } catch (error) {
    if (error instanceof RunningReleaseVerificationError) throw error;
    fail("RUNNING_DOCKER_COMMAND_FAILED", `Docker could not inspect running ${service}`);
  }
  if (runningImageId !== expectedImageId) fail("RUNNING_IMAGE_ID_MISMATCH", `Running ${service} image ID does not match the release image ID`);

  return {
    service,
    projectName,
    containerId,
    imageId: runningImageId,
    healthStatus,
  };
}
