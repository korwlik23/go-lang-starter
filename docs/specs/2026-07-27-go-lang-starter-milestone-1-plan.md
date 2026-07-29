# Implementation Plan: `go-lang-starter` Milestone 1 — Foundation

- สถานะ: อนุมัติแล้ว; Gate 0 ผ่านและเริ่ม Phase R repository foundation แล้ว
- วันที่: 2026-07-27
- Design ref: `D:\go-lang-starter\docs\specs\2026-07-27-go-lang-starter-design.md`
- Master plan:
  `D:\go-lang-starter\docs\specs\2026-07-27-go-lang-starter-implementation-plan.md`

## Approved Outcome

สร้าง repository topology, contract/release foundation, API security/data foundation,
Admin shell และ Public Site runtime foundation ให้ boot และตรวจสอบได้จริง โดย critical
flow ต้องพิสูจน์ pre-auth CSRF → login/MFA → authenticated session, permission
default-deny/account scope และ multi-language runtime ทั้ง PostgreSQL กับ
MariaDB/XAMPP ส่วน Oracle MySQL ต้องรายงานตาม test evidence จริง

## Task Protocol

สัญลักษณ์:

- `[S]` ต้องทำตามลำดับ
- `[P-x]` ทำขนานกับ lane อื่นที่ไม่แก้ไฟล์เดียวกันได้
- `[CFG]` pure config/scaffold exception
- `[GEN]` generated artifact exception
- `[TDD]` behavior task

ทุกแถว `[TDD]` ใน behavior matrix คือ 3 microtasks แยกกัน:

1. `<ID>-R` — แก้เฉพาะ test file, รันคำสั่งและเห็น expected RED
2. `<ID>-G` — แก้เฉพาะ implementation file ขั้นต่ำ, รัน targeted test ให้ GREEN
3. `<ID>-F` — `gofmt`/format/refactor โดยไม่เพิ่ม behavior แล้วรัน package suite

แต่ละ microtask ตั้งเป้า 2–5 นาที ห้ามเขียน `<ID>-G` ก่อนเห็น `<ID>-R` fail ด้วยเหตุผล
ที่ถูกต้อง หาก test fail เพราะ syntax, import หรือ environment ให้แก้ test harness ก่อน
และยังไม่นับเป็น RED

หากช่อง Behavior มีหลาย assertion คั่นด้วย semicolon ให้ทำ RED/GREEN/REFACTOR แยก
ทีละ assertion ไม่รวมเป็น test หรือ implementation task เดียว

แถว `[QA]` เป็น cross-layer regression test หลัง behavior มี unit/contract TDD แล้ว:
เพิ่มทีละ assertion, รัน targeted test และห้ามแก้ production ใน task เดียวกัน หาก fail
ให้หยุดและเข้า rigid debugging gate เพื่อหา root cause และเพิ่ม failing regression test
ใน owning package ก่อนแก้

Executable command convention:

- Go test function ต้องใช้ชื่อ `Test<ID>` โดยแทนจุดใน ID ด้วย `_`; ตัวอย่าง I1 ใช้
  `TestI1` และ D0.2 ใช้ `TestD0_2`
- Go RED/GREEN command ใช้ exact directory ของ test file หลังตัด prefix `api/`:
  ตัวอย่าง I1 คือ
  `cd api; go test ./internal/modules/identity/domain -run '^TestI1$' -count=1`
  และ Q9 คือ
  `cd api; go test ./internal/modules/authorization/application -run '^TestQ9$' -count=1`;
  หลัง GREEN รัน command เดิมด้วย `-race`
- Admin Vitest title ต้องเป็น exact ID; command จาก `D:\go-lang-starter\admin` คือ
  `pnpm vitest run <test-file-without-admin-prefix> -t '^<ID>$'`; ID ที่มีจุดต้อง
  escape จุดใน regex เช่น `C2\.2`
- Site Vitest title ใช้กติกาเดียวกันจาก `D:\go-lang-starter\site`
- Parent Vitest title ใช้กติกาเดียวกันจาก `D:\go-lang-starter`
- `[QA]` browser command คือ
  `pnpm playwright test <exact-test-file> --grep '^<ID>$'`
- “secret scan” หมายถึง
  `gitleaks dir --redact <exact-directory>`
- “workflow lint” หมายถึง `actionlint <exact-workflow-file>`
- “shell lint” หมายถึง `shellcheck <exact-shell-file>` และ Bash syntax check คือ
  `& $env:BASH_PATH -n <exact-shell-file>` บน PowerShell หรือ
  `"$BASH_PATH" -n <exact-shell-file>` บน production Bash
- “render Compose” หมายถึง
  `docker compose --env-file <exact-env-file> -f <exact-compose-file> config`
- Expected RED ของแต่ละ row คือ missing symbol ระบุชื่อไม่ได้ หรือ assertion แรกในช่อง
  Behavior ยังไม่เป็นจริง; failure จาก setup/import ที่ไม่เกี่ยวข้องไม่นับ
- Minimal GREEN แก้ได้เฉพาะ implementation files ใน row นั้น หากต้องแตะ path อื่นให้
  หยุดและแก้ plan ก่อน

## Gate 0 — Inputs และ Toolchain `[S]`

### Task G0.1 — บันทึก repository identifiers

- **Files:** `docs/operations/repository-identifiers.md`
- **Change:** บันทึก exact parent/API/Admin/Site remote URLs, default branch,
  `GO_MODULE_PATH`, OCI registry/image names และ InfraStack checkout/revision
- **Verify:** `rg -n "PARENT_REMOTE_URL|API_REMOTE_URL|ADMIN_REMOTE_URL|SITE_REMOTE_URL|GO_MODULE_PATH|OCI_REGISTRY_NAMESPACE|INFRA_STACK" docs/operations/repository-identifiers.md`
- **Pass:** ทุก key มีค่าจริง ไม่มี `<owner>`, `example`, `TODO`, `TBD` หรือ URL สมมติ
- **Blocker:** ต้องรับค่าจากผู้ใช้ก่อนทำ task นี้

### Task G0.2 — ตรวจ remotes

- **Files:** ไม่มี
- **Change:** รัน `git ls-remote` ต่อ exact URL ทั้งสี่; parent remote ใหม่ต้องไม่มี ref;
  child remote อาจว่างได้เฉพาะก่อน local-first bootstrap ใน G0.2A–G0.2B
- **Verify:** parent URL ติดต่อได้และว่าง; บันทึก child แต่ละตัวว่า empty หรือมี
  `refs/heads/main` พร้อม exact SHA
- **Guard:** หาก parent remote มี commit อยู่แล้ว ให้หยุดและวาง reconcile plan ก่อน R1
- **Guard:** หาก child remote มี commit ที่ไม่ได้มาจาก G0.2B ให้หยุดและ reconcile
  local/remote histories ห้าม force push

### Task G0.2A — Initialize child repositories locally `[S][CFG]`

- **Files:** `api/.git/`, `api/README.md`, `admin/.git/`, `admin/README.md`,
  `site/.git/`, `site/README.md`
- **Change:** สร้างสาม independent repositories ด้วย `git init -b main`, เพิ่ม exact
  child `origin`, commit minimal README ด้วย `chore: initialize repository`; parent
  ยังไม่เป็น Git repository และยังไม่ push
- **Verify:** รัน `git -C <child> status --short --branch`,
  `git -C <child> log -1 --format='%H %s'` และ
  `git -C <child> remote get-url origin` ครบสาม child
- **Pass:** ทุก child อยู่ `main`, worktree สะอาด, มีหนึ่ง local commit และ origin ตรง
  `docs/operations/repository-identifiers.md`

### Task G0.2B — Push child bootstrap commits `[S]`

- **Files:** ไม่มี local content change
- **Change:** หลังได้รับ authorization ให้รัน `git -C <child> push -u origin main`
  แยกทีละ child; ห้าม force push
- **Verify:** `git ls-remote <exact-child-url> refs/heads/main`; SHA ต้องเท่ากับ local
  `HEAD` ของ child นั้น
- **Pass:** remote `main` ทั้งสามตรง local commits และ upstream เป็น `origin/main`
- **Observed:** PASS เมื่อ 2026-07-28; API
  `6e68ebdd4356b4dcb145ab6c69ec4abf8e2b2b31`, Admin
  `b71072a301a2444e787e7988f7f9628fdc1958b4`, Site
  `2c015d41c707ee46c3161f6231b4a38559495f75`

### Task G0.3 — บันทึก toolchain baseline

- **Files:** `docs/operations/development-prerequisites.md`
- **Change:** ตรวจ official support ณ วันลงมือ แล้วบันทึก runtime/tool ที่เลือกโดยไม่
  hardcode version จากความจำ
- **Verify:** รัน `git --version`, `go version`, `node --version`,
  `corepack --version`, `pnpm --version`, `docker version`, `docker compose version`,
  `gitleaks version`, `actionlint -version`, `shellcheck --version` และ Bash
  resolution: บน Windows รัน
  `$env:BASH_PATH='C:\Program Files\Git\bin\bash.exe'; & $env:BASH_PATH --version`;
  บน production Linux รัน
  `export BASH_PATH="$(command -v bash)"; "$BASH_PATH" --version`
- **Pass:** ทุก command exit `0`; `BASH_PATH` เป็น absolute executable path และ
  prerequisites doc บันทึก assignment ที่ต้องรันเมื่อเปิด shell ใหม่
- **Observed:** PASS เมื่อ 2026-07-28; Go `1.26.5`, Docker Client/Server `29.6.2`,
  Compose `v5.3.1`, Gitleaks `8.30.1`, actionlint `1.7.12`, ShellCheck `0.11.0`
  และ Git Bash `5.2.37` รันสำเร็จ; working-tree secret scan รายงาน `no leaks found`

### Task G0.4 — ตรวจ database identities

- **Files:** `docs/operations/development-prerequisites.md`
- **Change:** บันทึก PostgreSQL test image/revision, XAMPP engine จาก
  `C:\xampp\mysql\bin\mysql.exe --version` และ Oracle MySQL test profile แยกกัน
- **Verify:** เอกสารใช้คำว่า `MariaDB/XAMPP` สำหรับ client ที่ตรวจพบ และไม่เรียก
  profile นี้ว่า Oracle MySQL
- **Observed:** PASS เมื่อ 2026-07-28; official
  `postgres:18.4-alpine3.24@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15`
  รันและรายงาน PostgreSQL `18.4`; XAMPP client รายงาน MariaDB `10.4.32`;
  Oracle MySQL ยังเป็น `NOT TESTED` และยังไม่ประกาศ support

### Task G0.5 — ยืนยัน TDD exceptions

- **Files:** `docs/specs/2026-07-27-go-lang-starter-milestone-1-plan.md`
- **Change:** การอนุมัติ plan ต้องครอบคลุมเฉพาะ scaffold, lockfile, generated clients,
  Docker/CI config ที่ระบุ `[CFG]`/`[GEN]`
- **Verify:** user อนุมัติ plan นี้ก่อน Task R1

## Phase R — Repository และ Release Contract

### Task R1 — Initialize parent Git `[S][CFG]`

- **Files:** `.git/`
- **Change:** รัน `git init -b main`
- **Verify:** `git status --short --branch`
- **Pass:** แสดง `No commits yet on main`; design/plan files ยังอยู่ครบ

### Task R2.1 — Parent text/ignore policy `[S][CFG]`

- **Files:** `.gitignore`, `.gitattributes`, `.editorconfig`
- **Change:** LF/UTF-8 policy และ ignore `.env`/secrets/build output
- **Verify:** `git check-ignore -v --no-index .env`; `git diff --check`
- **Pass:** `.env` ถูก ignore แต่ `.env.example` ไม่ถูก ignore

### Task R2.2 — Parent README/changelog `[S][CFG]`

- **Files:** `README.md`, `CHANGELOG.md`
- **Change:** parent-only responsibilities, recursive clone flow และ `[Unreleased]`
- **Verify:** `rg -n "submodule|recursive|Unreleased" README.md CHANGELOG.md`

### Task R3 — Commit approved documentation `[S]`

- **Files:** `.gitignore`, `.gitattributes`, `.editorconfig`, `README.md`,
  `CHANGELOG.md`, `docs/operations/repository-identifiers.md`,
  `docs/operations/development-prerequisites.md`,
  `docs/specs/2026-07-27-go-lang-starter-design.md`,
  `docs/specs/2026-07-27-go-lang-starter-implementation-plan.md`,
  `docs/specs/2026-07-27-go-lang-starter-milestone-1-plan.md`
- **Change:** review diff, commit `chore(repo): initialize suite superproject` แล้ว
  `git remote add origin "$env:PARENT_REMOTE_URL"` (เปลี่ยน local `.git/config`
  เท่านั้นและไม่ stage); ยังไม่ push
- **Verify:** `git status --short`; `git log -1 --oneline`; `git remote get-url origin`
- **Pass:** commit มีเฉพาะ parent files ที่ระบุ, status เหลือได้เฉพาะสาม child
  directories ซึ่งรอลงทะเบียนใน R4–R6 และ origin ตรง approved URL

### Task R4 — Add API submodule `[S][CFG]`

- **Files:** `.gitmodules`, `api` gitlink
- **Change:** หลัง G0.2B ผ่าน ใช้
  `git submodule add --force "$env:API_REMOTE_URL" api` เพื่อลงทะเบียน existing local
  repository แล้ว `git submodule absorbgitdirs api`
- **Verify:** `git -C api rev-parse HEAD`; `git ls-files --stage api`
- **Pass:** index mode ของ `api` เป็น gitlink, HEAD ตรง remote `main` และ Git dir
  ถูกย้ายอยู่ใต้ parent `.git/modules/api`

### Task R5 — Add Admin submodule `[S][CFG]`

- **Files:** `.gitmodules`, `admin` gitlink
- **Change:** ใช้ `git submodule add --force "$env:ADMIN_REMOTE_URL" admin` แล้ว
  `git submodule absorbgitdirs admin`
- **Verify:** `git -C admin rev-parse HEAD`; `git ls-files --stage admin`

### Task R6 — Add Site submodule `[S][CFG]`

- **Files:** `.gitmodules`, `site` gitlink
- **Change:** ใช้ `git submodule add --force "$env:SITE_REMOTE_URL" site` แล้ว
  `git submodule absorbgitdirs site`
- **Verify:** `git submodule status --recursive`
- **Pass:** มีสาม gitlinks และไม่มี prefix `-` หรือ `+`
- **Commit:** `chore(repo): add api admin and site submodules`

### Task R7 — Bootstrap parent dev-only verifier `[P-R][CFG]`

- **Files:** `package.json`, `pnpm-lock.yaml`, `vitest.config.ts`
- **Change:** `private: true`; pin current validated YAML, JSON Schema และ test
  dependencies; scripts `test:release`, `release:verify`, `release:verify:all`
- **Verify:** `pnpm install --frozen-lockfile`; `pnpm test:release`
- **Expected:** install ผ่าน; test script fail อย่างชัดเจนเพราะยังไม่มี test

ทำ R8–R11 ด้วย Task Protocol:

| ID | Test files | Implementation files | RED / GREEN verification |
|---|---|---|---|
| R8 `[TDD]` valid manifest | `integration/tests/release/manifest-schema.test.ts`, `integration/fixtures/releases/valid.yaml` | `scripts/release/parse-manifest.mjs`, `scripts/release/validate-manifest.mjs`, `releases/manifest.schema.json` | `pnpm test:release -- manifest-schema`; RED = validator missing, GREEN = valid fixture ผ่าน |
| R9 `[TDD]` reject unsafe manifest | `integration/tests/release/manifest-schema.test.ts`, `integration/fixtures/releases/missing-component.yaml`, `integration/fixtures/releases/mutable-image.yaml`, `integration/fixtures/releases/invalid-semver.yaml`, `integration/fixtures/releases/invalid-infra-revision.yaml`, `integration/fixtures/releases/unsupported-db-claim.yaml` | `releases/manifest.schema.json` | RED = invalid fixture ยังผ่าน, GREEN = mutable InfraStack ref/non-full commit และ fixtures อื่น fail พร้อม stable field path |
| R10 `[TDD]` checksum/path safety | `integration/tests/release/contract-checksum.test.ts`, `integration/fixtures/contracts/admin.openapi.yaml` | `scripts/release/sha256-file.mjs`, `scripts/release/verify-contracts.mjs` | RED = verifier missing, GREEN = exact bytes ผ่าน; mismatch/absolute/parent traversal fail |
| R11 `[TDD]` gitlink/tag pins | `integration/tests/release/submodule-pins.test.ts` | `scripts/release/verify-submodules.mjs`, `scripts/release/verify-release.mjs`, `scripts/release/verify-all.mjs` | RED = mismatch ไม่ถูกตรวจ, GREEN = gitlink = child HEAD = manifest SHA และ release mode ต้อง exact tag |

### Task R12 — Parent contract CI `[S][CFG]`

- **Files:** `.github/workflows/contracts.yml`
- **Change:** recursive checkout, full tag history, frozen install, release tests,
  contract checksum และ real manifest verification
- **Verify:** local `pnpm test:release`; validate YAML ด้วย pinned CI linter
- **Limit:** hosted CI result ยัง unverified จน push ได้

### Task R13 — Contract/release documentation `[P-R]`

- **Files:** `docs/contracts/openapi.md`,
  `docs/contracts/release-manifest.md`, `docs/operations/release.md`
- **Change:** API ownership, artifact surfaces, generated-client rule, checksum,
  independent SemVer, rollback และห้าม `submodule update --remote` ระหว่าง release
- **Verify:** `rg -n "source of truth|checksum|SemVer|rollback|submodule" docs/contracts docs/operations`
- **Commit boundary:** R7 scaffold แยก; R8–R11 commit หลังแต่ละ ID; R12–R13
  แยก CI กับ documentation

## Phase A — Go API Bootstrap และ Platform

### Task A0.1 — Initialize Go module `[S][CFG]`

- **Files:** `api/go.mod`, `api/go.sum`
- **Change:** initialize exact `GO_MODULE_PATH`; choose current supported Gin, GORM,
  Goose, OpenAPI and test dependencies from official sources
- **Verify:** `go env GOMOD`; `go mod verify`
- **Pass:** module path canonicalและ dependencies pinned

### Task A0.2 — API repository docs/ignore `[S][CFG]`

- **Files:** `api/.gitignore`, `api/README.md`
- **Change:** ignore secrets/build output และบันทึก API ownership/tool commands
- **Verify:** `git -C api check-ignore -v --no-index .env`; `git -C api diff --check`

### Task A0.3 — API environment examples `[S][CFG]`

- **Files:** `api/.env.example`, `api/.env.postgres.example`,
  `api/.env.mariadb-xampp.example`, `api/.env.mysql.example`
- **Change:** dummy-only common/PostgreSQL/MariaDB-XAMPP/Oracle-MySQL profiles;
  forwarded-client-IP trust ปิดโดย default และใช้ explicit `TRUSTED_PROXY_CIDRS`
  เมื่อ deploy หลัง Traefik เท่านั้น; กำหนด `INITIAL_LOCALES=th,en` และ
  `DEFAULT_LOCALE=th` เป็น starter defaults ที่แก้ได้ก่อน first migrate
- **Verify:** secret scan; validate required keys; no runnable example contains
  `CHANGE_ME`

ใช้ Task Protocol กับ A1–A13:

| ID | Test file | Implementation files | Targeted command / expected RED / GREEN |
|---|---|---|---|
| A1 `[TDD]` app lifecycle | `api/internal/app/api_test.go` | `api/internal/app/api.go`, `api/cmd/api/main.go` | `go test ./internal/app -run '^TestA1$' -count=1`; RED undefined `Run`, GREEN context shutdown ผ่าน |
| A2 `[TDD]` typed config | `api/internal/platform/config/load_test.go` | `api/internal/platform/config/config.go`, `api/internal/platform/config/load.go` | `go test ./internal/platform/config -run '^TestA2$' -count=1`; RED missing loader, GREEN injected env ถูก parse |
| A3 `[TDD]` fail-fast secrets | `api/internal/platform/config/validate_test.go` | `api/internal/platform/config/validate.go`, `api/internal/platform/config/security.go` | RED = empty/placeholder secret accepted, GREEN = stable error โดยไม่ echo secret |
| A4 `[TDD]` DB flavor config | `api/internal/platform/config/database_test.go` | `api/internal/platform/config/database.go` | RED = invalid driver/flavor accepted, GREEN = `postgres`, `mysql+mariadb`, `mysql+mysql` เท่านั้น |
| A5 `[TDD]` JSON/redaction | `api/internal/platform/telemetry/logger_test.go` | `api/internal/platform/telemetry/logger.go`, `api/internal/platform/telemetry/redactor.go` | `go test ./internal/platform/telemetry -run '^TestA5$' -count=1`; RED logger missing, GREEN JSON fields ครบและ secret/cookie/token ไม่ออก |
| A6 `[TDD]` request ID | `api/internal/platform/middleware/request_id_test.go` | `api/internal/platform/middleware/request_id.go` | RED response ไม่มี ID, GREEN valid incoming ID ถูกใช้หรือสร้างใหม่และส่งกลับ |
| A7 `[TDD]` stable errors | `api/internal/platform/response/problem_test.go` | `api/internal/platform/response/problem.go`, `api/internal/platform/response/writer.go` | RED shape ไม่ตรง, GREEN code/message/details/request_id คงที่และไม่ leak internal error |
| A8 `[TDD]` liveness | `api/internal/platform/httpserver/health_test.go` | `api/internal/platform/httpserver/health.go` | RED `/livez` 404, GREEN 200 โดยไม่ probe dependency |
| A9 `[TDD]` readiness | `api/internal/platform/httpserver/health_test.go` | `api/internal/platform/httpserver/probe.go`, `api/internal/platform/httpserver/health.go` | RED critical failure ยัง 200, GREEN timeout สั้นและ 503; optional dependency ไม่บังคับ unready |
| A10 `[TDD]` graceful server | `api/internal/platform/httpserver/server_test.go` | `api/internal/platform/httpserver/router.go`, `api/internal/platform/httpserver/server.go`, `api/internal/app/dependencies.go` | RED in-flight ถูกตัด, GREEN readiness ปิดก่อน drain/exit |
| A11 `[TDD]` rate-limit config | `api/internal/platform/config/rate_limit_test.go` | `api/internal/platform/config/rate_limit.go` | named `baseline`, `login`, `recovery`, `mfa` policies ต้องมี positive capacity/window; auth policies ต้องเข้มกว่า baseline; invalid config fail fast |
| A11A `[TDD]` trusted-proxy config | `api/internal/platform/config/trusted_proxy_test.go` | `api/internal/platform/config/trusted_proxy.go` | proxy trust disabled by default; parse explicit CIDRs; reject malformed, `0.0.0.0/0`, `::/0` และ implicit trust-all |
| A12 `[TDD]` per-instance limiter | `api/internal/platform/ratelimit/limiter_test.go` | `api/internal/platform/ratelimit/limiter.go` | injected-clock token bucket แยก policy/client key, bounded eviction และ concurrent access race-safe |
| A13 `[TDD]` rate-limit middleware | `api/internal/platform/middleware/rate_limit_test.go` | `api/internal/platform/middleware/rate_limit.go` | limit เกินคืน stable 429 + `Retry-After`; client key ใช้ remote address เว้นแต่ immediate peer อยู่ใน validated A11A CIDR; response/log ไม่เผย raw IP/secret |

- **Lane verification:** `cd api; go test ./internal/platform/... ./internal/app/... -race -count=1; go build ./cmd/api`
- **Commit boundary:** commit แยกหลัง A1–A13/A11A แต่ละ ID ผ่าน RED/GREEN/REFACTOR

## Phase D — Database Profiles และ Migrations

### Task D0.1 — Disposable database services `[S][CFG]`

- **Files:** `api/compose.dev.yml`
- **Change:** เพิ่ม isolated PostgreSQL และ MariaDB test services/profiles พร้อม health
  checks และ database name prefix `go_lang_starter_test_`; ไม่ mount production data
- **Verify:** `cd api; docker compose -f compose.dev.yml --profile postgres config`;
  รันซ้ำด้วย `--profile mariadb`
- **Pass:** ไม่มี host DB port โดย default และ test volumes แยกจาก application volumes

### Task D0.2 — Destructive test guard `[S][TDD]`

- **Files:** `api/tests/testsupport/database_guard_test.go`,
  `api/tests/testsupport/database_guard.go`
- **Change:** test ก่อนว่า reset/down ถูกปฏิเสธหาก `APP_ENV != test`, database name
  ไม่ขึ้นต้น `go_lang_starter_test_` หรือ `ALLOW_TEST_DATABASE_RESET != 1`; จากนั้นเพิ่ม
  guard ขั้นต่ำ
- **Verify:** `cd api; go test ./tests/testsupport -run '^TestD0_2$' -count=1`
- **Expected RED:** `RequireDisposableDatabase` ยังไม่มี
- **Expected GREEN:** unsafe/default/XAMPP application database ถูก reject; dedicated
  test database ผ่าน

### Task D0.3 — Profile test runners `[S][TDD]`

- **Files:** `api/.gitignore`, `api/compose.dev.yml`,
  `api/scripts/test-db.ps1`, `api/scripts/test-db.sh`,
  `api/scripts/test_db_bash_test.go`,
  `api/scripts/test_db_helpers_test.go`,
  `api/scripts/test_db_powershell_test.go`,
  `api/tests/testsupport/cmd/database-guard/main_test.go`,
  `api/tests/testsupport/cmd/database-guard/main.go`
- **Change:** เพิ่ม pinned read-only `go-test` container บน internal database network;
  start/await selected disposable container หรือรับ explicit XAMPP connection fields
  โดย password ส่งผ่านชื่อ environment variable ไม่ส่ง raw secret บน command line;
  test-only CLI ต้องเรียก D0.2 guard ชุดเดียวกันก่อน migration tests, scripts ต้อง
  propagate test exit code, หยุดเฉพาะ service ที่ตนเริ่ม และไม่ใช้ `down`/ลบ volume
- **TDD:** `go test ./tests/testsupport/cmd/database-guard -run '^TestD0_3$' -count=1`;
  RED = CLI adapter ยังไม่มี, GREEN = safe config ผ่านและ unsafe/mismatch errors
  ไม่ echo database/password/authorization
- **Runner regression:** `go test ./scripts -count=1`; ต้อง cleanup เมื่อ start/health
  ล้มเหลว, await service เดิมโดยไม่ stop, reject path traversal และใช้ per-profile
  single-flight lock ข้าม PowerShell/Bash
- **Verify:** syntax/static check และ dry-run ทั้ง `postgres`, `mariadb`,
  `mariadb-xampp`; unknown profile fail ก่อนเรียก external command
- **XAMPP rule:** ห้ามชี้ database เดิมของผู้ใช้ ต้องใช้ local host,
  dedicated name ตาม prefix และส่ง `ALLOW_TEST_DATABASE_RESET=1` แบบ explicit ต่อ
  test run; password อ่านจาก environment ที่ระบุและ dry-run ต้องแสดง `[REDACTED]`

คำสั่ง migration row มาตรฐาน:

```powershell
Set-Location D:\go-lang-starter\api
.\scripts\test-db.ps1 -Profile postgres -Package ./tests/migrations -Run TestM1
.\scripts\test-db.ps1 -Profile mariadb -Package ./tests/migrations -Run TestM1
.\scripts\test-db.ps1 -Profile mariadb-xampp -Package ./tests/migrations -Run TestM1
```

เปลี่ยนเฉพาะ test name `TestM1` เป็น ID ของ row ปัจจุบัน คำสั่งต้องสังเกต RED บน
PostgreSQL ก่อนเพิ่ม migration ใด ๆ และ XAMPP command รันเฉพาะ dedicated test DB

ใช้ Task Protocol กับ D1–D4:

| ID | Test file | Implementation files | Targeted verification |
|---|---|---|---|
| D1 `[TDD]` profile selection | `api/internal/platform/database/open_test.go` | `api/internal/platform/database/open.go`, `api/internal/platform/database/postgres.go`, `api/internal/platform/database/mysql.go` | RED `Open` missing; GREEN GORM dialector ตรง driver/flavor |
| D2 `[TDD]` DSN safety | `api/internal/platform/database/open_test.go` | `api/internal/platform/database/open.go`, `api/internal/platform/database/postgres.go`, `api/internal/platform/database/mysql.go` | RED password อักขระพิเศษทำ DSN พัง/ถูก log; GREEN encoded/field config และ redacted error |
| D3 `[TDD]` migration ordering/lock | `api/internal/platform/database/migrator_test.go` | `api/internal/platform/database/migrator.go`, `api/internal/platform/database/migration_lock.go` | RED concurrent/order case fail; GREEN module topological order + dialect advisory lock |
| D4 `[TDD]` dialect parity | `api/tests/migrations/parity_test.go` | `api/internal/app/migrator.go` | RED basename/version drift ไม่ถูกจับ; GREEN missing/extra dialect file fail พร้อม path |
| D5 `[TDD]` transaction boundary | `api/internal/platform/database/transaction_test.go` | `api/internal/platform/database/transaction.go` | commit on success; rollback on error/panic; nested use caseไม่เปิด independent transaction |

### Migration micro-protocol

แต่ละแถว M1–M18 ทำเป็น microtasks ต่อไปนี้:

1. `<ID>-R`: เพิ่ม test file แล้วรัน PostgreSQL profile; RED = table/index/constraint ไม่มี
2. `<ID>-PG`: เพิ่ม PostgreSQL migration แล้วรัน `up -> down -> up`
3. `<ID>-MDB`: เพิ่ม MariaDB migration แล้วรันกับ CI MariaDB และ XAMPP DSN
4. `<ID>-MY`: เพิ่ม Oracle MySQL migration แล้วรันเมื่อ profile พร้อม; หากไม่มี runtime
   ให้บันทึก `not-tested` และห้ามประกาศ support
5. `<ID>-F`: รัน parity, FK/index assertions และ package integration suite

`{dialect}` ด้านล่างหมายถึง exact sibling directories `postgres`, `mariadb`, `mysql`;
initial migrations เป็น additive เท่านั้น Production rollback ไม่รัน down อัตโนมัติ

ลำดับ executable สำหรับสามแถวแรกคือ `M1 → M3 → M2`: `accounts` เป็น module
dependent ของ `identity` จึงต้องมี `users` schema จริงก่อนที่ `memberships.user_id`
จะสร้าง FK; ID ด้านล่างเป็น task identifiers ไม่ใช่ global migration order

| ID | Test file | Exact migration files | Required schema assertion |
|---|---|---|---|
| M1 | `api/tests/migrations/accounts_test.go` | `api/internal/modules/accounts/migrations/{dialect}/000001_create_accounts.sql` | UUID/engine-safe ID, unique slug, status, timestamps |
| M2 | `api/tests/migrations/memberships_test.go` | `api/internal/modules/accounts/migrations/{dialect}/000002_create_memberships.sql` | account/user unique pair, status, `authorization_version`, FK/index |
| M3 | `api/tests/migrations/users_test.go` | `api/internal/modules/identity/migrations/{dialect}/000001_create_users.sql` | normalized email unique, lifecycle status, system `authorization_version`, timestamps |
| M4 | `api/tests/migrations/password_credentials_test.go` | `api/internal/modules/identity/migrations/{dialect}/000002_create_password_credentials.sql` | user unique FK, hash only, changed timestamp |
| M5 | `api/tests/migrations/sessions_test.go` | `api/internal/modules/identity/migrations/{dialect}/000003_create_sessions.sql` | token hash unique, state, CSRF hash/secret material, authorization-version snapshot, idle/absolute expiry, revoked timestamp |
| M6 | `api/tests/migrations/auth_attempts_test.go` | `api/internal/modules/identity/migrations/{dialect}/000004_create_auth_attempts.sql` | independent `subject`/`ip` HMAC-keyed buckets, positive counters, explicit window/lock expiry และ bounded-cleanup index; ไม่มี raw identifier หรือ user FK |
| M7 | `api/tests/migrations/mfa_test.go` | `api/internal/modules/identity/migrations/{dialect}/000005_create_mfa.sql` | one TOTP credential/user; versioned AEAD ciphertext+nonce, expiring pending enrollment, confirmation-consumed TOTP step และ unique nonce/key pair; versioned recovery-code HMAC hashes + atomic consumed timestamp |
| M8 | `api/tests/migrations/one_time_tokens_test.go` | `api/internal/modules/identity/migrations/{dialect}/000006_create_one_time_tokens.sql` | internal ID + user FK, exact purpose allowlist, globally unique exact 32-byte versioned HMAC, expiry/consume/revoke lifecycle และ issuance/key-retirement/bounded-cleanup indexes |
| M9 | `api/tests/migrations/permissions_test.go` | `api/internal/modules/authorization/migrations/{dialect}/000001_create_permissions.sql` | stable surrogate ID, globally unique lowercase ASCII 4-segment key, module-owner metadata + exact prefix/scope consistency, tier, fail-closed `delegable`/`active` และ `(module_id, active)` reconcile index; owner immutability บังคับใน trusted MR4 reconcile |
| M10 | `api/tests/migrations/roles{,_behavior,_constraints}_test.go` | `api/internal/modules/authorization/migrations/{dialect}/000002_create_roles.sql` | UUID identity + Unicode display label ที่ซ้ำได้และไม่มี authority, exact system/account owner XOR, positive optimistic version, account FK restrict และ composite candidate keys สำหรับ M12/M13; ไม่มี fixed key/role flags/seeds |
| M11 | `api/tests/migrations/role_permissions{,_behavior,_delete_policy}_test.go` | `api/internal/modules/authorization/migrations/{dialect}/000003_create_role_permissions.sql` | 3-column composite-PK mapping; role FK cascade, permission FK restrict เพื่อรักษา dormant mapping และ reverse `(permission_id, role_id)` index สำหรับ bounded invalidation; ไม่มี owner/scope/active/delegable snapshot หรือ seed |
| M12 | `api/tests/migrations/membership_roles{,_behavior,_consistency}_test.go` | `api/internal/modules/authorization/migrations/{dialect}/000004_create_membership_roles.sql` | exact 4-column composite PK; membership FK update-restrict/delete-cascade, role FK restrictive, composite account-consistency ทำให้ cross-account/system-role assignment เป็นไปไม่ได้ และมี `(account_id, role_id)` + reverse `(role_id, account_id, membership_id)` indexes; ไม่มี seed |
| M13 | `api/tests/migrations/system_role_assignments_test.go` | `api/internal/modules/authorization/migrations/{dialect}/000005_create_system_role_assignments.sql` | user/system-role unique pair; account role อ้างไม่ได้ และ reverse `(role_id, user_id)` index |
| M14 | `api/tests/migrations/locales_test.go` | `api/internal/modules/localization/migrations/{dialect}/000001_create_locales.sql` | locale tag unique, enabled, user_selectable, default invariant support |
| M15 | `api/tests/migrations/translations_test.go` | `api/internal/modules/localization/migrations/{dialect}/000002_create_translations.sql` | locale/category/key unique, value, source/version |
| M16 | `api/tests/migrations/locale_preferences_test.go` | `api/internal/modules/localization/migrations/{dialect}/000003_create_user_locale_preferences.sql` | user/locale unique, all-languages mode |
| M17 | `api/tests/migrations/audit_events_test.go` | `api/internal/modules/audit/migrations/{dialect}/000001_create_audit_events.sql` | append-only event data, `system`/`account` scope, nullable account for system events, actor/operation/request indexes |
| M18 | `api/tests/migrations/module_states_test.go` | `api/internal/modules/operations/migrations/{dialect}/000001_create_module_states.sql` | module/config/catalog checksums, enabled state, monotonic catalog epoch + reconcile revision สำหรับ CAS ป้องกัน stale deployment และ reconciled timestamp |

- **Lane verification:** PostgreSQL และ MariaDB `up -> down -> up`, repository ping,
  schema assertions และ parity exit `0`
- **Commit boundary:** commit แยกหลัง D1–D5 แต่ละ ID และหลัง M1–M18 แต่ละ migration
  slice ผ่านทุก declared dialect ที่พร้อม

## Phase O — OpenAPI Source of Truth

### Task O0.1 — Bootstrap contract tooling `[P-O][CFG]`

- **Files:** `api/package.json`, `api/pnpm-lock.yaml`
- **Change:** pin current validated OpenAPI lint/bundle tools และ scripts
  `openapi:lint`, `openapi:bundle`, `openapi:generate`, `openapi:check`
- **Verify:** `cd api; pnpm install --frozen-lockfile`; tools report pinned versions

### Task O0.2 — Configure generators `[S][CFG]`

- **Files:** `api/openapi/codegen/admin.yaml`,
  `api/openapi/codegen/public.yaml`, `api/openapi/codegen/site-server.yaml`
- **Change:** map three isolated surfaces ไป generated directories ที่กำหนด
- **Verify:** config parser โหลดได้ครบสามไฟล์โดยยังไม่ generate source

### Task O0.3 — Pin Go code generator `[S][CFG]`

- **Files:** `api/tools/tools.go`, `api/go.mod`, `api/go.sum`
- **Change:** เพิ่ม build-tagged tool import สำหรับ
  `github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen` เพื่อให้ version ถูก pin
  โดย Go module; generation script เรียกผ่าน module ไม่ใช้ global binary
- **Verify:** `cd api; go list -m github.com/oapi-codegen/oapi-codegen/v2`;
  `go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen --version`
- **Pass:** version ตรง `go.mod`/`go.sum`

ใช้ Task Protocol สำหรับ O1, O2A–O3Q และ O4A–O4C; ใช้ generated protocol
สำหรับ O5:

| ID | Test/contract file | Implementation/generated files | Verification |
|---|---|---|---|
| O1 `[TDD]` common contract | `api/tests/contract/openapi_test.go` | `api/openapi/root.yaml`, `api/openapi/common/errors.yaml`, `api/openapi/common/security.yaml`, `api/openapi/common/pagination.yaml` | RED root/scheme missing; GREEN lint ผ่านและ stable error/request ID schema ครบ |
| O2A `[TDD]` pre-auth CSRF contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/identity/auth.yaml` | RED CSRF operation absent; GREEN anonymous-session/CSRF response และ no-store docs ครบ |
| O2B `[TDD]` login contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/identity/auth.yaml` | RED login operation absent; GREEN password/MFA-pending/authenticated outcomes และ secure-cookie semantics ครบ |
| O2C `[TDD]` MFA enrollment contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/identity/auth.yaml` | RED enroll operation absent; GREEN encrypted-secret enrollment/confirmation response semantics ครบ |
| O2D `[TDD]` MFA challenge contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/identity/auth.yaml` | RED challenge operation absent; GREEN pending-only challenge projection ไม่มี secret/code |
| O2E `[TDD]` MFA verification contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/identity/auth.yaml` | RED verify operation absent; GREEN TOTP/recovery-code result และ authenticated rotation response ครบ |
| O2F `[TDD]` current-session contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/identity/auth.yaml` | RED current-session operation absent; GREEN no-store principal/session projection ครบ |
| O2G `[TDD]` session-list contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/identity/auth.yaml` | RED session-list operation absent; GREEN device/session metadata ไม่มี raw token/fingerprint |
| O2H `[TDD]` session-revoke contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/identity/auth.yaml` | RED revoke-other operation absent; GREEN target/revoked/conflict schemas ครบ |
| O2I `[TDD]` logout contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/identity/auth.yaml` | RED logout operation absent; GREEN current-session revoke + expired cookie/no-store response ครบ |
| O2J `[TDD]` recovery-request contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/identity/auth.yaml` | RED recovery request operation absent; GREEN existing/unknown/disabled user ได้ generic status/body/timing class เดียวกัน, ไม่คืน token และ response เป็น no-store |
| O2K `[TDD]` password-reset contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/identity/auth.yaml` | RED reset operation absent; GREEN รับ token ผ่าน POST body, invalid/expired/consumed/revoked ใช้ generic failure, single-use + session rotation และ no-store/no-referrer semantics ครบ |
| O3A `[TDD]` account contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/accounts/accounts.yaml` | RED account operation ID absent; GREEN current-account schema/operation อยู่ admin surface เท่านั้น |
| O3B `[TDD]` effective-permission contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/authorization/permissions.yaml` | RED current-effective operation absent; GREEN active permission keys + resolved account response อยู่ admin surface |
| O3C `[TDD]` grant contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/authorization/permissions.yaml` | RED grant operation absent; GREEN expected-version/request/result schemas ครบ |
| O3D `[TDD]` assignment contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/authorization/permissions.yaml` | RED role-assignment operation absent; GREEN account/system assignment variants แยกชัดเจน |
| O3E `[TDD]` revoke contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/authorization/permissions.yaml` | RED revoke operation absent; GREEN last-manager conflict และ stable error schema ครบ |
| O3F `[TDD]` privilege-session response | `api/tests/contract/openapi_test.go` | `api/openapi/modules/authorization/permissions.yaml` | RED privilege-change response ไม่มี affected principals/session outcome; GREEN self-rotation vs other-user invalidation แยกได้ |
| O3G `[TDD]` locale-list contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/localization/locales.yaml` | RED list operation absent; GREEN enabled/selectable/default fields และ public visibility ถูกต้อง |
| O3H `[TDD]` locale-create contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/localization/locales.yaml` | RED create operation absent; GREEN system-only request/validation/error schema ครบ |
| O3I `[TDD]` locale-update contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/localization/locales.yaml` | RED metadata update operation absent; GREEN name/direction/version update schema ครบ |
| O3J `[TDD]` locale-status contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/localization/locales.yaml` | RED enable/selectable operation absent; GREEN invariant/conflict response ครบ |
| O3K `[TDD]` locale-default contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/localization/locales.yaml` | RED set-default operation absent; GREEN transactional default result schema ครบ |
| O3L `[TDD]` locale-preference contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/localization/locales.yaml` | RED preferences operation absent; GREEN subset/all-languages request/response ครบ |
| O3M `[TDD]` catalog-read contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/localization/locales.yaml` | RED catalog read operation absent; GREEN locale/category/version projection มี admin/public visibility ถูกต้อง |
| O3N `[TDD]` catalog-update contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/localization/locales.yaml` | RED catalog update operation absent; GREEN system-only optimistic-version request/result ครบ |
| O3O `[TDD]` module contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/operations/modules.yaml` | RED enabled-module operation absent; GREEN read-only runtime module projection อยู่ admin surface |
| O3P `[TDD]` liveness contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/system/health.yaml` | RED live operation absent; GREEN 200 response ไม่มี dependency/secret detail |
| O3Q `[TDD]` readiness contract | `api/tests/contract/openapi_test.go` | `api/openapi/modules/system/health.yaml` | RED ready operation absent; GREEN ready/unavailable schemas ไม่มี dependency/secret detail |
| O4A `[TDD]` Admin surface isolation | `api/tests/contract/surface_test.go` | `api/openapi/root.yaml` | RED admin bundle ขาด required admin operation; GREEN admin allowlist ครบและไม่มี site-server-only operation |
| O4B `[TDD]` Public surface isolation | `api/tests/contract/surface_test.go` | `api/openapi/root.yaml` | RED public bundleเห็น admin mutation; GREEN public allowlist มีเฉพาะ anonymous browser operations |
| O4C `[TDD]` Site-server isolation | `api/tests/contract/surface_test.go` | `api/openapi/root.yaml` | RED site-server bundleเห็น admin/user mutation; GREEN server allowlist มีเฉพาะ internal read operations |
| O5 `[GEN]` bundle/codegen | ไม่มี handwritten behavior | `api/openapi/dist/admin.openapi.yaml`, `api/openapi/dist/public.openapi.yaml`, `api/openapi/dist/site-server.openapi.yaml`, `api/internal/generated/openapi/**` | `pnpm openapi:generate` แล้ว `git diff --exit-code -- openapi/dist internal/generated/openapi` |

- **Commit boundary:** O0.1–O0.3 แยก config/tooling; O1/O2A–O3Q/O4A–O4C commit หลังแต่ละ
  RED/GREEN/REFACTOR; O5 generated no-diff เป็น commit แยก

## Phase I — Identity, Session, CSRF และ CORS

ใช้ Task Protocol; application paths ทุกตัวอยู่ใต้
`api/internal/modules/identity/application/` และ HTTP paths อยู่ใต้
`api/internal/modules/identity/transport/http/`

| ID | Test file | Implementation files | Behavior / targeted verification |
|---|---|---|---|
| I1 `[TDD]` opaque tokens | `api/internal/modules/identity/domain/session_test.go` | `api/internal/modules/identity/domain/session.go`, `api/internal/platform/crypto/token.go` | persisted valueเป็น hash เท่านั้น; raw token random และเปรียบเทียบ constant-time |
| I2 `[TDD]` Argon2id | `api/internal/platform/crypto/password_test.go` | `api/internal/platform/crypto/password.go` | hash/verify, config policy, invalid hash generic error |
| I3 `[TDD]` anonymous session | `api/internal/modules/identity/application/session/create_anonymous_test.go` | `api/internal/modules/identity/application/session/create_anonymous.go`, `api/internal/modules/identity/ports/session_repository.go` | short-lived anonymous state + session-bound CSRF material |
| I4 `[TDD]` session repository | `api/internal/modules/identity/adapters/gorm/session_repository_test.go` | `api/internal/modules/identity/adapters/gorm/session_repository.go` | persist/find/revoke by hash พร้อม authorization-version snapshot; bounded purge ตาม absolute expiry ผ่าน cleanup index; raw tokenไม่ถูกบันทึก |
| I5 `[TDD]` CSRF endpoint | `api/internal/modules/identity/transport/http/csrf_handler_test.go` | `api/internal/modules/identity/transport/http/csrf_handler.go`, `api/internal/modules/identity/transport/http/routes.go` | GET สร้าง/rotate anonymous cookie และ body token; `Cache-Control: no-store` |
| I6 `[TDD]` secure cookie | `api/internal/modules/identity/transport/http/cookie_test.go` | `api/internal/modules/identity/transport/http/cookie.go` | production `__Host-`, host-only, Path=/, HttpOnly, Secure, SameSite=Lax |
| I7 `[TDD]` CSRF mutation guard | `api/internal/platform/middleware/csrf_test.go` | `api/internal/platform/middleware/csrf.go` | missing/wrong token fail 403 รวม login/logout; safe methodsไม่มี business mutation |
| I8 `[TDD]` Origin/Referer | `api/internal/platform/middleware/csrf_test.go` | `api/internal/platform/middleware/csrf.go` | exact trusted Origin; fallback Referer; malformed/foreign fail closed |
| I9 `[TDD]` exact CORS | `api/internal/platform/middleware/cors_test.go` | `api/internal/platform/middleware/cors.go` | credentialed exact Admin origin, `Vary: Origin`, no wildcard/reflect |
| I10 `[TDD]` password login | `api/internal/modules/identity/application/auth/login_test.go` | `api/internal/modules/identity/application/auth/login.go`, `api/internal/modules/identity/ports/user_repository.go`, `api/internal/modules/identity/ports/password_repository.go` | generic invalid credential; correct password proceeds |
| I11 `[TDD]` auth attempts | `api/internal/platform/config/auth_attempt_test.go`, `api/internal/platform/crypto/fingerprint_test.go`, `api/internal/modules/identity/application/auth/attempt_policy_test.go` | `api/internal/platform/config/auth_attempt.go`, `api/internal/platform/crypto/fingerprint.go`, `api/internal/modules/identity/application/auth/attempt_policy.go`, `api/internal/modules/identity/ports/auth_attempt_repository.go`, `api/internal/modules/identity/adapters/gorm/auth_attempt_repository.go` | password-login-only DB state shared across replicas; dedicated stable HMAC key + domain separation; subject normalization ตรง user lookup และ IP ใช้ trusted-proxy resolver ชุดเดียว; atomic fixed-order upsert/check ทั้ง subject/IP พร้อม saturating counter; active lock ไม่ถูกยืดจาก request ใหม่; unknown/disabled/wrong/locked ใช้ generic response/timing + dummy verify; success reset เฉพาะ subject; bounded cleanup ข้าม active lock, explicit `updated_at`, repository failure fail closed; threshold/window/temporary lock เป็น validated config ไม่ hardcode |
| I12 `[TDD]` authenticated rotation | `api/internal/modules/identity/application/auth/login_test.go` | `api/internal/modules/identity/application/session/rotate.go` | conditional revoke pre-auth (`revoked_at IS NULL`) + insert authenticated row ใหม่ใน transaction เดียว; ห้าม update token/state บนแถวเดิม; issue ID/CSRF ใหม่ และ old ID unusable |
| I13 `[TDD]` MFA pending | `api/internal/modules/identity/application/auth/login_mfa_test.go` | `api/internal/modules/identity/application/auth/login.go`, `api/internal/modules/identity/domain/mfa.go` | conditional revoke pre-auth + insert limited `mfa_pending` row ใหม่ใน transaction เดียว; ห้าม update token/state บนแถวเดิม; CSRF ใหม่ |
| I14 `[TDD]` TOTP at rest | `api/internal/platform/config/totp_keyring_test.go`, `api/internal/platform/crypto/envelope_test.go`, `api/internal/modules/identity/application/mfa/enroll_test.go` | `api/internal/platform/config/totp_keyring.go`, `api/internal/platform/crypto/envelope.go`, `api/internal/modules/identity/application/mfa/enroll.go`, `api/internal/modules/identity/ports/mfa_repository.go` | v1 AEAD ใช้ external rotation-aware key version + fresh 12-byte CSPRNG nonce ทุก write/rewrap; associated data bind user/purpose/envelope metadata; pending TTL; confirm แบบ conditional เฉพาะ unexpired pending พร้อม consume confirmation step และสร้าง recovery hashesใน transaction เดียว; raw secret/URI คืนครั้งเดียวก่อน confirm ด้วย no-store และหลัง confirm ห้ามคืน/log |
| I15 `[TDD]` MFA completion | `api/internal/modules/identity/application/mfa/verify_test.go` | `api/internal/modules/identity/application/mfa/verify.go` | TOTP candidate step ต้องมากกว่า `last_used_step` ผ่าน conditional update; recovery code consume เฉพาะ `consumed_at IS NULL`; consume, conditional revoke pending session และ insert authenticated row ใหม่อยู่ transaction เดียวและ exactly one request ชนะ; ห้าม update token/state บนแถวเดิม |
| I16 `[TDD]` logout/revoke | `api/internal/modules/identity/application/session/revoke_test.go` | `api/internal/modules/identity/application/session/revoke.go` | server-side revoke และ token reuse fail |
| I17 `[TDD]` expiry | `api/internal/modules/identity/domain/session_expiry_test.go` | `api/internal/modules/identity/domain/session.go` | idle และ absolute timeout; clock injected |
| I17A `[TDD]` session authentication middleware | `api/internal/platform/middleware/session_auth_test.go` | `api/internal/platform/middleware/session_auth.go`, `api/internal/modules/identity/ports/authorization_version_reader.go` | hash cookie before lookup; missing/revoked/expired/wrong-state/stale authorization version fail closed; valid session injects typed principal/account context |
| I18 `[TDD]` recovery token | `api/internal/modules/identity/application/auth/recovery_test.go` | `api/internal/modules/identity/application/auth/request_recovery.go`, `api/internal/modules/identity/application/auth/reset_password.go`, `api/internal/modules/identity/ports/one_time_token_repository.go` | raw token ใช้ CSPRNG อย่างน้อย 256 bits; HMAC-SHA-256 ใช้ dedicated versioned keyring + domain/purpose/ID/user binding; unknown/disabled subject ทำ dummy HMAC และตอบ generic/timing class เดียวกัน; issuance lock user, revoke live token purpose เดิม และ insert token+encrypted short-lived delivery outbox ใน transaction เดียว; reset consume token, เปลี่ยน password/authorization version, revoke sessions/other reset tokens และ rotate session ตาม contract ใน transaction เดียว; ห้าม persist/log raw token หรือ URL/body ที่มี token |
| I19 `[TDD]` Identity rate policies | `api/tests/security/rate_limit_http_test.go` | `api/internal/modules/identity/transport/http/rate_limit.go`, `api/internal/modules/identity/transport/http/routes.go` | `/api/v1` ใช้ baseline; login/recovery/MFA ใช้ stricter named policy; limit เกินคืน 429 stable และไม่เรียก use case |
| I20 `[TDD]` user/credential persistence | `api/internal/modules/identity/adapters/gorm/user_repository_test.go` | `api/internal/modules/identity/adapters/gorm/user_repository.go`, `api/internal/modules/identity/adapters/gorm/password_repository.go` | normalized lookup, status filter, credential hash read/write โดยไม่คืน sensitive fieldsเกิน port; GORM logger ใช้ parameterized queries; password change อัปเดต `changed_at` แต่ rehash-only ต้องคงค่าเดิม |
| I21 `[TDD]` MFA persistence | `api/internal/platform/config/recovery_code_keyring_test.go`, `api/internal/modules/identity/adapters/gorm/mfa_repository_test.go` | `api/internal/platform/config/recovery_code_keyring.go`, `api/internal/modules/identity/adapters/gorm/mfa_repository.go` | persist เฉพาะ AEAD envelope; expired pending conditional replace แต่ active ห้าม overwrite; rewrap ต้อง nonce ใหม่; recovery code entropy สูงและ HMAC-SHA-256 ด้วย dedicated versioned key + domain separation; insert/regenerate ทั้งชุด transactionally; consume once; retain old AEAD/HMAC keys จนไม่มี row version เดิม |
| I22 `[TDD]` one-time token persistence | `api/internal/modules/identity/adapters/gorm/one_time_token_repository_test.go` | `api/internal/modules/identity/adapters/gorm/one_time_token_repository.go` | GORM parameterized logging; issuance lock user แล้ว revoke live same-purpose rows ก่อน insert; consume ด้วย ID+purpose+versioned hash และ conditional `consumed_at IS NULL`, `revoked_at IS NULL`, `created_at <= now < expires_at` โดย affected rows ต้องเท่ากับ 1; retain old HMAC key จนไม่มี live unexpired row และ cleanup expired/terminal rows เป็น bounded batches หลัง audit retention |
| I23A `[TDD]` login HTTP contract | `api/tests/security/login_http_test.go` | `api/internal/modules/identity/transport/http/login_handler.go`, `api/internal/modules/identity/transport/http/routes.go`, `api/internal/app/api.go` | generated login request/error/authenticated response และ pre-auth rotation |
| I23B `[TDD]` MFA HTTP contract | `api/tests/security/mfa_http_test.go` | `api/internal/modules/identity/transport/http/mfa_handler.go`, `api/internal/modules/identity/transport/http/routes.go`, `api/internal/app/api.go` | pending-only challenge/verify, new CSRF และ authenticated rotation |
| I23C `[TDD]` session HTTP contract | `api/tests/security/session_http_test.go` | `api/internal/modules/identity/transport/http/session_handler.go`, `api/internal/modules/identity/transport/http/routes.go`, `api/internal/app/api.go` | current/logout/list/revoke-other responses no-store; revoked token หรือ stale authorization-version snapshot ใช้ไม่ได้ |
| I23D `[TDD]` recovery HTTP contract | `api/tests/security/recovery_http_test.go` | `api/internal/modules/identity/transport/http/recovery_handler.go`, `api/internal/modules/identity/transport/http/routes.go`, `api/internal/app/api.go` | generic request response, single-use reset และ session rotation |

- **Verify:** `cd api; go test ./internal/modules/identity/... ./internal/platform/middleware/... ./tests/security/... -race -count=1`
- **Commit boundary:** commit หลัง I1–I23D แต่ละ ID ผ่าน targeted test และ identity suite

## Phase Q — Accounts และ Authorization

ใช้ Task Protocol:

| ID | Test file | Implementation files | Behavior |
|---|---|---|---|
| Q1 `[TDD]` hidden account | `api/internal/modules/accounts/application/resolve_account_test.go` | `api/internal/modules/accounts/domain/account.go`, `api/internal/modules/accounts/domain/membership.go`, `api/internal/modules/accounts/application/resolve_account.go`, `api/internal/modules/accounts/ports/account_repository.go` | Personal mode resolve default account ภายใน; client ปลอม account ID ไม่ได้ |
| Q2 `[TDD]` repository scope | `api/internal/modules/accounts/adapters/gorm/account_repository_test.go` | `api/internal/modules/accounts/adapters/gorm/account_repository.go` | ทุก membership/resource query รับ resolved account; membership identity `(id, account_id, user_id)` immutable และ hard-delete/deactivate ต้องผ่าน guarded lifecycle ที่ serialize last-manager + invalidation |
| Q3 `[TDD]` permission key | `api/internal/modules/authorization/domain/permission_key_test.go` | `api/internal/modules/authorization/domain/permission_key.go` | ใช้ canonical grammar เดียวกับ DB: lowercase ASCII exact 4 segments, module/scope round-trip ตรง persisted metadata และ scope allowlist |
| Q4 `[TDD]` default deny | `api/internal/modules/authorization/application/evaluate_permission_test.go` | `api/internal/modules/authorization/application/evaluate_permission.go` | ไม่มี grant = deny; role UUID เป็น identity และ role `name` เป็น display-only ที่ซ้ำได้—ห้าม lookup/authorize/bootstrap/protect ด้วยชื่อหรือ case |
| Q5 `[TDD]` role union | `api/internal/modules/authorization/adapters/gorm/permission_repository_test.go` | `api/internal/modules/authorization/ports/permission_repository.go`, `api/internal/modules/authorization/adapters/gorm/permission_repository.go` | mapping row ไม่ใช่ authority โดยลำพัง: join current role owner + permission scope/state ทุกครั้ง, filter `active=true`, tier/delegable ไม่ใช้ตัดสิน effective grant และผลลัพธ์ผูก current catalog epoch/checksum; invalid injected mapping ต้อง fail closed |
| Q6 `[TDD]` `any` scope | `api/internal/modules/authorization/application/evaluate_permission_test.go` | `api/internal/modules/authorization/application/evaluate_permission.go` | `any` อยู่ภายใน resolved account; cross-account deny |
| Q7 `[TDD]` `own` scope | `api/internal/modules/authorization/application/evaluate_permission_test.go` | `api/internal/modules/authorization/application/evaluate_permission.go` | ownership โหลดภายใต้ account ก่อน compare |
| Q8 `[TDD]` system scope | `api/internal/modules/authorization/application/evaluate_permission_test.go` | `api/internal/modules/authorization/application/evaluate_permission.go` | account role รับ `system` permission ไม่ได้; system role รับ `own`/`any` ไม่ได้; negative tests ครบทั้ง evaluate/grant/assignment |
| Q8A `[TDD]` role persistence | `api/internal/modules/authorization/adapters/gorm/role_repository_test.go` | `api/internal/modules/authorization/ports/role_repository.go`, `api/internal/modules/authorization/adapters/gorm/role_repository.go` | system/account role ownership immutable, account endpoint บังคับ trusted resolved account, lookup/mutation ด้วย `(account_id, role_id)` เท่านั้น และทุก mutation ใช้ expected optimistic version; zero rows = conflict โดยไม่มี side effect |
| Q8B `[TDD]` assignment persistence | `api/internal/modules/authorization/adapters/gorm/assignment_repository_test.go` | `api/internal/modules/authorization/ports/assignment_repository.go`, `api/internal/modules/authorization/adapters/gorm/assignment_repository.go` | membership-role และ user-system-role assignment แยก; trusted resolved account ทุก mutation, cross-account/system-role-in-membership FK/input fail, assignment เป็น insert/delete-only ไม่มี generic retarget update และ direct user permission grants |
| Q9 `[TDD]` safe grant | `api/internal/modules/authorization/application/grant_role_permission_test.go` | `api/internal/modules/authorization/application/grant_role_permission.go` | ภายใน transaction ที่ serialize กับ reconcile ต้อง revalidate grantor ถือ operation permission + exact target permission ที่ active+delegable, module enabled, role/account/scope compatible, optimistic role version และ current catalog epoch; `.own` ไม่ imply `.any`; inactive/stale/conflict rollbackทั้งหมด |
| Q9A `[TDD]` safe role assignment | `api/internal/modules/authorization/application/assign_role_test.go` | `api/internal/modules/authorization/application/assign_role.go` | lock role+membership แล้ว pin persisted mappings ทั้งหมด; reject role ที่มี inactive/non-delegable/ผิด scope/cross-account mapping เพื่อป้องกัน latent privilege เมื่อ module เปิดใหม่; revalidate assigner operation+target permissions, role version และ catalog epoch ตอน commit พร้อม concurrent tests |
| Q10 `[TDD]` last manager | `api/internal/modules/authorization/application/revoke_role_test.go` | `api/internal/modules/authorization/application/revoke_role.go` | ปฏิเสธการลบ/revoke authorization manager คนสุดท้ายด้วย account-scoped lock/CAS; concurrent revoke มีเพียงหนึ่ง transaction commit |
| Q11 `[TDD]` cache version | `api/internal/modules/authorization/application/permission_cache_test.go` | `api/internal/modules/authorization/application/permission_cache.go` | cache key/check รวม system/account authorization versions + monotonic catalog epoch/checksum; role/grant/catalog change ทำ stale cache ใช้ไม่ได้และ mismatch ต้อง fail closed |
| Q11A `[TDD]` principal version persistence | `api/internal/modules/authorization/adapters/gorm/principal_version_repository_test.go` | `api/internal/modules/authorization/ports/principal_version_repository.go`, `api/internal/modules/authorization/adapters/gorm/principal_version_repository.go` | bump system user/account membership versions ของ affected principals แบบ atomic และอ่าน current version ภายใต้ account scope |
| Q11B `[TDD]` privilege-session invalidation | `api/internal/modules/authorization/application/privilege_change_test.go` | `api/internal/modules/authorization/application/privilege_change.go`, `api/internal/modules/authorization/ports/session_security.go`, `api/internal/modules/identity/application/session/privilege_change.go`, `api/internal/modules/authorization/application/grant_role_permission.go`, `api/internal/modules/authorization/application/assign_role.go`, `api/internal/modules/authorization/application/revoke_role.go` | grant/assign/revoke สำเร็จจึง bump version และ invalidate sessions ของ affected principals ใน transaction เดียว; failure ไม่เปลี่ยน version/session |
| Q11C `[TDD]` self privilege rotation | `api/internal/modules/authorization/transport/http/privilege_session_test.go` | `api/internal/modules/authorization/transport/http/privilege_change_handler.go`, `api/internal/modules/authorization/transport/http/routes.go` | หาก actor อยู่ใน affected principals ให้ response ออก replacement session+CSRF หลัง commit; old ID ใช้ไม่ได้; เปลี่ยนสิทธิ์ผู้อื่นไม่ rotate actor |
| Q12 `[TDD]` HTTP guard | `api/internal/modules/authorization/transport/http/require_permission_test.go` | `api/internal/modules/authorization/transport/http/require_permission.go` | unauthenticated 401, missing permission 403, handlerไม่ใช้ role name |
| Q13 `[TDD]` bootstrap | `api/internal/app/bootstrap_test.go` | `api/internal/app/bootstrap.go`, `api/cmd/bootstrap/main.go` | one-time account/user/dynamic initial role และ rerun idempotent; audit emission ทำใน AU3D หลัง audit port พร้อม |
| Q14 `[QA]` escalation matrix | `api/tests/security/authorization_matrix_test.go` | ไม่มี production file | horizontal/vertical/IDOR/cross-account/stale cache, dormant-role activation, reconcile-vs-grant และ concurrent last-manager races ทั้งหมด deny/มีผู้ชนะตาม contract; หาก fail ให้หยุดและเข้า rigid debugging gate |
| Q15 `[TDD]` effective permissions | `api/internal/modules/authorization/transport/http/permission_handler_test.go` | `api/internal/modules/authorization/transport/http/permission_handler.go` | current principal ได้เฉพาะ active effective union และ resolved account context |

- **Verify:** `cd api; go test ./internal/modules/accounts/... ./internal/modules/authorization/... ./tests/security/... -race -count=1`
- **Commit boundary:** commit หลัง Q1–Q15/Q8A/Q8B/Q9A/Q11A–Q11C แต่ละ ID; Q14 QA test เป็น
  test-only commit เมื่อผ่าน

## Phase L — Localization Runtime

Bundled examples แยกหมวดใน:

- `api/locales/en/{common,navigation,auth,validation}.json`
- `api/locales/th/{common,navigation,auth,validation}.json`

ใช้ Task Protocol:

| ID | Test file | Implementation files | Behavior |
|---|---|---|---|
| L1 `[TDD]` locale tag/registry | `api/internal/modules/localization/domain/locale_test.go` | `api/internal/modules/localization/domain/locale.go`, `api/internal/modules/localization/application/list_locales.go` | arbitrary valid tags, one default, enabled/user_selectable แยกกัน |
| L1A `[TDD]` locale persistence | `api/internal/modules/localization/adapters/gorm/locale_repository_test.go` | `api/internal/modules/localization/ports/locale_repository.go`, `api/internal/modules/localization/adapters/gorm/locale_repository.go` | normalized tag uniqueness, transactional single default, list enabled/selectable |
| L1B `[TDD]` manage locales | `api/internal/modules/localization/application/manage_locale_test.go` | `api/internal/modules/localization/application/create_locale.go`, `api/internal/modules/localization/application/update_locale.go`, `api/internal/modules/localization/application/set_default_locale.go` | create/update/enable/user-selectable/default ต้องมี `localization.locales.manage.system`; account permission deny |
| L1C `[TDD]` locale management HTTP | `api/internal/modules/localization/transport/http/locale_handler_test.go` | `api/internal/modules/localization/transport/http/locale_handler.go` | generated create/update/status/default operations เรียก use case และคืน stable errors |
| L1D `[TDD]` initial locale initialization | `api/internal/modules/localization/application/initialize_locales_test.go` | `api/internal/modules/localization/application/initialize_locales.go` | clean DB upsert configured bundled locales เป็น enabled/selectable พร้อม exactly one default; rerun idempotent และไม่ overwrite system-edited metadata/state |
| L2 `[TDD]` catalog schema | `api/tests/contract/catalog_schema_test.go` | `api/locales/catalog.schema.json`, bundled files ด้านบน | category/key/value format และ th/en category parity |
| L3 `[TDD]` merge order | `api/internal/modules/localization/application/catalog/merge_test.go` | `api/internal/modules/localization/application/catalog/merge.go`, `api/internal/modules/localization/ports/catalog_repository.go` | DB override > bundle > explicit UI fallback |
| L3A `[TDD]` catalog persistence | `api/internal/modules/localization/adapters/gorm/catalog_repository_test.go` | `api/internal/modules/localization/adapters/gorm/catalog_repository.go` | locale/category/key upsert with version; deterministic export order |
| L4 `[TDD]` no content fallback | `api/internal/modules/localization/application/catalog/merge_test.go` | `api/internal/modules/localization/application/catalog/merge.go` | public content missing locale ไม่ดึงเนื้อหาภาษาอื่น |
| L5 `[TDD]` selectable subset | `api/internal/modules/localization/application/preferences/update_test.go` | `api/internal/modules/localization/application/preferences/update.go`, `api/internal/modules/localization/ports/preference_repository.go` | user เลือก subset ของ enabled/selectable หรือ all-languages mode |
| L5A `[TDD]` preference persistence | `api/internal/modules/localization/adapters/gorm/preference_repository_test.go` | `api/internal/modules/localization/adapters/gorm/preference_repository.go` | replace subset transactionally; all-languages mode round-trip |
| L6 `[TDD]` system-only edits | `api/internal/modules/localization/application/catalog/update_test.go` | `api/internal/modules/localization/application/catalog/update.go` | ต้องมี `localization.translations.update.system`; account role ไม่ผ่าน |
| L7 `[TDD]` API contracts | `api/tests/contract/localization_http_test.go` | `api/internal/modules/localization/transport/http/locale_handler.go`, `api/internal/modules/localization/transport/http/catalog_handler.go` | list/catalog/preferences/update endpoints ตรง generated interface |

- **Verify:** `cd api; go test ./internal/modules/localization/... ./tests/contract/... -race -count=1`
- **Commit boundary:** commit หลัง L1–L7/L1A–L1D/L3A/L5A แต่ละ ID

## Phase M — Module Registry และ Atomic Reconcile

ใช้ Task Protocol:

| ID | Test file | Implementation files | Behavior |
|---|---|---|---|
| MR1 `[TDD]` manifest | `api/internal/modular/manifest_test.go` | `api/internal/modular/manifest.go` | ID/tier/dependencies/capabilities/permissions/routes/jobs/migrations/health; registry เป็น sole catalog authority และ reject duplicate/spoofed key, owner-prefix/tier mismatch, undeclared route permission หรือ malformed canonical key |
| MR2 `[TDD]` graph | `api/internal/modular/dependencies_test.go` | `api/internal/modular/dependencies.go`, `api/internal/modular/registry.go` | missing dependency/cycle fail deterministically |
| MR3 `[TDD]` disabled projection | `api/internal/modular/state_test.go` | `api/internal/modular/state.go` | disabled moduleไม่มี route/job/health และ permission inactive |
| MR4 `[TDD]` transactional reconcile | `api/internal/modules/operations/application/reconcile_modules_test.go` | `api/internal/modules/operations/application/reconcile_modules.go`, `api/internal/modules/operations/ports/module_state_repository.go` | advisory lock + expected-revision CAS; exact-set catalog upsert โดย owner immutable/collision abort, removed/disabled permissions เป็น inactive โดยไม่ลบ mappings; checksumคำนวณจาก persisted security projection และ active/delegable/tier/enabled transition เพิ่ม monotonic catalog epoch ทั้งหมดใน transactionเดียว; stale deployment rollback |
| MR6 `[TDD]` repository | `api/internal/modules/operations/adapters/gorm/module_state_repository_test.go` | `api/internal/modules/operations/adapters/gorm/module_state_repository.go` | idempotent state/checksum persistence |
| MR7 `[TDD]` migrate order | `api/internal/app/migrator_test.go` | `api/internal/app/migrator.go`, `api/cmd/migrate/main.go` | schema migrate → L1D initial locales → module reconcile; failure หยุดลำดับและ rerun idempotent |
| MR8 `[TDD]` startup checksum | `api/internal/app/modules_test.go` | `api/internal/app/modules.go` | startup read-only recompute persisted projection checksum และตรวจ epoch/revision ด้วย bounded refresh; mismatch fail readiness และ authorization evaluation fail closed |
| MR9 `[TDD]` module endpoint | `api/tests/contract/modules_http_test.go` | `api/internal/modules/operations/transport/http/module_handler.go` | `/api/v1/system/modules` คืน enabled authority; ไม่มี runtime toggle |
| MR10 `[QA]` disabled isolation | `api/tests/security/disabled_module_test.go` | ไม่มี production file | disabled routes 404, grant ใหม่ไม่ได้, jobsไม่ register; หาก fail ให้หยุดและเข้า rigid debugging gate |
| MR11A `[TDD]` Identity manifest | `api/internal/app/modules_test.go` | `api/internal/modules/identity/manifest.go`, `api/internal/modules/identity/permissions.go` | Identity tier/dependencies/routes/permissions canonical และปิดไม่ได้ |
| MR11B `[TDD]` Accounts manifest | `api/internal/app/modules_test.go` | `api/internal/modules/accounts/manifest.go`, `api/internal/modules/accounts/permissions.go` | Accounts depends/permission catalog canonical และปิดไม่ได้ |
| MR11C `[TDD]` Authorization manifest | `api/internal/app/modules_test.go` | `api/internal/modules/authorization/manifest.go`, `api/internal/modules/authorization/permissions.go` | Authorization dependencies/system scopes canonical และปิดไม่ได้ |
| MR11D `[TDD]` Localization manifest | `api/internal/app/modules_test.go` | `api/internal/modules/localization/manifest.go`, `api/internal/modules/localization/permissions.go` | มี `localization.locales.manage.system`/`localization.translations.update.system`, dependenciesถูกและปิดไม่ได้ |
| MR11E `[TDD]` Audit manifest | `api/internal/app/modules_test.go` | `api/internal/modules/audit/manifest.go`, `api/internal/modules/audit/permissions.go` | Audit append capability/permission catalog canonical และปิดไม่ได้ |
| MR11F `[TDD]` Operations manifest | `api/internal/app/modules_test.go` | `api/internal/modules/operations/manifest.go`, `api/internal/modules/operations/permissions.go` | Operations module-state route/permissions canonical และปิดไม่ได้; registry ไม่มี settings/default/optional skeleton |

- **Verify:** `cd api; go test ./internal/modular/... ./internal/modules/operations/... ./tests/security/... -race -count=1; go build ./cmd/migrate`
- **Commit boundary:** commit หลัง MR1–MR11F แต่ละ ID; MR10 QA เป็น test-only commit

## Phase AU — Append-only Audit Foundation

ใช้ Task Protocol หลัง I, Q, L และ M:

| ID | Test file | Implementation files | Behavior |
|---|---|---|---|
| AU1 `[TDD]` safe audit event | `api/internal/modules/audit/domain/event_test.go` | `api/internal/modules/audit/domain/event.go`, `api/internal/modules/audit/application/append_event.go`, `api/internal/modules/audit/ports/event_repository.go` | require action, typed actor, operation ID และ time; `account` scope ต้องมี account ID แต่ `system` scope ต้องไม่มี; HTTP event เพิ่ม request ID; reject password/cookie/token/secret fields |
| AU2 `[TDD]` append repository | `api/internal/modules/audit/adapters/gorm/event_repository_test.go` | `api/internal/modules/audit/adapters/gorm/event_repository.go` | append/read only; application port ไม่ expose update/delete |
| AU3A `[TDD]` login audit | `api/tests/security/audit_login_test.go` | `api/internal/modules/identity/application/auth/login.go` | ทุก login outcome append sanitized event พร้อม request ID และ outcome code โดยไม่เก็บ credential/IP ดิบ |
| AU3B `[TDD]` session audit | `api/tests/security/audit_session_test.go` | `api/internal/modules/identity/application/session/revoke.go` | logout/self/other-session revoke append action และ target session fingerprint ที่ไม่ใช่ raw token |
| AU3C `[TDD]` authorization audit | `api/tests/security/audit_authorization_test.go` | `api/internal/modules/authorization/application/grant_role_permission.go`, `api/internal/modules/authorization/application/assign_role.go`, `api/internal/modules/authorization/application/revoke_role.go` | successful grant/assign/revoke append before/after identifiers และ affected-principal count; denied changeไม่บันทึกเป็น success |
| AU3D `[TDD]` bootstrap audit | `api/tests/security/audit_bootstrap_test.go` | `api/internal/app/bootstrap.go` | first bootstrap append actor/account/role creation event; idempotent rerunไม่สร้าง duplicate success event |
| AU3E `[TDD]` locale lifecycle audit | `api/tests/security/audit_locale_test.go` | `api/internal/modules/localization/application/initialize_locales.go`, `api/internal/modules/localization/application/create_locale.go`, `api/internal/modules/localization/application/update_locale.go`, `api/internal/modules/localization/application/set_default_locale.go` | initialization ใช้ system actor/scope + operation ID โดยไม่มี account; create/update/enable/selectable/default changes ใช้ account/system context ตาม operation และไม่เก็บ translated values |
| AU3F `[TDD]` catalog audit | `api/tests/security/audit_catalog_test.go` | `api/internal/modules/localization/application/catalog/update.go` | catalog edit append locale/category/key/version และไม่เก็บ translation body |
| AU3G `[TDD]` module reconcile audit | `api/tests/security/audit_module_test.go` | `api/internal/modules/operations/application/reconcile_modules.go` | pre-bootstrap reconcile ใช้ system actor/scope + operation ID โดยไม่มี account และ append previous/new checksum หลัง transaction สำเร็จ |
| AU3H `[TDD]` MFA enrollment audit | `api/tests/security/audit_mfa_enroll_test.go` | `api/internal/modules/identity/application/mfa/enroll.go` | enroll/confirm outcome append action โดยไม่เก็บ TOTP secret/code/recovery hash |
| AU3I `[TDD]` MFA verification audit | `api/tests/security/audit_mfa_verify_test.go` | `api/internal/modules/identity/application/mfa/verify.go` | TOTP/recovery-code outcome append method + result โดยไม่เก็บ code/hash |
| AU3J `[TDD]` recovery-request audit | `api/tests/security/audit_recovery_request_test.go` | `api/internal/modules/identity/application/auth/request_recovery.go` | request outcome append generic action + normalized-subject fingerprint โดยไม่เปิดเผยว่าบัญชีมีอยู่หรือ token ใดถูกออก |
| AU3K `[TDD]` password-reset audit | `api/tests/security/audit_password_reset_test.go` | `api/internal/modules/identity/application/auth/reset_password.go` | successful/failed consume append outcome + principal fingerprint โดยไม่เก็บ password/token และ success เชื่อม session rotation request ID |

- **Verify:** `cd api; go test ./internal/modules/audit/... ./tests/security/... -race -count=1`
- **Commit boundary:** commit AU1, AU2 และ AU3A–AU3K แยกหนึ่ง ID ต่อ commit

## Phase W — API Composition

ใช้ Task Protocol หลัง D, O, I, Q, L, M และ AU:

| ID | Test file | Implementation files | Behavior |
|---|---|---|---|
| W1A `[TDD]` platform composition | `api/internal/app/dependencies_platform_test.go` | `api/internal/app/dependencies.go`, `api/internal/app/dependencies_platform.go` | startup เรียก `Load(os.LookupEnv) → Validate` ก่อนสร้าง dependency และ error ต้องไม่ echo secret; config, validated trusted-proxy CIDRs, DB, transaction manager, crypto, clock และ per-instance rate limiter ถูก inject; สร้าง process-local HMAC client-key secret จาก CSPRNG โดยไม่ reuse application secret; router trust และ limiter client-key resolver ใช้ allowlist ชุดเดียว; `RequestID` ต้องอยู่ก่อน `RateLimit`; ไม่มี package-global mutable dependency |
| W1B `[TDD]` Identity composition | `api/internal/app/dependencies_identity_test.go` | `api/internal/app/dependencies_identity.go` | Identity repositories/use cases ใช้ platform dependencies ชุดเดียว; audit appender ถูก inject เข้า login/session/MFA/recovery; lifecycle ปิดครบ |
| W1C `[TDD]` Accounts/Authz composition | `api/internal/app/dependencies_authorization_test.go` | `api/internal/app/dependencies_authorization.go` | account resolver, role/permission/principal-version repositories และ evaluator ถูก inject โดยไม่ข้าม account; principal-version adapter เป็น Identity version reader; session-security + authz audit appender ใช้ shared transaction manager |
| W1D `[TDD]` Localization/Audit/Operations composition | `api/internal/app/dependencies_system_test.go` | `api/internal/app/dependencies_system.go` | locale initializer/catalog, append-audit, bootstrap audit และ module-state dependencies ถูก inject และ share transaction manager |
| W2A `[TDD]` health/Identity routes | `api/internal/app/api_routes_identity_test.go` | `api/internal/app/api.go`, `api/internal/app/routes_identity.go` | health, CSRF, login, MFA, recovery และ session routes ครบ generated contract; baseline limiter ครอบ `/api/v1` และ Identity strict policies ถูก attach |
| W2B `[TDD]` Accounts/Authz routes | `api/internal/app/api_routes_authorization_test.go` | `api/internal/app/routes_authorization.go` | current-account/effective-permission/grant/assign/revoke routes ครบ O3A–O3F; permission middleware default deny; self privilege change rotate cookie/CSRF และ stale session ถูก reject |
| W2C `[TDD]` Localization/Operations routes | `api/internal/app/api_routes_system_test.go` | `api/internal/app/routes_system.go`, `api/internal/app/modules.go` | locales/catalog/module routes ครบ; disabled routeไม่ register |
| W3 `[TDD]` readiness composition | `api/internal/app/readiness_test.go` | `api/internal/app/api.go`, `api/internal/platform/httpserver/probe.go` | DB และ module checksum เป็น critical checks; optional providerไม่บังคับ readiness |

- **Verify:** `cd api; go test ./internal/app -race -count=1; go build ./cmd/api ./cmd/migrate ./cmd/bootstrap`
- **Commit boundary:** W1A–W3 แยกหนึ่ง ID ต่อ commit

## Phase U — Vue Admin Foundation

### Task U0 — Scaffold Vue app `[P-U][CFG]`

- **Files:** `admin/package.json`, `admin/pnpm-lock.yaml`, `admin/vite.config.ts`,
  `admin/tsconfig.json`, `admin/tsconfig.app.json`, `admin/tsconfig.node.json`,
  `admin/src/main.ts`, `admin/src/App.vue`,
  `admin/components.json`
- **Change:** Vue + Vite + TypeScript, Vue Router, TanStack Vue Query, Pinia,
  Tailwind/shadcn-vue และ Vitest/Vue Test Utils/Playwright จาก current official sources
- **Verify:** `cd admin; pnpm install --frozen-lockfile; pnpm typecheck; pnpm build`

### Task U1.1 — Acquire immutable Admin contract `[S][TDD]`

- **Files:** `admin/contracts/admin.openapi.lock.json`,
  `admin/tests/architecture/contract-fetch.test.ts`,
  `admin/scripts/contracts/fetch-openapi.mjs`, `admin/.gitignore`
- **Change:** lock API repository, exact commit, artifact path และ SHA-256; fetch exact
  commit ไป temp หรือรับ `--local` sibling input; reject branch-only refs, checksum
  mismatch, absolute/traversal paths และเขียน verified bytes ไป
  `admin/.contracts/admin.openapi.yaml`
- **Verify:** `cd admin; pnpm vitest run tests/architecture/contract-fetch.test.ts`
- **Expected RED:** fetcher missing
- **Expected GREEN:** valid immutable fixture ผ่าน; mutable/mismatch fixtures fail
- **Dependency:** O5 commit ต้องมีอยู่; child CI remote mode รอ API commit ถูก push

### Task U1.2 — Generate API client `[S][GEN]`

- **Files:** `admin/openapi-client.config.ts`, `admin/src/generated/api/**`,
  `admin/src/generated/api/contract.meta.json`
- **Change:** generate จาก verified `admin/.contracts/admin.openapi.yaml`; metadata เก็บ
  repository/commit/path/checksum จาก lock; generated directory ห้าม import จาก
  view/component โดยตรง
- **Verify:** generate ซ้ำแล้ว
  `git -C admin diff --exit-code -- src/generated/api`

ใช้ Task Protocol:

| ID | Test file | Implementation files | Behavior |
|---|---|---|---|
| U2 `[TDD]` runtime config | `admin/tests/unit/runtime-config.test.ts` | `admin/src/app/runtime-config.ts`, `admin/public/config.template.js` | load `/config.js`, require valid `PUBLIC_API_BASE_URL`, validate other public fields และ reject secret-like keys |
| U3 `[TDD]` transport | `admin/tests/unit/api-client.test.ts` | `admin/src/shared/api/client.ts`, `admin/src/shared/api/csrf.ts` | `credentials: include`, CSRF on mutation, request ID; no token storage |
| U4 `[TDD]` errors | `admin/tests/unit/api-error.test.ts` | `admin/src/shared/api/errors.ts` | stable API error → typed UX error; unknown failure safe |
| U5 `[TDD]` query defaults | `admin/tests/unit/query-client.test.ts` | `admin/src/app/query-client.ts` | bounded retry/cache; auth mutationไม่ auto-retry |
| U6 `[TDD]` locale merge | `admin/tests/unit/catalog-merge.test.ts` | `admin/src/i18n/catalog-schema.ts`, `admin/src/i18n/load-catalog.ts`, `admin/src/i18n/merge-catalog.ts`, `admin/src/locales/en/common.json`, `admin/src/locales/en/navigation.json`, `admin/src/locales/en/auth.json`, `admin/src/locales/en/validation.json`, `admin/src/locales/th/common.json`, `admin/src/locales/th/navigation.json`, `admin/src/locales/th/auth.json`, `admin/src/locales/th/validation.json` | DB override > bundle > explicit fallback; category validation |
| U7 `[TDD]` selectable locales | `admin/tests/unit/locale-registry.test.ts` | `admin/src/i18n/locale-registry.ts`, `admin/src/shared/stores/preferences.ts` | switcher แสดง user subset หรือ all; Admin URL ไม่มี locale segment |
| U8 `[TDD]` permission predicate | `admin/tests/unit/permissions.test.ts` | `admin/src/shared/permissions/permissions.ts`, `admin/src/shared/permissions/Can.vue` | exact permission check สำหรับ UX เท่านั้น; default false |
| U9 `[TDD]` module activation | `admin/tests/unit/module-activation.test.ts` | `admin/src/app/modules/manifest.ts`, `admin/src/app/modules/registry.ts`, `admin/src/app/modules/activate.ts` | register เฉพาะ enabled module IDs จาก API |
| U10 `[TDD]` router guards | `admin/tests/routes/guards.test.ts` | `admin/src/app/router/guards/auth.ts`, `admin/src/app/router/guards/permission.ts`, `admin/src/app/router/guards/module.ts` | test routesพิสูจน์ unauthenticated→login, enabled/no permission→403, disabled→404 โดยยังไม่ wire production views |
| U11A `[TDD]` auth API adapter | `admin/tests/unit/auth-client.test.ts` | `admin/src/modules/identity/api/auth.client.ts` | generated client ถูกห่อใน module adapter; pre-auth/login methods คืน typed result |
| U11B `[TDD]` login mutation | `admin/tests/unit/login-mutation.test.ts` | `admin/src/modules/identity/mutations/login.mutation.ts` | fetch CSRF ก่อน login, auth failureไม่ retry และ success invalidates session query |
| U11C `[TDD]` login form | `admin/tests/components/LoginForm.test.ts` | `admin/src/modules/identity/components/LoginForm.vue` | labels, inline+summary errors และ double-submit guard |
| U11D `[TDD]` login view | `admin/tests/components/LoginView.test.ts` | `admin/src/modules/identity/views/LoginView.vue` | compose LoginForm, anonymous-only state และ safe return URL |
| U12 `[TDD]` MFA view | `admin/tests/components/MfaChallenge.test.ts` | `admin/src/modules/identity/views/MfaChallengeView.vue`, `admin/src/modules/identity/components/MfaChallengeForm.vue` | pending-only route, new CSRF, recovery-code mode |
| U13A `[TDD]` shell landmarks | `admin/tests/components/AdminShell.test.ts` | `admin/src/app/layouts/AdminShell.vue`, `admin/src/shared/components/shell/Header.vue` | semantic header/main/navigation landmarks, skip link และ visible focus |
| U13B `[TDD]` responsive navigation | `admin/tests/components/AdminNavigation.test.ts` | `admin/src/shared/components/shell/Sidebar.vue`, `admin/src/shared/components/shell/Header.vue`, `admin/src/shared/components/shell/LocaleSwitcher.vue` | mobile disclosure/keyboard close และ desktop sidebar state |
| U13C `[TDD]` feedback states | `admin/tests/components/FeedbackStates.test.ts` | `admin/src/shared/components/feedback/LoadingState.vue`, `admin/src/shared/components/feedback/ErrorState.vue`, `admin/src/shared/components/feedback/ForbiddenState.vue` | accessible loading, retryable error และ forbidden copy/actions |
| U13D `[TDD]` foundation status view | `admin/tests/components/FoundationStatusView.test.ts` | `admin/src/modules/operations/views/FoundationStatusView.vue` | แสดง current account, selected locale และ enabled module status จาก queriesจริง พร้อม loading/error states |
| U14A `[TDD]` production routes | `admin/tests/routes/core-routes.test.ts` | `admin/src/app/router/index.ts`, `admin/src/app/router/core-routes.ts` | หลัง viewsพร้อมจึง wire Login/MFA, 403/404, authenticated AdminShell และ FoundationStatusView; Admin pathsไม่มี locale segment |
| U14B `[TDD]` bootstrap composition | `admin/tests/unit/bootstrap.test.ts` | `admin/src/app/bootstrap.ts`, `admin/src/main.ts`, `admin/src/modules/identity/queries/session.queries.ts`, `admin/src/modules/operations/api/modules.client.ts`, `admin/src/modules/authorization/api/permissions.client.ts` | หลัง U14A: config → client → public/anonymous routes → CSRF/session; เฉพาะ authenticated session จึงโหลด modules/permissionsและ activate protected routes |
| U15 `[TDD]` import boundary | `admin/tests/architecture/import-boundary.test.ts`, `admin/tests/fixtures/imports/valid-adapter.ts`, `admin/tests/fixtures/imports/invalid-view.vue` | `admin/scripts/check-import-boundaries.mjs` | RED checker missing; GREEN adapter fixture ผ่านและ direct generated import จาก view fixture fail |

- **Verify:** `cd admin; pnpm lint; pnpm typecheck; pnpm test --run; pnpm build`
- **Commit boundary:** U0/U1.1/U1.2 แยก; commit หลัง U2–U15 แต่ละ ID

## Phase S — Astro Public Site Foundation

### Task S0 — Scaffold Astro app `[P-S][CFG]`

- **Files:** `site/package.json`, `site/pnpm-lock.yaml`, `site/astro.config.mjs`,
  `site/tsconfig.json`
- **Change:** strict TypeScript, current supported Node adapter, static-default policy,
  Vitest และ Playwright; dependency versions pin ใน lockfile
- **Verify:** `cd site; pnpm install --frozen-lockfile; pnpm astro check; pnpm build`

### Task S1.1 — Acquire immutable Site contracts `[S][TDD]`

- **Files:** `site/contracts/openapi.lock.json`,
  `site/tests/architecture/contract-fetch.test.ts`,
  `site/scripts/contracts/fetch-openapi.mjs`, `site/.gitignore`
- **Change:** lock/fetch exact API commit + SHA-256 ของ public และ site-server artifacts
  ไป `site/.contracts/public.openapi.yaml` และ
  `site/.contracts/site-server.openapi.yaml`; reject mutable refs/path traversal/mismatch
- **Verify:** `cd site; pnpm vitest run tests/architecture/contract-fetch.test.ts`
- **Expected RED:** fetcher missing
- **Expected GREEN:** two valid artifacts ผ่าน; altered artifact fail
- **Dependency:** O5 commit ต้องมีอยู่; child CI remote mode รอ API commit ถูก push

### Task S1.2 — Generate isolated clients `[S][GEN]`

- **Files:** `site/openapi-client.config.ts`,
  `site/src/api/generated/public/**`, `site/src/api/generated/site-server/**`,
  `site/src/api/contract.meta.json`
- **Change:** generate จาก verified `.contracts` inputs; public และ server-only artifacts
  แยก output/import boundary; metadata ตรง lock
- **Verify:** generate ซ้ำแล้ว no-diff; browser bundle scan ไม่พบ server-only operation

ใช้ Task Protocol:

| ID | Test file | Implementation files | Behavior |
|---|---|---|---|
| S2 `[TDD]` env split | `site/tests/unit/env.test.ts` | `site/src/config/env.ts`, `site/src/config/site.ts` | validate server/public env; reject secret ใน public namespace |
| S3 `[TDD]` locale selection | `site/tests/unit/locale-selection.test.ts` | `site/src/i18n/locale-registry.ts`, `site/src/i18n/select-locale.ts` | Cookie → Accept-Language → system default; enabled only |
| S3A `[TDD]` runtime locale registry | `site/tests/unit/locale-registry.test.ts` | `site/src/api/server-client.ts`, `site/src/cms/cache/locale-cache.ts`, `site/src/i18n/locale-registry.ts` | server-only API fetch, bounded TTL, stale-on-error และ 503 เมื่อไม่มี cache |
| S4 `[TDD]` root redirect | `site/tests/integration/root-route.test.ts` | `site/src/pages/index.astro` | `prerender=false`; `/` 302 ไป selected/default `/{locale}/`; `Vary: Cookie, Accept-Language` |
| S5 `[TDD]` locale availability | `site/tests/unit/availability.test.ts` | `site/src/i18n/availability.ts`, `site/src/i18n/locale-url.ts`, `site/src/middleware.ts` | disabled/unknown locale 404; no content fallback |
| S6 `[TDD]` catalog runtime | `site/tests/unit/catalog-merge.test.ts` | `site/src/i18n/catalog-schema.ts`, `site/src/i18n/load-catalog.ts`, `site/src/i18n/merge-catalog.ts`, `site/src/locales/en/common.json`, `site/src/locales/en/navigation.json`, `site/src/locales/en/marketing.json`, `site/src/locales/en/forms.json`, `site/src/locales/th/common.json`, `site/src/locales/th/navigation.json`, `site/src/locales/th/marketing.json`, `site/src/locales/th/forms.json` | category files แยก; override policy ตรง API |
| S7 `[TDD]` health | `site/tests/integration/healthz.test.ts` | `site/src/pages/healthz.ts` | `/healthz` 200 ไม่มี version/secret/dependency detail |
| S8 `[TDD]` base localized route | `site/tests/integration/locale-route.test.ts` | `site/src/pages/[locale]/index.astro`, `site/src/layouts/BaseLayout.astro`, `site/src/views/HomeView.astro` | route กำหนด `prerender=false`; th/en render lang/canonical ถูกต้อง; locale ใหม่จาก registry resolve ตอน request โดยไม่ rebuild |
| S9 `[TDD]` client boundary | `site/tests/architecture/import-boundary.test.ts`, `site/tests/fixtures/imports/invalid-browser-entry.ts` | `site/src/api/client.ts`, `site/src/api/server-client.ts`, `site/src/api/errors.ts`, `site/scripts/contracts/check-client-boundaries.mjs` | RED checker missing; GREEN browser import server-only client fail และ server wrapperไม่ถูก bundle |

- **Verify:** `cd site; pnpm lint; pnpm astro check; pnpm test --run; pnpm build`
- **Commit boundary:** S0/S1.1/S1.2 แยก; commit หลัง S2–S9/S3A แต่ละ ID

## Phase C — Containers, Local Stack และ InfraStack Contract

### Task C0 — API healthcheck binary `[S][TDD]`

- **Files:** `api/cmd/healthcheck/main_test.go`,
  `api/cmd/healthcheck/main.go`
- **Change:** test injected URL/timeout ก่อน; implementation คืน exit success เฉพาะ
  `/readyz` 2xx, fail เมื่อ timeout/network/non-2xx และไม่พึ่ง shell/curl
- **Verify:** `cd api; go test ./cmd/healthcheck -run '^TestC0$' -count=1`
- **Expected RED:** healthcheck runner missing
- **Expected GREEN:** success/failure/timeout assertions ผ่าน

### Task C1 — API image `[P-C][CFG]`

- **Files:** `api/Dockerfile`, `api/.dockerignore`
- **Change:** multi-stage, pinned non-`latest` bases, numeric non-root user, unprivileged
  port `8080`, binaries `/app/api` + `/app/healthcheck`, minimal runtime และ exec-form
  healthcheck จาก C0
- **Verify:**

```powershell
Set-Location D:\go-lang-starter
docker build --tag go-lang-starter-api:m1-verify --file api/Dockerfile api
docker image inspect --format '{{.Config.User}}|{{json .Config.Healthcheck.Test}}|{{json .Config.ExposedPorts}}' go-lang-starter-api:m1-verify
docker history --no-trunc go-lang-starter-api:m1-verify
```

- **Pass:** build exit `0`; user เป็น numeric non-root; healthcheck คือ exec-form
  `/app/healthcheck`; expose เฉพาะ `8080/tcp`; history ไม่มี secret หรือ `:latest`;
  runtime read-only/cap-drop และ probes ตรวจรวมใน V4

### Task C2.1 — Admin server contract `[P-C][CFG]`

- **Files:** `admin/docker/server.conf`,
  `admin/tests/container/server-config.test.ts`
- **Change:** SPA fallback, `/healthz`, hashed-asset cache, fresh HTML/config headers และ
  alias ของ `/config.js` ไป writable temp path
- **Verify:** `cd admin; pnpm vitest run tests/container/server-config.test.ts`;
  C2.3 build stage ต้องรัน native server config testซ้ำ

### Task C2.2 — Admin runtime config entrypoint `[S][TDD]`

- **Files:** `admin/tests/container/runtime-config.test.ts`,
  `admin/docker/runtime-config.sh`
- **Change:** require/validate `PUBLIC_API_BASE_URL` + public variables แล้วเขียน
  `/tmp/runtime-config/config.js`; ห้าม serialize secret-like keys
- **Verify:** `cd admin; pnpm vitest run tests/container/runtime-config.test.ts -t '^C2\.2$'`;
  จาก parent รัน
  `$env:BASH_PATH='C:\Program Files\Git\bin\bash.exe'; & $env:BASH_PATH -n admin/docker/runtime-config.sh`
- **Expected RED/GREEN:** RED script missing; GREEN public fixture เขียน deterministic
  config และ secret-like key fail โดยไม่ echo value

### Task C2.3 — Admin runtime image `[S][CFG]`

- **Files:** `admin/Dockerfile`, `admin/.dockerignore`
- **Change:** หลัง C2.1–C2.2 พร้อมจึง build multi-stage static server, numeric non-root
  user, unprivileged port `8080` และ writable `/tmp/runtime-config` mount contract
- **Verify:**

```powershell
Set-Location D:\go-lang-starter
docker build --tag go-lang-starter-admin:m1-verify --file admin/Dockerfile admin
docker image inspect --format '{{.Config.User}}|{{json .Config.ExposedPorts}}|{{json .Config.Entrypoint}}' go-lang-starter-admin:m1-verify
```

- **Pass:** build exit `0`; user เป็น numeric non-root; expose เฉพาะ `8080/tcp`;
  entrypoint คือ `runtime-config.sh`; read-only runtime, `/healthz`, no-store config และ
  runtime URL swap ตรวจรวมใน V4

### Task C3 — Site image `[P-C][CFG]`

- **Files:** `site/Dockerfile`, `site/.dockerignore`
- **Change:** Astro Node runtime multi-stage, numeric non-root, unprivileged port
  `4321` และ no build-time secrets
- **Verify:**

```powershell
Set-Location D:\go-lang-starter
docker build --tag go-lang-starter-site:m1-verify --file site/Dockerfile site
docker image inspect --format '{{.Config.User}}|{{json .Config.ExposedPorts}}|{{json .Config.Cmd}}' go-lang-starter-site:m1-verify
```

- **Pass:** build exit `0`; user เป็น numeric non-root; expose เฉพาะ `4321/tcp`;
  image metadata/history ไม่มี secret หรือ `:latest`; read-only `/healthz` และ `/`
  redirect ตรวจรวมใน V4

### Task C4.1 — Local environment contract `[S][CFG]`

- **Files:** `ops/local/.env.example`
- **Change:** dummy-only domains, DB driver/flavor, PostgreSQL/MariaDB/XAMPP profile
  values; proxy trust disabled by default; no Oracle MySQL claim unless profile runs
- **Verify:** secret scanและ required-key check

### Task C4.2 — Local Compose profiles `[S][CFG]`

- **Files:** `ops/local/compose.yml`
- **Change:** API/Admin/Site/fixed `api-migrate`, PostgreSQL and MariaDB profiles;
  XAMPP uses explicit host DSN; frontend servicesไม่ต่อ `backend`; app services ใช้
  numeric user, `read_only`, explicit `tmpfs`, `cap_drop: [ALL]` และ
  `no-new-privileges`; Admin รับ process override `PUBLIC_API_BASE_URL`;
  local HTTP bindings คือ `127.0.0.1:18080`, `:18081`, `:18082`
- **Verify:**
  `docker compose --env-file ops/local/.env.example -f ops/local/compose.yml --profile postgres config --quiet`
  และ command เดิมด้วย `--profile mariadb`
- **Pass:** ทั้งสอง command exit `0`; no host-published DB port unless local profile
  explicitly needs it; Admin/Site ไม่ join `backend`

### Task C4.3 — Local development guide `[P-C][CFG]`

- **Files:** `docs/operations/local-development.md`
- **Change:** clean clone, profile selection, XAMPP host access, migrate/bootstrap,
  service URLs และ teardown ที่ไม่ลบ volumes โดยปริยาย
- **Verify:** commands ในเอกสารตรงกับ Compose service/profile names

### Task C5.1A — InfraStack API template `[S][CFG]`

- **Files:** `ops/infra-stack/api/docker-compose.yml`,
  `ops/infra-stack/api/.env.example`
- **Change:** API ต่อ `proxy`+`backend`, fixed `api-migrate` ต่อ `backend` เท่านั้น,
  runtime service/`ROLLOUT_SERVICE` ชื่อ `api`, `DEPLOY_HEALTH_URL` จบด้วย `/readyz`,
  no host ports/`container_name`, per-project credentials และ immutable image
  variables: `APP_IMAGE` เป็น release tag สำหรับ InfraStack compatibility,
  `APP_IMAGE_DIGEST_REF` เป็น runtime digest และ `MIGRATE_IMAGE` ต้องเป็น digest เดียวกัน;
  example กำหนด exact `DEPLOY_MIGRATE=0` และ explicit `TRUSTED_PROXY_CIDRS`
  ที่แคบตาม proxy network รวมถึง `INITIAL_LOCALES`/`DEFAULT_LOCALE`;
  API/migrate ใช้ numeric user, `read_only`, explicit `tmpfs`,
  `cap_drop: [ALL]`, `no-new-privileges` และ resource limits
- **Verify:** render templateด้วย fixture env; network/health/label/hardening assertions
  ผ่าน

### Task C5.1B — InfraStack Admin template `[S][CFG]`

- **Files:** `ops/infra-stack/admin/docker-compose.yml`,
  `ops/infra-stack/admin/.env.example`
- **Change:** `proxy` only, `/healthz`, exact subdomain/security middleware, runtime
  service/`ROLLOUT_SERVICE` ชื่อ `admin`, absolute `DEPLOY_HEALTH_URL` จบด้วย `/healthz`,
  public config, `APP_IMAGE` release tag + `APP_IMAGE_DIGEST_REF` runtime digest,
  exact `DEPLOY_MIGRATE=0`, numeric user, `read_only`, config `tmpfs`,
  `cap_drop: [ALL]`, `no-new-privileges` และ resource limits
- **Verify:** render template; ไม่มี `backend`, host port หรือ secret-like public key;
  hardening fields ครบ

### Task C5.1C — InfraStack Site template `[S][CFG]`

- **Files:** `ops/infra-stack/site/docker-compose.yml`,
  `ops/infra-stack/site/.env.example`
- **Change:** `proxy` only, `/healthz`, public subdomain/security middleware และ
  runtime service/`ROLLOUT_SERVICE` ชื่อ `site`, absolute `DEPLOY_HEALTH_URL` จบด้วย
  `/healthz`, internal API URL บน shared proxy network; `APP_IMAGE` release tag +
  `APP_IMAGE_DIGEST_REF` runtime digest, exact `DEPLOY_MIGRATE=0`, numeric user,
  `read_only`, explicit `tmpfs`,
  `cap_drop: [ALL]`, `no-new-privileges` และ resource limits
- **Verify:** render template; ไม่มี `backend`, host port หรือ `container_name`;
  hardening fields ครบ

production CLI contract ของ wrapper คือ:

```text
./scripts/deploy-infra-stack.sh \
  --infra-stack-dir /absolute/path/to/infra-stack \
  --release-manifest ./releases/suite-v<version>.yaml \
  --api-project <name> \
  --admin-project <name> \
  --site-project <name>
```

ทำ C5.2A–C5.5E ด้วย Task Protocol โดยเพิ่มทีละ assertion ใน
`integration/tests/deploy-contract.test.ts`:

| ID | Test file | Implementation files | Behavior |
|---|---|---|---|
| C5.2A `[TDD]` CLI/containment/revision | `integration/tests/deploy-contract.test.ts` | `scripts/deploy-infra-stack.sh`, `scripts/deploy/parse-inputs.mjs`, `scripts/deploy/validate-infra-checkout.mjs` | require exact five flags; reject relative/non-canonical InfraStack path, invalid project name, symlink/path escape และ manifest นอก parent `releases/`; manifest pin ต้องเท่ากับ checkout `HEAD`; tracked worktree/index ต้อง clean; `scripts/deploy.sh` ต้องเป็น regular executable, index mode `100755` และ worktree bytes ตรง pinned blob |
| C5.2B `[TDD]` registry-only target preflight | `integration/tests/deploy-contract.test.ts` | `scripts/deploy-infra-stack.sh`, `scripts/deploy/validate-target-contract.mjs` | ก่อน Docker/deploy: target ทั้งสามต้องมี `.env` + compose, ไม่มี `src/.git`, มี exact single `DEPLOY_MIGRATE=0`; `DEPLOY_HEALTH_URL` ต้องเป็น credential-free HTTPS URL และ path ตรง service; API compose ต้องมี fixed `api-migrate`; wrapperไม่ export/แก้ค่าแทน |
| C5.2C `[TDD]` rendered target contract | `integration/tests/deploy-contract.test.ts` | `scripts/deploy/validate-target-contract.mjs` | parse `docker compose --env-file <target>/.env -f <target>/docker-compose.yml config --format json`; reject `build`/`pull_policy: build`, host ports, `container_name`, wrong networks/health/service names และ missing numeric user/read-only/tmpfs/drop-ALL/no-new-privileges/resource limits |
| C5.3 `[TDD]` immutable image parity/pull | `integration/tests/deploy-contract.test.ts` | `scripts/deploy/verify-image-parity.mjs` | แต่ละ `APP_IMAGE` release tag resolve ตรง manifest OCI digest; target `.env` `APP_IMAGE_DIGEST_REF` = manifest digest = rendered runtime image; API `MIGRATE_IMAGE`/rendered migrate image เท่ากัน; หลัง preflight ทั้งหมดจึง pull exact digest refs, require `RepoDigests` มี ref นั้น และบันทึก local config `.Id` |
| C5.4 `[TDD]` migration-first workload | `integration/tests/deploy-contract.test.ts` | `scripts/deploy-infra-stack.sh` | หลัง verified digest pulls, first workload-changing command คือ `docker compose --env-file <api-target>/.env -f <api-target>/docker-compose.yml run --rm --no-deps api-migrate`; non-zero คืน code เดิมและไม่เรียก deploy |
| C5.5A `[TDD]` API handoff/readiness | `integration/tests/deploy-contract.test.ts` | `scripts/deploy-infra-stack.sh`, `scripts/deploy/verify-running-release.mjs` | หลัง migrate สำเร็จเรียก exact `scripts/deploy.sh <api-project>` ครั้งเดียว แล้ว poll `DEPLOY_HEALTH_URL` `/readyz` ด้วย hard deadline 60s/request timeout 3s/interval 2s; helper resolve digest ref เป็น local image `.Id`, require exact ref ใน `RepoDigests` และ container `api` ทุกตัวมี `.Image` เท่ากับ local `.Id` ก่อนทำต่อ |
| C5.5B `[TDD]` Admin handoff/readiness | `integration/tests/deploy-contract.test.ts` | `scripts/deploy-infra-stack.sh`, `scripts/deploy/verify-running-release.mjs` | หลัง API ผ่านจึง deploy Admin ครั้งเดียว แล้วใช้ deadline/request/interval เดียวกับ C5.5A ตรวจ `/healthz` + running `admin` image-ID parity |
| C5.5C `[TDD]` Site handoff/readiness | `integration/tests/deploy-contract.test.ts` | `scripts/deploy-infra-stack.sh`, `scripts/deploy/verify-running-release.mjs` | หลัง Admin ผ่านจึง deploy Site ครั้งเดียว แล้วใช้ deadline/request/interval เดียวกับ C5.5A ตรวจ `/healthz` + running `site` image-ID parity |
| C5.5D `[TDD]` failure propagation | `integration/tests/deploy-contract.test.ts` | `scripts/deploy-infra-stack.sh` | deploy/health/digest check ใด non-zero หรือ timeout ต้องคืน non-zero และไม่เรียก target ถัดไป |
| C5.5E `[TDD]` no target mutation | `integration/tests/deploy-contract.test.ts` | `scripts/deploy-infra-stack.sh`, `scripts/deploy/hash-target-files.mjs` | SHA-256 ของ target `.env`/compose ทั้งสามก่อนและหลัง success/failure เท่าเดิม |

- **Wrapper verify:**
  `$env:BASH_PATH='C:\Program Files\Git\bin\bash.exe'; & $env:BASH_PATH -n scripts/deploy-infra-stack.sh`;
  `shellcheck scripts/deploy-infra-stack.sh`;
  `pnpm vitest run integration/tests/deploy-contract.test.ts`
- **Safety:** ทุก preflight รวม manifest validation/revision/image parity ต้องผ่านก่อน
  `docker compose run` หรือ `deploy.sh`; wrapper ห้ามแก้ Git safe-directory/global config

### Task C6 — InfraStack documentation `[S]`

- **Files:** `docs/operations/infra-stack.md`
- **Change:** networks (`proxy`, `backend`, optional `monitoring`), subdomains, per-project
  credentials, `/readyz`, security headers, metrics target, DB/media backups และ current
  PHP migration gap; manual template-install step ต้องสร้าง target `.env` จาก example
  ที่มี exact `DEPLOY_MIGRATE=0`, registry-only mode, immutable digest refs และ
  `DEPLOY_HEALTH_URL` ก่อนใช้ wrapper; อธิบาย bounded readiness/running-digest gate,
  `deploy.sh` image-prune behavior และ wrapper ไม่แก้ target files
- **Verify:** `rg -n "api-migrate|DEPLOY_MIGRATE=0|proxy|backend|readyz|MariaDB|backup" docs/operations/infra-stack.md`
- **Boundary:** ไม่แก้ `D:\infra-stack` ใน milestone นี้

Phase C commit boundaries:

- API child: C0 หลัง RED/GREEN/REFACTOR และ C1 เป็น config commit แยก
- Admin child: C2.1, C2.2, C2.3 แยกตาม responsibility
- Site child: C3 เป็น config commit หลัง image smoke ผ่าน
- Parent: C4.1–C4.3, C5.1A–C5.1C, C5.2A–C5.5E และ C6 แยกหนึ่ง ID ต่อ commit

## Phase CI — Child และ Suite Quality Gates

### Task CI1.1 — API code CI `[S][CFG]`

- **Files:** `api/.github/workflows/ci.yml`
- **Change:** format/vet/lint/unit/race, PostgreSQL/MariaDB migration matrix, security
  tests, build และ secret/dependency scan
- **Verify:** validate workflow YAML; local commandsทุกคำสั่งผ่าน

### Task CI1.2 — API contract CI `[S][CFG]`

- **Files:** `api/.github/workflows/contract.yml`
- **Change:** OpenAPI lint/bundle/generate no-diff และ surface-isolation tests
- **Verify:** workflow lint; `cd api; pnpm openapi:check`

### Task CI1.3 — API container CI `[S][CFG]`

- **Files:** `api/.github/workflows/container.yml`
- **Change:** build, image scan, non-root/read-only/health smoke
- **Verify:** workflow lint; local C1 command parity

### Task CI2.1 — Admin code CI `[P-CI][CFG]`

- **Files:** `admin/.github/workflows/ci.yml`
- **Change:** frozen install, lint/typecheck/unit/component/build และ accessibility smoke
- **Verify:** local command parity ผ่าน; hosted result pending push

### Task CI2.2 — Admin contract CI `[S][CFG]`

- **Files:** `admin/.github/workflows/contract.yml`
- **Change:** fetch exact API commit จาก lock, verify checksum, generate-client no-diff
  และ import-boundary test โดยไม่พึ่ง sibling checkout
- **Verify:** workflow lint; local U1.1/U1.2/U15 parity

### Task CI2.3 — Admin container CI `[S][CFG]`

- **Files:** `admin/.github/workflows/container.yml`
- **Change:** image scan, non-root/read-only/runtime-config/health checks
- **Verify:** workflow lint; local C2.1–C2.3 parity

### Task CI3.1 — Site code CI `[P-CI][CFG]`

- **Files:** `site/.github/workflows/ci.yml`
- **Change:** frozen install, lint/Astro check/tests/build และ locale/SEO smoke
- **Verify:** local command parity ผ่าน

### Task CI3.2 — Site contract CI `[S][CFG]`

- **Files:** `site/.github/workflows/contract.yml`
- **Change:** fetch exact API commit จาก lock, verify checksums, generated no-diff,
  public/server boundary และ rendering contract โดยไม่พึ่ง sibling checkout
- **Verify:** workflow lint; local S1.1/S1.2/S9 parity

### Task CI3.3 — Site container CI `[S][CFG]`

- **Files:** `site/.github/workflows/container.yml`
- **Change:** image scan, non-root/read-only/root-redirect/health checks
- **Verify:** workflow lint; local C3 parity

### Task CI4.1 — Parent browser tooling `[S][CFG]`

- **Files:** `integration/playwright.config.ts`, `package.json`, `pnpm-lock.yaml`
- **Change:** add pinned Playwright toolingและ `test:e2e` script โดย parent ยัง dev-only
- **Verify:** `pnpm install --frozen-lockfile`; Playwright lists E1–E4

### Task CI4.2 — Suite compatibility workflow `[S][CFG]`

- **Files:** `.github/workflows/suite-compatibility.yml`
- **Change:** recursive checkout, start selected DB profile, migrate/reconcile, boot
  services, run cross-project E2E และ always collect sanitized logs
- **Verify:** workflow lint; commands ตรง local Compose/parent scripts

ใช้ Task Protocol:

| ID | Test file | Implementation files | Behavior |
|---|---|---|---|
| E1 `[QA]` login/session | `integration/tests/authentication.spec.ts` | ไม่มี production file | CSRF → password → MFA/pending if enabled → rotated auth session → logout/reuse fail |
| E2 `[QA]` permission | `integration/tests/access-control.spec.ts` | ไม่มี production file | no grant/foreign account 403; held permission succeeds; disabled module 404 |
| E3 `[QA]` locale | `integration/tests/localization.spec.ts` | ไม่มี production file | add/enable locale via system API, DB override catalog, user subset/all switch; Admin URLไม่เพิ่ม locale |
| E4 `[QA]` public locale | `integration/tests/public-locale.spec.ts` | ไม่มี production file | `/` selects locale; `/{locale}/` works; disabled/missing locale 404 |

- **Commit boundaries:** CI1.1–CI3.3 แยกหนึ่ง workflow ต่อ commit; CI4.1 และ CI4.2
  แยก; E1–E4 แยก test-only commit
- **Parent rule:** อัปเดต gitlink หลัง child commit ที่อ้างถึงผ่านแล้วเท่านั้น

## Phase V — Verification Before Milestone Completion

### Task V1 — API full verification `[S]`

- **Files:** `api/`
- **Change:** ไม่มี; verification-only บน exact API worktree/lockfiles

```powershell
Set-Location D:\go-lang-starter\api
gofmt -l .
go vet ./...
go test ./... -count=1
go test ./... -race -count=1
go build ./cmd/api ./cmd/migrate ./cmd/bootstrap ./cmd/healthcheck
pnpm openapi:lint
pnpm openapi:check
```

- **Pass:** exit `0`, `gofmt -l` ไม่มี output, generated no-diff

### Task V2 — Database evidence `[S]`

- **Files:** `docs/operations/database-support.md`
- **Change:** บันทึก engine/version, command, timestamp, result และ failure link ของ
  PostgreSQL, MariaDB CI, local XAMPP และ Oracle MySQL แยกกัน
- **Verify:** migration `up -> down -> up`, repositories และ security suite ผ่าน
  PostgreSQL/MariaDB; Oracle status ตรงหลักฐานและไม่ถูก advertise หากไม่ผ่าน

### Task V3 — Frontend full verification `[P-V]`

- **Files:** `admin/`, `site/`
- **Change:** ไม่มี; verification-only บน exact child worktrees/lockfiles

```powershell
Set-Location D:\go-lang-starter\admin
pnpm lint
pnpm typecheck
pnpm test --run
pnpm build

Set-Location D:\go-lang-starter\site
pnpm lint
pnpm astro check
pnpm test --run
pnpm build
```

- **Pass:** ทุก command exit `0`; browser/server import boundary ผ่าน

### Task V4 — Container/Compose verification `[P-V]`

- **Files:** `api/Dockerfile`, `admin/Dockerfile`, `site/Dockerfile`,
  `api/compose.dev.yml`, `ops/local/.env.example`, `ops/local/compose.yml`,
  `ops/infra-stack/api/.env.example`, `ops/infra-stack/api/docker-compose.yml`,
  `ops/infra-stack/admin/.env.example`, `ops/infra-stack/admin/docker-compose.yml`,
  `ops/infra-stack/site/.env.example`, `ops/infra-stack/site/docker-compose.yml`,
  `scripts/deploy-infra-stack.sh`, `scripts/deploy/parse-inputs.mjs`,
  `scripts/deploy/validate-infra-checkout.mjs`,
  `scripts/deploy/validate-target-contract.mjs`,
  `scripts/deploy/verify-image-parity.mjs`,
  `scripts/deploy/verify-running-release.mjs`,
  `scripts/deploy/hash-target-files.mjs`,
  `integration/tests/deploy-contract.test.ts`
- **Change:** ไม่มี; verification-only
- **Verify config/templates:**

```powershell
Set-Location D:\go-lang-starter
$env:BASH_PATH = 'C:\Program Files\Git\bin\bash.exe'
if (-not (Test-Path -LiteralPath $env:BASH_PATH -PathType Leaf)) { throw 'BASH_PATH missing' }
docker compose --env-file ops/local/.env.example -f ops/local/compose.yml --profile postgres config --quiet
docker compose --env-file ops/local/.env.example -f ops/local/compose.yml --profile mariadb config --quiet
docker compose --env-file ops/infra-stack/api/.env.example -f ops/infra-stack/api/docker-compose.yml config --quiet
docker compose --env-file ops/infra-stack/admin/.env.example -f ops/infra-stack/admin/docker-compose.yml config --quiet
docker compose --env-file ops/infra-stack/site/.env.example -f ops/infra-stack/site/docker-compose.yml config --quiet
& $env:BASH_PATH -n scripts/deploy-infra-stack.sh
shellcheck scripts/deploy-infra-stack.sh
pnpm vitest run integration/tests/deploy-contract.test.ts
```

- **Verify both database profiles:**

```powershell
Set-Location D:\go-lang-starter
Add-Type -AssemblyName System.Net.Http
$redirectHandler = New-Object System.Net.Http.HttpClientHandler
$redirectHandler.AllowAutoRedirect = $false
$redirectClient = New-Object System.Net.Http.HttpClient -ArgumentList (,$redirectHandler)
try {
  foreach ($profile in @('postgres', 'mariadb')) {
    $composeArgs = @(
      'compose', '--env-file', 'ops/local/.env.example',
      '-f', 'ops/local/compose.yml', '--profile', $profile
    )
    $env:PUBLIC_API_BASE_URL = 'https://api-one.invalid'
    try {
      & docker @composeArgs up -d $profile
      if ($LASTEXITCODE -ne 0) { throw "database start failed: $profile" }
      & docker @composeArgs run --rm api-migrate
      if ($LASTEXITCODE -ne 0) { throw "migration failed: $profile" }
      & docker @composeArgs up -d --build --wait api admin site
      if ($LASTEXITCODE -ne 0) { throw "application start failed: $profile" }

      foreach ($service in @('api', 'admin', 'site')) {
        $containerID = (& docker @composeArgs ps -q $service).Trim()
        if (-not $containerID) { throw "missing container: $service" }
        $hardening = & docker inspect --format '{{.Config.User}}|{{.HostConfig.ReadonlyRootfs}}|{{json .HostConfig.Tmpfs}}|{{json .HostConfig.CapDrop}}|{{json .HostConfig.SecurityOpt}}' $containerID
        if ($LASTEXITCODE -ne 0) { throw "inspect failed: $service" }
        $parts = $hardening -split '\|', 5
        if ($parts[0] -notmatch '^\d+(?::\d+)?$' -or
            $parts[1] -ine 'true' -or $parts[2] -in @('null', '{}') -or
            $parts[3] -notmatch '"ALL"' -or
            $parts[4] -notmatch 'no-new-privileges') {
          throw "hardening mismatch: $service"
        }
      }

      foreach ($url in @(
        'http://127.0.0.1:18080/livez',
        'http://127.0.0.1:18080/readyz',
        'http://127.0.0.1:18081/healthz',
        'http://127.0.0.1:18082/healthz'
      )) {
        if ((Invoke-WebRequest -UseBasicParsing $url).StatusCode -ne 200) {
          throw "health failed: $url"
        }
      }

      $configOne = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18081/config.js
      if ($configOne.Headers['Cache-Control'] -notmatch 'no-store' -or
          $configOne.Content -notmatch [regex]::Escape($env:PUBLIC_API_BASE_URL)) {
        throw 'first runtime config mismatch'
      }

      if ($profile -eq 'postgres') {
        $adminIDOne = (& docker @composeArgs ps -q admin).Trim()
        $adminImageOne = (& docker inspect --format '{{.Image}}' $adminIDOne).Trim()
        $env:PUBLIC_API_BASE_URL = 'https://api-two.invalid'
        & docker @composeArgs up -d --no-deps --force-recreate --wait admin
        if ($LASTEXITCODE -ne 0) { throw 'admin runtime-config recreate failed' }
        $adminIDTwo = (& docker @composeArgs ps -q admin).Trim()
        $adminImageTwo = (& docker inspect --format '{{.Image}}' $adminIDTwo).Trim()
        $configTwo = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18081/config.js
        if ($adminImageOne -ne $adminImageTwo -or
            $configOne.Content -eq $configTwo.Content -or
            $configTwo.Headers['Cache-Control'] -notmatch 'no-store' -or
            $configTwo.Content -notmatch [regex]::Escape($env:PUBLIC_API_BASE_URL)) {
          throw 'runtime config did not change on the same image'
        }
      }

      $rootResponse = $redirectClient.GetAsync('http://127.0.0.1:18082/').GetAwaiter().GetResult()
      try {
        if ([int]$rootResponse.StatusCode -ne 302) { throw 'Site root did not return 302' }
      }
      finally {
        $rootResponse.Dispose()
      }
    }
    finally {
      & docker @composeArgs down
      Remove-Item Env:PUBLIC_API_BASE_URL -ErrorAction SilentlyContinue
    }
  }
}
finally {
  $redirectClient.Dispose()
  $redirectHandler.Dispose()
}
```

- **Pass:** ทุก command exit `0`; inspect output ของ app ทั้งสามมี numeric user,
  `ReadonlyRootfs=True`, non-empty `Tmpfs`, `CapDrop=["ALL"]` และ
  `SecurityOpt` มี `no-new-privileges`; probes คืน 200, Site `/` คืน 302,
  initial locales ทำให้ clean-stack `/` redirect ได้, Admin config เป็น `no-store`
  และเปลี่ยน URLด้วย image ID เดิม; deploy-contract พิสูจน์ migration/deploy failure
  propagation; render/history ไม่มี `latest`, host DB port หรือ secret
- **Teardown:** ใช้ `docker compose down` เท่านั้นใน verification ปกติ ห้าม `-v`

### Task V5.1 — Structural checker RED `[S][TDD]`

- **Files:** `integration/tests/structure.test.ts`,
  `integration/fixtures/structure/oversized-go.go`,
  `integration/fixtures/structure/oversized-view.vue`
- **Change:** เพิ่มทีละ assertionว่า oversized handwritten backend/view และ generated
  file classification ต้องถูกตรวจ
- **Verify:** `pnpm test:release -- structure`
- **Expected RED:** `scripts/quality/check-structure.mjs` ยังไม่มี

### Task V5.2 — Structural checker GREEN `[S][TDD]`

- **Files:** `scripts/quality/check-structure.mjs`,
  `integration/tests/structure.test.ts`
- **Change:** วัดเฉพาะ handwritten files; backend ceiling, handler action count,
  Vue/Astro view/component target และ generated-directory exclusions
- **Verify:** `pnpm test:release -- structure`; รายงาน largest files ต่อ child
- **Pass:** ไม่มี unapproved deviation หรือ cosmetic hub

### Task V6 — Suite verification `[S]`

- **Files:** parent worktree และ gitlinks `api`, `admin`, `site`
- **Change:** ไม่มี; verification-only

```powershell
Set-Location D:\go-lang-starter
pnpm install --frozen-lockfile
pnpm test:release
pnpm test:e2e
git diff --check
git submodule status --recursive
git status --short
```

- **Pass:** critical flows E1–E4 ผ่านบน PostgreSQL และ MariaDB profile, child worktrees
  สะอาด, parent gitlinks ชี้ commits ที่ผ่าน tests

### Task V7 — Milestone handoff `[S]`

- **Files:** `docs/operations/milestone-1-verification.md`
- **Change:** บันทึก exact commands/results, skipped/conditional profiles, structural
  metrics, risks และ unresolved external CI/container evidence
- **Verify:** reviewer เทียบ evidence กับ exit gate ของ master plan
- **Rule:** ห้ามใช้คำว่า complete หาก command ใดที่จำเป็นยังไม่ได้รันหรือ fail

## Parallelizable Lanes

- หลัง R6 และ A0.1–A0.3: Phase A, D และ O ทำขนานได้ แต่ dependency updates ใน
  `api/go.mod`, `api/go.sum`, `api/package.json`, `api/pnpm-lock.yaml` ต้อง serialize
- Phase U และ S ทำขนานกันได้หลัง O5 สร้าง artifacts
- Phase Q และ L ทำขนานกันได้หลัง migrations/OpenAPI ที่เกี่ยวข้องพร้อม
- Q11B–Q11C รอ I12/I17A และ Q11A; W1C/W2B รอ privilege-session slices ผ่าน
- Phase M รอ D, Q, L1D และ operations migration; MR7 ห้ามเริ่มก่อน L1D GREEN
- Phase AU รอ I, Q, L และ M; Phase W รอ AU
- U1.1/S1.1 ใช้ local verified artifacts ได้ แต่ child CI รอ API artifact commit
  ถูก push ไป exact remote
- U14A รอ U11D/U12/U13A–U13D; U14B รอ U14A แล้วจึงแก้ `bootstrap.ts`/`main.ts`
- C1, C2.1–C2.3 และ C3 ทำขนานกันได้หลัง child build ผ่าน
- C5.2A–C5.5E รอ R8–R11, C5.1A–C5.1C และ verified InfraStack revision
- CI2 และ CI3 ทำขนานกันได้; CI4 รอ child workflows/boot commands คงที่
- E2 รอ Q/M; E3 รอ L/U; E4 รอ L/S
- V1–V4 ทำขนานได้ แล้ว V5–V7 ทำตามลำดับ

## Commit Order

1. parent docs/repository bootstrap
2. child API platform
3. child API schema/contracts
4. child API identity/authorization/localization/modules
5. child Admin foundation
6. child Site foundation
7. child CI/container changes
8. parent integration/ops changes
9. parent gitlink updates

ทุก commit ต้องเกิดหลัง targeted GREEN และ relevant package suite ผ่าน ห้าม parent
commit child working tree content, ห้าม tag/push/publish/deploy ในแผน execution โดยไม่มี
authorization และห้ามสร้าง real suite manifest จน child tags/images/digests มีจริง
