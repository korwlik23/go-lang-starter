import { lstat, readFile, realpath } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const dockerBinary = process.env.DOCKER_BIN ?? "docker";
const DIGEST_REF_PATTERN = /^.+@sha256:[a-f0-9]{64}$/;
const NUMERIC_USER_PATTERN = /^\d+:\d+$/;
const ENV_KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

const TARGET_PROFILES = {
  api: {
    services: ["api", "api-migrate"],
    networks: ["proxy", "backend"],
    migrationNetworks: ["backend"],
    healthPath: "/readyz",
  },
  admin: {
    services: ["admin"],
    networks: ["proxy"],
    healthPath: "/healthz",
  },
  site: {
    services: ["site"],
    networks: ["proxy"],
    healthPath: "/healthz",
  },
};

export class TargetContractValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TargetContractValidationError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new TargetContractValidationError(code, message);
}

function parseEnv(source) {
  const values = new Map();
  const lines = source.split(/\r?\n/);
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) fail("TARGET_ENV_INVALID", `Target .env line ${index + 1} is invalid`);
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!ENV_KEY_PATTERN.test(key) || values.has(key)) {
      fail("TARGET_ENV_INVALID", `Target .env key on line ${index + 1} is invalid`);
    }
    values.set(key, value);
  }
  return values;
}

function requireEnv(env, key) {
  const value = env.get(key);
  if (!value) fail("TARGET_ENV_MISSING", `Target .env is missing ${key}`);
  return value;
}

function assertDigestRef(value, field) {
  if (!DIGEST_REF_PATTERN.test(value)) {
    fail("TARGET_IMAGE_NOT_DIGEST_PINNED", `${field} must be an immutable OCI digest reference`);
  }
}

function parseHealthUrl(value, expectedPath) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("TARGET_HEALTH_URL_INVALID", "DEPLOY_HEALTH_URL must be a valid HTTPS URL");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !url.hostname ||
    url.search ||
    url.hash ||
    url.pathname !== expectedPath
  ) {
    fail("TARGET_HEALTH_URL_INVALID", "DEPLOY_HEALTH_URL must be credential-free HTTPS with the expected path");
  }
  return url.toString();
}

function normalizeNetworks(networks) {
  if (Array.isArray(networks)) return networks;
  if (networks && typeof networks === "object") return Object.keys(networks);
  return [];
}

function assertExactNames(actual, expected, code, label) {
  const actualNames = [...new Set(actual)].sort();
  const expectedNames = [...new Set(expected)].sort();
  if (
    actualNames.length !== expectedNames.length ||
    actualNames.some((name, index) => name !== expectedNames[index])
  ) {
    fail(code, `${label} do not match the approved target contract`);
  }
}

function assertHardenedService(service, serviceName, expectedImage, expectedNetworks) {
  if (!service || typeof service !== "object") fail("TARGET_SERVICE_MISSING", `Target service ${serviceName} is missing`);
  if (service.image !== expectedImage) fail("TARGET_IMAGE_MISMATCH", `Target service ${serviceName} image does not match the release digest`);
  for (const forbidden of ["build", "ports", "container_name"]) {
    if (service[forbidden] !== undefined && (!Array.isArray(service[forbidden]) || service[forbidden].length > 0)) {
      fail("TARGET_SERVICE_UNSAFE", `Target service ${serviceName} contains a forbidden ${forbidden} setting`);
    }
  }
  if (service.pull_policy === "build") fail("TARGET_SERVICE_UNSAFE", `Target service ${serviceName} cannot use build pull policy`);
  if (!NUMERIC_USER_PATTERN.test(String(service.user ?? ""))) fail("TARGET_SERVICE_UNSAFE", `Target service ${serviceName} must use a numeric user`);
  if (service.read_only !== true) fail("TARGET_SERVICE_UNSAFE", `Target service ${serviceName} must be read-only`);
  if (!Array.isArray(service.tmpfs) || service.tmpfs.length === 0) fail("TARGET_SERVICE_UNSAFE", `Target service ${serviceName} must define tmpfs`);
  if (!Array.isArray(service.cap_drop) || !service.cap_drop.includes("ALL")) fail("TARGET_SERVICE_UNSAFE", `Target service ${serviceName} must drop all capabilities`);
  if (!Array.isArray(service.security_opt) || !service.security_opt.includes("no-new-privileges:true")) fail("TARGET_SERVICE_UNSAFE", `Target service ${serviceName} must enable no-new-privileges`);
  const limits = service.deploy?.resources?.limits;
  if (!limits || !limits.cpus || !limits.memory) fail("TARGET_SERVICE_UNSAFE", `Target service ${serviceName} must define CPU and memory limits`);
  assertExactNames(normalizeNetworks(service.networks), expectedNetworks, "TARGET_NETWORK_INVALID", `Target service ${serviceName} networks`);
}

async function defaultRenderCompose({ targetDirectory, envFilePath, composeFilePath }) {
  try {
    const { stdout } = await execFile(
      dockerBinary,
      [
        "compose",
        "--project-directory",
        targetDirectory,
        "--env-file",
        envFilePath,
        "--file",
        composeFilePath,
        "config",
        "--format",
        "json",
      ],
      { cwd: targetDirectory, encoding: "utf8", windowsHide: true },
    );
    return JSON.parse(stdout);
  } catch {
    fail("TARGET_COMPOSE_INVALID", "Docker Compose config could not be rendered");
  }
}

export async function validateTargetContract({
  targetDirectory,
  service,
  expectedImage,
  expectedMigrationImage = expectedImage,
  expectedTag,
  expectedHealthUrl,
  renderCompose = defaultRenderCompose,
  envFileName = ".env",
  composeFileName = "docker-compose.yml",
}) {
  const profile = TARGET_PROFILES[service];
  if (!profile) fail("TARGET_SERVICE_INVALID", `Unsupported target service ${service}`);
  assertDigestRef(expectedImage, "Release image");
  if (service === "api") assertDigestRef(expectedMigrationImage, "Release migration image");

  const envFilePath = path.resolve(targetDirectory, envFileName);
  const composeFilePath = path.resolve(targetDirectory, composeFileName);
  const canonicalTarget = await realpath(targetDirectory).catch(() => null);
  if (!canonicalTarget || canonicalTarget !== path.resolve(targetDirectory)) {
    fail("TARGET_DIRECTORY_PATH_INVALID", "Target project directory must be canonical");
  }
  const sourceGitPath = path.resolve(targetDirectory, "src", ".git");
  if (await lstat(sourceGitPath).then(() => true, () => false)) {
    fail("TARGET_SOURCE_CHECKOUT_PRESENT", "Registry-only target must not contain src/.git");
  }
  let env;
  try {
    env = parseEnv(await readFile(envFilePath, "utf8"));
  } catch (error) {
    if (error instanceof TargetContractValidationError) throw error;
    fail("TARGET_ENV_UNREADABLE", "Target .env could not be read");
  }

  const runtimeImage = requireEnv(env, "APP_IMAGE_DIGEST_REF");
  assertDigestRef(runtimeImage, "APP_IMAGE_DIGEST_REF");
  if (runtimeImage !== expectedImage) fail("TARGET_IMAGE_MISMATCH", "APP_IMAGE_DIGEST_REF does not match the release digest");
  if (expectedTag) {
    const repository = expectedImage.slice(0, expectedImage.indexOf("@"));
    if (requireEnv(env, "APP_IMAGE") !== `${repository}:${expectedTag}`) fail("TARGET_TAG_MISMATCH", "APP_IMAGE does not match the release component tag");
  }
  if (requireEnv(env, "DEPLOY_MIGRATE") !== "0") fail("TARGET_MIGRATION_FLAG_INVALID", "DEPLOY_MIGRATE must be exactly 0");
  if (requireEnv(env, "ROLLOUT_SERVICE") !== service) fail("TARGET_ROLLOUT_SERVICE_INVALID", "ROLLOUT_SERVICE does not match the target service");
  const migrationImage = service === "api" ? requireEnv(env, "MIGRATE_IMAGE") : undefined;
  if (migrationImage) {
    assertDigestRef(migrationImage, "MIGRATE_IMAGE");
    if (migrationImage !== expectedMigrationImage) fail("TARGET_MIGRATION_IMAGE_MISMATCH", "MIGRATE_IMAGE does not match the release migration digest");
  }
  const healthUrl = parseHealthUrl(requireEnv(env, "DEPLOY_HEALTH_URL"), profile.healthPath);
  if (expectedHealthUrl && healthUrl !== parseHealthUrl(expectedHealthUrl, profile.healthPath)) fail("TARGET_HEALTH_URL_MISMATCH", "DEPLOY_HEALTH_URL does not match the release contract");

  let compose;
  try {
    compose = await renderCompose({ targetDirectory, envFilePath, composeFilePath });
  } catch (error) {
    if (error instanceof TargetContractValidationError) throw error;
    fail("TARGET_COMPOSE_INVALID", "Docker Compose config could not be rendered");
  }
  if (!compose || typeof compose !== "object" || !compose.services) fail("TARGET_COMPOSE_INVALID", "Rendered Docker Compose config has no services");
  assertExactNames(Object.keys(compose.services), profile.services, "TARGET_SERVICE_SET_INVALID", "Target services");
  for (const serviceName of profile.services) {
    const networks = serviceName === "api-migrate" ? profile.migrationNetworks : profile.networks;
    const image = serviceName === "api-migrate" ? expectedMigrationImage : expectedImage;
    assertHardenedService(compose.services[serviceName], serviceName, image, networks);
  }
  if (!compose.networks || typeof compose.networks !== "object") fail("TARGET_NETWORK_INVALID", "Target networks are missing");
  assertExactNames(Object.keys(compose.networks), profile.networks, "TARGET_NETWORK_INVALID", "Target networks");
  for (const networkName of profile.networks) {
    const network = compose.networks[networkName];
    if (!network || network.external !== true) fail("TARGET_NETWORK_INVALID", `Target network ${networkName} must be external`);
    if (networkName === "backend" && network.name !== "backend") fail("TARGET_NETWORK_INVALID", "Target backend network must be named backend");
  }

  return {
    service,
    image: runtimeImage,
    ...(service === "api" ? { migrationImage } : {}),
    healthUrl,
    files: { envFilePath, composeFilePath },
  };
}
