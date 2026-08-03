import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FLAGS = [
  "--infra-stack-dir",
  "--release-manifest",
  "--api-project",
  "--admin-project",
  "--site-project",
];

const PROJECT_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,62}$/;

function usageError(message) {
  return new Error(`deploy inputs: ${message}`);
}

function parseFlagValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw usageError(`${flag} requires a value`);
  }
  return value;
}

function validateProjectName(flag, value) {
  if (!PROJECT_NAME_PATTERN.test(value)) {
    throw usageError(
      `${flag} must match ${PROJECT_NAME_PATTERN.source}`,
    );
  }
}

function assertCanonicalAbsolutePath(flag, value) {
  if (!isAbsolute(value)) throw usageError(`${flag} must be absolute`);
  const lexicalSegments = value.split(/[\\/]/);
  if (lexicalSegments.some((segment) => segment === "." || segment === "..")) {
    throw usageError(`${flag} must be canonical`);
  }
  const normalizedInput = value.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
  const normalizedResolved = resolve(value).replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
  if (normalizedInput !== normalizedResolved) throw usageError(`${flag} must be canonical`);
}

export function parseDeployInputs(argv, cwd = process.cwd()) {
  if (!Array.isArray(argv)) {
    throw usageError("arguments must be an array");
  }

  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!REQUIRED_FLAGS.includes(flag)) {
      throw usageError(`unknown flag ${flag}`);
    }
    if (values.has(flag)) {
      throw usageError(`duplicate flag ${flag}`);
    }
    values.set(flag, parseFlagValue(argv, index, flag));
    index += 1;
  }

  const missing = REQUIRED_FLAGS.filter((flag) => !values.has(flag));
  if (missing.length > 0) {
    throw usageError(`missing required flag ${missing[0]}`);
  }

  const infraStackDir = values.get("--infra-stack-dir");
  assertCanonicalAbsolutePath("--infra-stack-dir", infraStackDir);

  const projectFlags = [
    "--api-project",
    "--admin-project",
    "--site-project",
  ];
  const projects = projectFlags.map((flag) => values.get(flag));
  projectFlags.forEach((flag, index) => validateProjectName(flag, projects[index]));
  if (new Set(projects).size !== projects.length) {
    throw usageError("project names must be unique");
  }

  const releaseManifest = resolve(cwd, values.get("--release-manifest"));
  const releasesRoot = resolve(cwd, "releases");
  const manifestRelativePath = relative(releasesRoot, releaseManifest);
  if (
    !manifestRelativePath ||
    manifestRelativePath === ".." ||
    manifestRelativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
    isAbsolute(manifestRelativePath)
  ) {
    throw usageError("--release-manifest must be inside releases/");
  }

  return {
    infraStackDir: resolve(infraStackDir),
    releaseManifest,
    apiProject: values.get("--api-project"),
    adminProject: values.get("--admin-project"),
    siteProject: values.get("--site-project"),
  };
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${JSON.stringify(parseDeployInputs(process.argv.slice(2)))}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
