#!/usr/bin/env bash
set -euo pipefail

# Contract-first suite deployment. This wrapper never edits, checks out, commits,
# pulls, or writes files under the supplied InfraStack checkout.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="${NODE_BIN:-node}"
DOCKER_BIN="${DOCKER_BIN:-docker}"
cd "$ROOT_DIR"

if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  echo "deploy contract: node is required" >&2
  exit 2
fi

json_field() {
  "$NODE_BIN" -e '
    const value = JSON.parse(process.argv[1])[process.argv[2]];
    if (typeof value !== "string") process.exit(1);
    process.stdout.write(value);
  ' "$1" "$2"
}

manifest_component() {
  "$NODE_BIN" --input-type=module - "$1" "$2" <<'NODE'
import { parseManifestFile } from "./scripts/release/parse-manifest.mjs";

try {
  const [manifestPath, component] = process.argv.slice(2);
  const manifest = await parseManifestFile(manifestPath);
  const release = manifest.components?.[component];
  if (!release) throw new Error("component is missing from release manifest");
  process.stdout.write(`${JSON.stringify(release)}\n`);
} catch (error) {
  process.stderr.write(`${error.code ?? "DEPLOY_MANIFEST_INVALID"}: ${error.message}\n`);
  process.exitCode = 1;
}
NODE
}

validate_release_manifest() {
  "$NODE_BIN" --input-type=module - "$1" <<'NODE'
import { parseManifestFile } from "./scripts/release/parse-manifest.mjs";
import { validateManifest } from "./scripts/release/validate-manifest.mjs";

try {
  const [manifestPath] = process.argv.slice(2);
  const manifest = await parseManifestFile(manifestPath);
  const validation = await validateManifest(manifest);
  if (!validation.valid) throw new Error("release manifest does not match the approved schema");
} catch (error) {
  process.stderr.write(`${error.code ?? "DEPLOY_MANIFEST_INVALID"}: ${error.message}\n`);
  process.exitCode = 1;
}
NODE
}

manifest_infra_deploy_script() {
  "$NODE_BIN" --input-type=module - "$1" <<'NODE'
import { parseManifestFile } from "./scripts/release/parse-manifest.mjs";

try {
  const [manifestPath] = process.argv.slice(2);
  const manifest = await parseManifestFile(manifestPath);
  const scriptPath = manifest.infraStack?.deployScript?.path;
  if (typeof scriptPath !== "string") throw new Error("InfraStack deploy script is missing");
  process.stdout.write(scriptPath);
} catch (error) {
  process.stderr.write(`${error.code ?? "DEPLOY_MANIFEST_INVALID"}: ${error.message}\n`);
  process.exitCode = 1;
}
NODE
}

validate_infra_checkout() {
  "$NODE_BIN" --input-type=module - "$1" "$2" <<'NODE'
import { parseManifestFile } from "./scripts/release/parse-manifest.mjs";
import { validateInfraCheckout } from "./scripts/deploy/validate-infra-checkout.mjs";

try {
  const [infraStackDir, manifestPath] = process.argv.slice(2);
  const manifest = await parseManifestFile(manifestPath);
  const result = await validateInfraCheckout({ infraStackDir, manifest });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error.code ?? "DEPLOY_INFRA_CHECKOUT_INVALID"}: ${error.message}\n`);
  process.exitCode = 1;
}
NODE
}

validate_target_contract() {
  "$NODE_BIN" --input-type=module - "$1" "$2" "$3" "$4" "$5" "$6" <<'NODE'
import { validateTargetContract } from "./scripts/deploy/validate-target-contract.mjs";

try {
  const [targetDirectory, service, expectedImage, expectedMigrationImage, expectedHealthUrl, expectedTag] = process.argv.slice(2);
  const result = await validateTargetContract({
    targetDirectory,
    service,
    expectedImage,
    ...(expectedMigrationImage ? { expectedMigrationImage } : {}),
    ...(expectedHealthUrl ? { expectedHealthUrl } : {}),
    ...(expectedTag ? { expectedTag } : {}),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error.code ?? "DEPLOY_TARGET_CONTRACT_INVALID"}: ${error.message}\n`);
  process.exitCode = 1;
}
NODE
}

verify_image_parity() {
  "$NODE_BIN" --input-type=module - "$1" "$2" "$3" "$4" "$5" <<'NODE'
import { parseManifestFile } from "./scripts/release/parse-manifest.mjs";
import { verifyImageParity } from "./scripts/deploy/verify-image-parity.mjs";

try {
  const [manifestPath, component, targetImage, migrationImage, expectedTag] = process.argv.slice(2);
  const manifest = await parseManifestFile(manifestPath);
  const componentRelease = manifest.components?.[component];
  if (!componentRelease || componentRelease.tag !== expectedTag) throw new Error("component release tag is inconsistent");
  const result = await verifyImageParity({
    component,
    componentRelease,
    targetImage,
    ...(migrationImage ? { migrationImage } : {}),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error.code ?? "DEPLOY_IMAGE_PARITY_INVALID"}: ${error.message}\n`);
  process.exitCode = 1;
}
NODE
}

verify_running_release() {
  "$NODE_BIN" --input-type=module - "$1" "$2" "$3" "$4" <<'NODE'
import { verifyRunningRelease } from "./scripts/deploy/verify-running-release.mjs";

try {
  const [service, projectName, healthUrl, expectedImage] = process.argv.slice(2);
  const result = await verifyRunningRelease({ service, projectName, healthUrl, expectedImage });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error.code ?? "DEPLOY_RUNNING_RELEASE_INVALID"}: ${error.message}\n`);
  process.exitCode = 1;
}
NODE
}

hash_target_files() {
  "$NODE_BIN" --input-type=module - "$1" <<'NODE'
import { hashTargetFiles } from "./scripts/deploy/hash-target-files.mjs";

try {
  const [targetDirectory] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(await hashTargetFiles({ targetDirectory }))}\n`);
} catch (error) {
  process.stderr.write(`${error.code ?? "DEPLOY_TARGET_HASH_INVALID"}: ${error.message}\n`);
  process.exitCode = 1;
}
NODE
}

compare_target_hashes() {
  "$NODE_BIN" --input-type=module - "$1" "$2" <<'NODE'
import { readFile } from "node:fs/promises";
import { compareTargetFileHashes } from "./scripts/deploy/hash-target-files.mjs";

try {
  const [beforePath, afterPath] = process.argv.slice(2);
  const before = JSON.parse(await readFile(beforePath, "utf8"));
  const after = JSON.parse(await readFile(afterPath, "utf8"));
  compareTargetFileHashes(before, after);
} catch (error) {
  process.stderr.write(`${error.code ?? "DEPLOY_TARGET_HASH_INVALID"}: ${error.message}\n`);
  process.exitCode = 1;
}
NODE
}

parsed_json="$("$NODE_BIN" "$ROOT_DIR/scripts/deploy/parse-inputs.mjs" "$@")"
infra_stack_dir="$(json_field "$parsed_json" infraStackDir)"
release_manifest="$(json_field "$parsed_json" releaseManifest)"
api_project="$(json_field "$parsed_json" apiProject)"
admin_project="$(json_field "$parsed_json" adminProject)"
site_project="$(json_field "$parsed_json" siteProject)"

validate_release_manifest "$release_manifest"

api_target="$infra_stack_dir/projects/$api_project"
admin_target="$infra_stack_dir/projects/$admin_project"
site_target="$infra_stack_dir/projects/$site_project"

echo "[deploy-contract] validating pinned InfraStack checkout"
validate_infra_checkout "$infra_stack_dir" "$release_manifest" >/dev/null
deploy_script_rel="$(manifest_infra_deploy_script "$release_manifest")"
deploy_script="$infra_stack_dir/$deploy_script_rel"

api_release="$(manifest_component "$release_manifest" api)"
admin_release="$(manifest_component "$release_manifest" admin)"
site_release="$(manifest_component "$release_manifest" site)"

api_image="$(json_field "$api_release" image)"
api_tag="$(json_field "$api_release" tag)"
admin_image="$(json_field "$admin_release" image)"
admin_tag="$(json_field "$admin_release" tag)"
site_image="$(json_field "$site_release" image)"
site_tag="$(json_field "$site_release" tag)"

echo "[deploy-contract] validating target contracts and immutable image parity"
api_target_result="$(validate_target_contract "$api_target" api "$api_image" "$api_image" "" "$api_tag")"
admin_target_result="$(validate_target_contract "$admin_target" admin "$admin_image" "" "" "$admin_tag")"
site_target_result="$(validate_target_contract "$site_target" site "$site_image" "" "" "$site_tag")"

api_target_image="$(json_field "$api_target_result" image)"
api_migration_image="$(json_field "$api_target_result" migrationImage)"
api_health_url="$(json_field "$api_target_result" healthUrl)"
admin_target_image="$(json_field "$admin_target_result" image)"
admin_health_url="$(json_field "$admin_target_result" healthUrl)"
site_target_image="$(json_field "$site_target_result" image)"
site_health_url="$(json_field "$site_target_result" healthUrl)"

verify_image_parity "$release_manifest" api "$api_target_image" "$api_migration_image" "$api_tag" >/dev/null
verify_image_parity "$release_manifest" admin "$admin_target_image" "" "$admin_tag" >/dev/null
verify_image_parity "$release_manifest" site "$site_target_image" "" "$site_tag" >/dev/null

snapshot_dir="$(mktemp -d "${TMPDIR:-/tmp}/go-lang-starter-deploy.XXXXXX")"
cleanup_deploy() {
  local exit_code=$?
  if [ "$exit_code" -ne 0 ]; then
    set +e
    hash_target_files "$api_target" >"$snapshot_dir/api.failure.json"
    hash_target_files "$admin_target" >"$snapshot_dir/admin.failure.json"
    hash_target_files "$site_target" >"$snapshot_dir/site.failure.json"
    compare_target_hashes "$snapshot_dir/api.before.json" "$snapshot_dir/api.failure.json" || echo "[deploy-contract] API target files changed after failure" >&2
    compare_target_hashes "$snapshot_dir/admin.before.json" "$snapshot_dir/admin.failure.json" || echo "[deploy-contract] Admin target files changed after failure" >&2
    compare_target_hashes "$snapshot_dir/site.before.json" "$snapshot_dir/site.failure.json" || echo "[deploy-contract] Site target files changed after failure" >&2
  fi
  rm -rf -- "$snapshot_dir"
  exit "$exit_code"
}
trap cleanup_deploy EXIT
hash_target_files "$api_target" >"$snapshot_dir/api.before.json"
hash_target_files "$admin_target" >"$snapshot_dir/admin.before.json"
hash_target_files "$site_target" >"$snapshot_dir/site.before.json"

if [ ! -x "$deploy_script" ]; then
  echo "deploy contract: pinned InfraStack deploy script is not executable" >&2
  exit 1
fi

echo "[deploy-contract] running API migration before service rollout"
"$DOCKER_BIN" compose \
  --project-name "$api_project" \
  --project-directory "$api_target" \
  --env-file "$api_target/.env" \
  --file "$api_target/docker-compose.yml" \
  run --rm --no-deps api-migrate

echo "[deploy-contract] deploying API"
"$deploy_script" "$api_project"
verify_running_release api "$api_project" "$api_health_url" "$api_image" >/dev/null

echo "[deploy-contract] deploying Admin"
"$deploy_script" "$admin_project"
verify_running_release admin "$admin_project" "$admin_health_url" "$admin_image" >/dev/null

echo "[deploy-contract] deploying Site"
"$deploy_script" "$site_project"
verify_running_release site "$site_project" "$site_health_url" "$site_image" >/dev/null

hash_target_files "$api_target" >"$snapshot_dir/api.after.json"
hash_target_files "$admin_target" >"$snapshot_dir/admin.after.json"
hash_target_files "$site_target" >"$snapshot_dir/site.after.json"
compare_target_hashes "$snapshot_dir/api.before.json" "$snapshot_dir/api.after.json"
compare_target_hashes "$snapshot_dir/admin.before.json" "$snapshot_dir/admin.after.json"
compare_target_hashes "$snapshot_dir/site.before.json" "$snapshot_dir/site.after.json"

echo "[deploy-contract] deployment completed with health, digest, and no-mutation evidence"
