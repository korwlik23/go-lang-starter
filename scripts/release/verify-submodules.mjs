import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const componentPaths = new Set(["admin", "api", "site"]);

export class SubmoduleVerificationError extends Error {
  constructor(code, component, message) {
    super(message);
    this.name = "SubmoduleVerificationError";
    this.code = code;
    this.component = component;
  }
}

async function runGit(rootDirectory, args, component) {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", rootDirectory, ...args],
      {
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      },
    );

    return stdout.trim();
  } catch {
    throw new SubmoduleVerificationError(
      "GIT_INSPECTION_FAILED",
      component,
      `Unable to inspect Git state for ${component}`,
    );
  }
}

export async function inspectGitComponent({
  component,
  path: componentPath,
  rootDirectory,
}) {
  const stageOutput = await runGit(
    rootDirectory,
    ["ls-files", "--stage", "--", componentPath],
    component,
  );
  const stageMatch = stageOutput.match(
    /^160000 ([0-9a-f]{40}) 0\t([^\r\n]+)$/,
  );

  if (!stageMatch || stageMatch[2] !== componentPath) {
    throw new SubmoduleVerificationError(
      "SUBMODULE_NOT_REGISTERED",
      component,
      `Expected a parent gitlink for ${component}`,
    );
  }

  const childDirectory = path.resolve(rootDirectory, componentPath);
  const headCommit = await runGit(
    childDirectory,
    ["rev-parse", "HEAD"],
    component,
  );
  const tagsOutput = await runGit(
    childDirectory,
    ["tag", "--points-at", "HEAD"],
    component,
  );

  return {
    exactTags: tagsOutput === "" ? [] : tagsOutput.split(/\r?\n/).sort(),
    gitlinkCommit: stageMatch[1],
    headCommit,
  };
}

export async function verifySubmodulePins({
  components,
  inspectComponent = inspectGitComponent,
  releaseMode = false,
  rootDirectory,
}) {
  const results = [];

  for (const [component, pin] of Object.entries(components).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (!componentPaths.has(component) || pin.path !== component) {
      throw new SubmoduleVerificationError(
        "INVALID_COMPONENT_PATH",
        component,
        `Component path does not match its manifest key: ${component}`,
      );
    }

    const inspection = await inspectComponent({
      component,
      path: pin.path,
      rootDirectory,
    });

    if (inspection.gitlinkCommit !== pin.commit) {
      throw new SubmoduleVerificationError(
        "GITLINK_MISMATCH",
        component,
        `Parent gitlink does not match manifest commit for ${component}`,
      );
    }

    if (inspection.headCommit !== pin.commit) {
      throw new SubmoduleVerificationError(
        "HEAD_MISMATCH",
        component,
        `Checked-out HEAD does not match manifest commit for ${component}`,
      );
    }

    if (releaseMode && !inspection.exactTags.includes(pin.tag)) {
      throw new SubmoduleVerificationError(
        "TAG_MISMATCH",
        component,
        `Exact release tag does not point at HEAD for ${component}`,
      );
    }

    results.push({
      component,
      exactTags: inspection.exactTags,
      gitlinkCommit: inspection.gitlinkCommit,
      headCommit: inspection.headCommit,
    });
  }

  return results;
}
