# Implementation Plan: Production Deploy Contract

Design ref: `docs/specs/2026-08-03-production-deploy-contract-design.md`

เป้าหมายของแผนนี้คือเพิ่ม deployment contract tooling ที่ตรวจได้ใน fixture/local
environment โดยไม่แก้ `D:\infra-stack` จริงและไม่รัน production workload ระหว่าง test

## Task 1 — Test harness and safe fixtures

- **Files:** `integration/tests/deploy-contract.test.ts`
- **Change:** เพิ่ม helper สำหรับสร้าง temporary InfraStack checkout, target `.env`/Compose,
  release manifest และ fake Docker/target deploy commands; ทุก fixture อยู่ใต้ temp directory
  และ cleanup ใน `finally`
- **Verify:** test harness สร้าง/ลบ fixture ได้ และไม่แตะ `D:\infra-stack`
- **Dependency:** none

## Task 2 — Strict CLI input parser

- **Files:** `scripts/deploy/parse-inputs.mjs`, `integration/tests/deploy-contract.test.ts`
- **Change:** RED/GREEN สำหรับ required flags ทั้งห้า, absolute canonical InfraStack path,
  safe Compose project names, manifest path containment ใต้ parent `releases/` และ reject
  unknown/duplicate flags; export pure parser สำหรับ test และ CLI
- **Verify:** targeted Vitest RED แล้ว GREEN; invalid path/project/manifest cases fail closed
- **Dependency:** Task 1

## Task 3 — InfraStack checkout/pinned script validation

- **Files:** `scripts/deploy/validate-infra-checkout.mjs`, `integration/tests/deploy-contract.test.ts`
- **Change:** ตรวจ clean worktree/index, `HEAD` ตรง `infraStack.commit` ใน manifest, deploy
  script เป็น regular file mode `100755` และ SHA-256 ตรง manifest `deployScript`
- **Verify:** fixture tests cover dirty worktree, wrong revision, symlink/script mode/hash mismatch
  และ valid checkout
- **Dependency:** Tasks 1–2

## Task 4 — Target contract validator

- **Files:** `scripts/deploy/validate-target-contract.mjs`, `integration/tests/deploy-contract.test.ts`
- **Change:** parse target `.env` และ `docker compose config --format json`; enforce exact
  `DEPLOY_MIGRATE=0`, digest refs, credential-free HTTPS health URL, expected service/network,
  no build/host ports/`container_name`, numeric user, read-only, tmpfs, `cap_drop: ALL`,
  `no-new-privileges`, resource limits และ API `api-migrate`
- **Verify:** valid API/Admin/Site fixtures pass; each contract violation fails before Docker calls
- **Dependency:** Task 1

## Task 5 — Target hash/no-mutation helper

- **Files:** `scripts/deploy/hash-target-files.mjs`, `integration/tests/deploy-contract.test.ts`
- **Change:** hash exact target `.env` and Compose files with path containment; compare snapshots
  before/after and reject missing/extra target files
- **Verify:** content mutation and path traversal fixtures fail; unchanged success/failure fixtures pass
- **Dependency:** Task 1

## Task 6 — Immutable image parity verifier

- **Files:** `scripts/deploy/verify-image-parity.mjs`, `integration/tests/deploy-contract.test.ts`
- **Change:** resolve component release tag and OCI digest from manifest/registry command,
  require target runtime digest and API migration digest parity, pull exact refs, verify
  `RepoDigests`, and never log credentials
- **Verify:** tag/digest mismatch, missing digest, mutable tag-only runtime and command failure
  cases fail; valid fake registry fixture passes
- **Dependency:** Tasks 1, 4

## Task 7 — Running release verifier

- **Files:** `scripts/deploy/verify-running-release.mjs`, `integration/tests/deploy-contract.test.ts`
- **Change:** bounded HTTP polling (deadline 60s, request timeout 3s, interval 2s) and Docker
  image-ID parity for API `/readyz`, Admin/Site `/healthz`; return structured non-zero failures
- **Verify:** healthy, timeout, non-200 and image mismatch fixtures pass/fail as expected
- **Dependency:** Task 1

## Task 8 — Deployment orchestration wrapper

- **Files:** `scripts/deploy-infra-stack.sh`
- **Change:** implement exact flow: parse → checkout/target preflight → digest pull → hash →
  API migration → API deploy/verify → Admin deploy/verify → Site deploy/verify → hash compare;
  call target `scripts/deploy.sh` once per project, preserve exit codes, avoid target mutation,
  and keep secrets out of stdout/stderr
- **Verify:** shell syntax and ShellCheck pass; fake target records command order and stops on
  first failure
- **Dependency:** Tasks 2–7

## Task 9 — Contract documentation and command examples

- **Files:** `docs/operations/infra-stack.md`, `docs/contracts/release-manifest.md`
- **Change:** document wrapper invocation, required manifest/env fields, preflight gates,
  migration-first order, health/digest evidence, rollback boundary and Administrator-only
  Docker VHDX compaction note
- **Verify:** documented commands/variable names match implementation and existing templates
- **Dependency:** Task 8

## Task 10 — Integration and quality gates

- **Files:** `package.json`, `.github/workflows/contracts.yml`, `integration/tests/deploy-contract.test.ts`
- **Change:** wire deploy-contract test into local/CI contract suite without requiring real
  registry or VPS; add shell syntax check where Git Bash is available
- **Verify:** `pnpm test:integration`, `pnpm test:release`, `pnpm verify:structure`, Compose
  config checks, `bash -n`, and ShellCheck (when installed) pass
- **Dependency:** Tasks 1–9

## Parallelizable work

Tasks 2, 3, 4, 5, 6 and 7 can proceed independently after Task 1, but Task 8 must wait for
all validators. Tasks 9–10 follow the wrapper and validator behavior.

## Safety and rollback

All tests use disposable fixtures. No task writes to `D:\infra-stack`, runs a real release
manifest against a registry, changes production data, or modifies the user-owned predecessor
review document. Reverting the implementation commit removes the wrapper and validators;
existing local setup and runtime services remain unchanged.
