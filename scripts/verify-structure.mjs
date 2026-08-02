import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sourceExtensions = new Set([".astro", ".go", ".ts", ".tsx", ".vue"]);
const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  ".astro",
]);

function normalize(value) {
  return value.split(path.sep).join("/");
}

function walkFiles(root) {
  const files = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
        continue;
      }
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolute);
      } else if (sourceExtensions.has(path.extname(entry.name))) {
        files.push(absolute);
      }
    }
  }
  return files.sort();
}

function sourceFiles(root, relativeRoot) {
  const absoluteRoot = path.join(root, relativeRoot);
  return walkFiles(absoluteRoot).filter((file) => {
    const normalized = normalize(path.relative(root, file));
    return !normalized.includes("/generated/") && !normalized.endsWith("/generated");
  });
}

function lineCount(file) {
  return readFileSync(file, "utf8").split(/\r?\n/).length;
}

function requiredFiles(root) {
  return [
    "api/internal/modules/publishing/manifest.go",
    "api/internal/modules/media/manifest.go",
    "api/internal/modules/navigation/manifest.go",
    "api/internal/modules/discoverability/manifest.go",
    "admin/src/app/router/cms-routes.ts",
    "admin/src/app/navigation.ts",
    "admin/src/modules/publishing/views/ContentEditor.vue",
    "admin/src/modules/media/views/MediaLibraryView.vue",
    "admin/src/modules/navigation/views/MenuEditorView.vue",
    "admin/src/modules/discoverability/views/DiscoverabilityView.vue",
    "site/src/pages/[locale]/[...slug].astro",
    "site/src/pages/[locale]/preview/exchange/[code].astro",
    "site/src/pages/sitemap-index.xml.ts",
    "site/src/pages/rss/[locale].xml.ts",
  ];
}

function generatedBoundaryViolations(root) {
  const allowed = [
    "api/internal/generated/",
    "admin/src/generated/",
    "site/src/api/generated/",
  ];
  const violations = [];
  for (const component of ["api", "admin", "site"]) {
    const componentRoot = path.join(root, component);
    for (const file of walkFiles(componentRoot)) {
      const relative = normalize(path.relative(root, file));
      if (!relative.includes("generated")) {
        continue;
      }
      if (!allowed.some((prefix) => relative.startsWith(prefix))) {
        violations.push(relative);
      }
    }
  }
  return violations.sort();
}

export function collectStructure(rootDirectory = path.resolve(fileURLToPath(new URL("..", import.meta.url)))) {
  const root = path.resolve(rootDirectory);
  const components = {};
  for (const [component, relativeRoot] of Object.entries({
    api: "api/internal",
    admin: "admin/src",
    site: "site/src",
  })) {
    const files = sourceFiles(root, relativeRoot);
    const largest = files
      .map((file) => ({ path: normalize(path.relative(root, file)), lines: lineCount(file) }))
      .sort((left, right) => right.lines - left.lines || left.path.localeCompare(right.path));
    components[component] = {
      files: files.length,
      largest: largest[0] ?? null,
      routeFiles: files.filter((file) => {
        const normalized = normalize(path.relative(root, file));
        return normalized.includes("/routes/") || normalized.includes("/pages/") || normalized.includes("route");
      }).length,
      controllerFiles: files.filter((file) => normalize(file).includes("/transport/http/")).length,
    };
  }

  const missingRequiredFiles = requiredFiles(root).filter((relative) => {
    try {
      return !statSync(path.join(root, relative)).isFile();
    } catch {
      return true;
    }
  });
  const largest = Object.values(components)
    .map((component) => component.largest)
    .filter(Boolean)
    .sort((left, right) => right.lines - left.lines)[0] ?? null;

  return {
    maxLines: largest?.lines ?? 0,
    largest,
    components,
    missingRequiredFiles,
    generatedBoundaryViolations: generatedBoundaryViolations(root),
  };
}

function main() {
  const result = collectStructure();
  console.log(JSON.stringify(result, null, 2));
  if (result.missingRequiredFiles.length > 0) {
    throw new Error(`Missing required M3 files: ${result.missingRequiredFiles.join(", ")}`);
  }
  if (result.generatedBoundaryViolations.length > 0) {
    throw new Error(`Generated boundary violations: ${result.generatedBoundaryViolations.join(", ")}`);
  }
  if (result.maxLines >= 500) {
    throw new Error(`Handwritten source file exceeds 500 lines: ${result.largest.path}`);
  }
}

const entrypoint = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entrypoint === fileURLToPath(import.meta.url)) {
  main();
}
