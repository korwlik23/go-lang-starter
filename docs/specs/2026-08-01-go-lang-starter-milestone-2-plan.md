# Implementation Plan: `go-lang-starter` Milestone 2 — Administration

Design refs:

- `docs/specs/2026-07-27-go-lang-starter-design.md`
- `docs/specs/2026-07-27-go-lang-starter-implementation-plan.md`
- `docs/specs/2026-07-27-go-lang-starter-milestone-1-plan.md`

## เป้าหมายและขอบเขต

Milestone 1 foundation ผ่าน verification แล้ว และ API มี current-account,
effective-permission, locale/catalog, module projection และ transactional role
grant/assignment/revoke primitives อยู่แล้ว แผนนี้เติม Back Office ที่ใช้จริงเป็น
vertical slices โดยให้ server เป็น source of truth, ใช้ permission key แบบ dynamic
(ไม่ hardcode role) และรักษา parent + `api` + `admin` + `site` เป็น Git repositories
แยก version กัน

เป้าหมายของ M2 คือทำให้ flow นี้ใช้งานได้ end-to-end ก่อน:

`สร้าง/แก้ไข account role → grant permission → assign ให้ membership → ตรวจ permission boundary → revoke`

จากนั้นจึงต่อ user/membership administration, locale/catalog editor, audit query และ
operations read model โดยทุก screen ต้องมี loading, empty, error, retry และ forbidden
state และทุก write ต้องมี optimistic version, audit และ server-side authorization

ไม่รวมในแผนนี้: CMS/public publishing, media upload, SEO/GEO/AEO content workflow,
optional modules (API keys, webhooks, search, analytics, OIDC/JWT) และการแก้ไข
`D:\infra-stack` โดยตรง ซึ่งอยู่ใน Milestone 3–4 ตาม master plan

## ทางเลือกและคำแนะนำ

1. **Generic CRUD ก่อน** — ทำเร็วในช่วงแรก แต่ทำให้ permission, scope, audit และ
   error states กระจายไม่ชัด และขัดกับ bounded-context layout
2. **ทำ API ทุก resource ให้ครบก่อนค่อยทำ UI** — contract ชัด แต่ feedback loop ยาว
   และเสี่ยงมี endpoint ที่ไม่ตอบโจทย์การใช้งานจริง
3. **Vertical slices ตาม bounded context (แนะนำ)** — ทำ authorization flow ให้จบ
   ทั้ง API, generated contract, Admin view และ integration test ก่อน แล้วใช้ pattern
   เดียวกันกับ users/locales/audit; ลดความเสี่ยงและตรวจได้ทีละ release boundary

## กติกาข้ามทุก task

- ใช้ TDD: เขียน failing test ก่อน implementation และคง test ไว้ใน bounded context เดียวกัน
- ใช้ permission key จาก module catalog; ห้ามตรวจ `role == "..."` หรือสร้าง fixed role
- ทุก mutation ใช้ strict JSON, CSRF/session guard, request ID, optimistic version และ
  transaction; audit event ต้อง append ใน transaction เดียวกับ mutation
- ห้ามรับ actor/user ID จาก client หากค่าดังกล่าวควรได้จาก authenticated principal
- generated API clients และ `contract.meta.json` ต้องสร้างด้วย script ของ repository;
  ห้ามแก้ generated schema ด้วยมือ
- หนึ่งไฟล์หนึ่งความรับผิดชอบ; controller ไม่เกินประมาณ 7 actions และไม่มี god module

## Phase A — Authorization administration (first vertical slice)

### Task A1 — ตรึง permission catalog และ contract shape

- **Files:**
  `api/internal/modules/authorization/permissions.go`,
  `api/internal/app/modules_test.go`,
  `api/openapi/modules/authorization/roles.yaml`,
  `api/openapi/root.yaml`,
  `api/tests/contract/authorization_roles_http_test.go`
- **Change:** เพิ่ม permission keys สำหรับ role read/manage และ assignment read
  โดยระบุ scope/tier/delegable ใน manifest; กำหนด response envelope, cursor และ
  stable error codes สำหรับ list/create/update role, list role permissions และ list
  assignments; ไม่เปลี่ยน contract ของ grant/assign/revoke เดิม
- **Verify:** `cd api; go test ./internal/app ./tests/contract -run 'Authorization|Role' -count=1`

### Task A2 — Role query repository

- **Files:**
  `api/internal/modules/authorization/ports/role_query_repository.go`,
  `api/internal/modules/authorization/adapters/gorm/role_query_repository.go`,
  `api/internal/modules/authorization/adapters/gorm/role_query_repository_test.go`
- **Change:** เพิ่ม deterministic, bounded list ของ system/account roles พร้อม
  cursor `(created_at,id)` และ query role permissions/assignments ที่ enforce account
  scope ใน SQL; ใช้ dialect-safe binary ID encoding และไม่คืน secret/ข้อมูลนอก scope
- **Verify:** `cd api; go test ./internal/modules/authorization/adapters/gorm -run 'RoleQuery' -count=1`

### Task A3 — Role command service

- **Files:**
  `api/internal/modules/authorization/application/manage_roles.go`,
  `api/internal/modules/authorization/application/manage_roles_test.go`,
  `api/internal/modules/authorization/ports/role_command_repository.go`
- **Change:** เพิ่ม create account role และ update role name ด้วย expected version;
  ตรวจ permission, account ownership, input length/whitespace, duplicate name policy
  และ audit success ภายใน transaction; ห้าม hard-delete role ที่มี assignment
- **Verify:** `cd api; go test ./internal/modules/authorization/application -run 'Role|role' -count=1`

### Task A4 — Role HTTP handlers/routes

- **Files:**
  `api/internal/modules/authorization/transport/http/role_handler.go`,
  `api/internal/modules/authorization/transport/http/role_handler_test.go`,
  `api/internal/modules/authorization/transport/http/routes.go`,
  `api/internal/app/routes_authorization.go`
- **Change:** expose role list/create/update, role-permission read และ assignment
  read ด้วย strict decoder, request ID, permission middleware, stable pagination และ
  409 สำหรับ stale version; ใช้ existing assign/revoke handlersเป็น write path เดียว
- **Verify:** `cd api; go test ./internal/modules/authorization/transport/http ./internal/app -run 'Role|Authorization' -count=1`

### Task A5 — Generated contract and Admin API clients

- **Files:**
  `admin/contracts/admin.openapi.lock.json`,
  `admin/src/generated/api/contract.meta.json`,
  `admin/src/generated/api/schema.ts`,
  `admin/src/modules/authorization/api/roles.client.ts`,
  `admin/src/modules/authorization/queries/roles.queries.ts`,
  `admin/src/modules/authorization/mutations/roles.mutations.ts`
- **Change:** fetch/generate client จาก API artifact revision ที่ pin แล้ว; เพิ่ม query
  key ที่แยก scope/role/version และ mutation wrappers ที่ map 401/403/409/422 เป็น
  typed UI errors; ไม่แก้ generated files ด้วยมือ
- **Verify:** `cd admin; pnpm contract:fetch --help; pnpm typecheck; pnpm test:run tests/architecture/contract-fetch.test.ts`

### Task A6 — Admin role and assignment screens

- **Files:**
  `admin/src/modules/authorization/views/RolesView.vue`,
  `admin/src/modules/authorization/views/RoleAssignmentsView.vue`,
  `admin/src/modules/authorization/components/RoleForm.vue`,
  `admin/src/modules/authorization/components/AssignmentTable.vue`,
  `admin/src/app/router/core-routes.ts`,
  `admin/src/app/modules/manifest.ts`,
  `admin/src/locales/en/navigation.json`,
  `admin/src/locales/th/navigation.json`
- **Change:** ทำ role list/create/edit และ assignment/revoke flow ให้ใช้ `Can`/route
  permission guard; แยก system/account scope; แสดง version conflict ให้ retry และ
  ไม่ optimistic-update สิทธิ์จนกว่าจะได้รับ server response; ครบ loading/empty/error/
  forbidden/long-content states และ keyboard-accessible controls
- **Verify:** `cd admin; pnpm test:run tests/modules/authorization tests/router; pnpm lint; pnpm typecheck; pnpm build`

### Task A7 — Authorization end-to-end boundary

- **Files:**
  `integration/tests/authorization-admin-flow.test.ts`,
  `api/tests/security/authorization_admin_flow_test.go`,
  `admin/tests/e2e/authorization-flow.spec.ts`
- **Change:** ทดสอบ create role → grant → assign → protected read → revoke และ
  ตรวจ stale session/session rotation, cross-account denial, duplicate assignment,
  last-manager guard และ audit event โดยใช้ fixture ที่สร้าง/ล้างแบบ isolated
- **Verify:** `cd api; go test ./tests/security -run 'AuthorizationAdmin' -count=1`; 
  `cd admin; pnpm test:run tests/e2e/authorization-flow.spec.ts`; 
  `cd ..; pnpm exec vitest run integration/tests/authorization-admin-flow.test.ts`

## Phase B — Users and memberships

### Task B1 — User/membership query contracts

- **Files:**
  `api/internal/modules/identity/ports/admin_user_repository.go`,
  `api/internal/modules/accounts/ports/membership_query_repository.go`,
  `api/openapi/modules/identity/admin-users.yaml`,
  `api/openapi/modules/accounts/memberships.yaml`,
  `api/openapi/root.yaml`,
  `api/tests/contract/admin_users_http_test.go`
- **Change:** เพิ่ม permission-protected list/detail/status endpoints พร้อม bounded
  filters/cursors; response เปิดเผยเฉพาะ normalized email, status, timestamps และ
  membership summary ที่ caller มีสิทธิ์เห็น
- **Verify:** `cd api; go test ./tests/contract -run 'AdminUsers|Membership' -count=1`

### Task B2 — User/membership repository and service

- **Files:**
  `api/internal/modules/identity/adapters/gorm/admin_user_repository.go`,
  `api/internal/modules/identity/application/admin_users.go`,
  `api/internal/modules/accounts/adapters/gorm/membership_query_repository.go`,
  `api/internal/modules/accounts/application/memberships.go`,
  matching `*_test.go`
- **Change:** implement deterministic reads and safe status transitions; lock rows for
  mutations, bump authorization version, invalidate affected sessions and append audit
  events; account scope must be enforced in repository predicates
- **Verify:** `cd api; go test ./internal/modules/identity/... ./internal/modules/accounts/... -run 'Admin|Membership' -count=1`

### Task B3 — Admin users/memberships views

- **Files:**
  `admin/src/modules/identity/api/admin-users.client.ts`,
  `admin/src/modules/identity/views/UsersView.vue`,
  `admin/src/modules/identity/views/UserDetailView.vue`,
  `admin/src/modules/accounts/api/memberships.client.ts`,
  `admin/src/modules/accounts/views/MembershipsView.vue`,
  matching query/mutation/component/test files
- **Change:** searchable bounded tables, status action confirmation, session/security
  summary และ role assignment entry point; all actions permission-gated and no email
  or account data cached across account changes
- **Verify:** `cd admin; pnpm test:run tests/modules/identity tests/modules/accounts; pnpm lint; pnpm typecheck`

## Phase C — Localization administration

### Task C1 — Locale/catalog Admin clients and screens

- **Files:**
  `admin/src/modules/localization/api/locales.client.ts`,
  `admin/src/modules/localization/api/catalog.client.ts`,
  `admin/src/modules/localization/views/LocalesView.vue`,
  `admin/src/modules/localization/views/CatalogEditorView.vue`,
  `admin/src/modules/localization/components/CatalogEntryEditor.vue`,
  matching tests and locale catalogs
- **Change:** ใช้ existing locale/catalog contracts เพื่อเพิ่ม locale, enable/disable,
  set default, edit/reset translation โดย server เป็นผู้บันทึก provenance/version;
  UI รองรับมากกว่า 2 ภาษา, filter category/key, unsaved-change warning และ conflict retry
- **Verify:** `cd admin; pnpm test:run tests/modules/localization; pnpm lint; pnpm typecheck; pnpm build`

### Task C2 — Localization security/audit flow

- **Files:**
  `api/tests/security/audit_locale_admin_test.go`,
  `api/tests/security/audit_catalog_admin_test.go`,
  `integration/tests/localization-admin-flow.test.ts`
- **Change:** verify system-only edit permission, no client-supplied actor/source,
  version conflict rollback, default-locale invariants และ audit payload ที่ไม่เก็บ
  translated body/secret
- **Verify:** `cd api; go test ./tests/security -run 'Locale|Catalog' -count=1`; `cd ..; pnpm exec vitest run integration/tests/localization-admin-flow.test.ts`

## Phase D — Audit and operations read model

### Task D1 — Audit query HTTP contract

- **Files:**
  `api/internal/modules/audit/transport/http/event_handler.go`,
  `api/internal/modules/audit/transport/http/event_handler_test.go`,
  `api/internal/app/routes_system.go`,
  `api/openapi/modules/audit/events.yaml`,
  `api/openapi/root.yaml`,
  `api/tests/contract/audit_http_test.go`
- **Change:** expose permission-protected system audit list with cursor/limit/action/
  actor filters; preserve append-only repository (no update/delete endpoint), redact
  sensitive payload keys and return stable pagination metadata
- **Verify:** `cd api; go test ./internal/modules/audit/... ./tests/contract -run 'Audit' -count=1`

### Task D2 — Audit and module status screens

- **Files:**
  `admin/src/modules/audit/api/events.client.ts`,
  `admin/src/modules/audit/views/AuditEventsView.vue`,
  `admin/src/modules/operations/views/ModulesView.vue`,
  `admin/src/app/router/core-routes.ts`,
  matching tests and navigation catalogs
- **Change:** cursor table with action/actor/scope filters, module health/revision view,
  permission/module guards, no secret display and explicit stale/unavailable state
- **Verify:** `cd admin; pnpm test:run tests/modules/audit tests/modules/operations; pnpm lint; pnpm typecheck; pnpm build`

## Phase E — Cross-repository verification and release pin

### Task E1 — Full contract/client drift check

- **Files:** generated contract metadata and parent release fixtures only when hashes
  actually change
- **Change:** run API artifact generation, Admin/Site fetch/generate checks, verify
  checksum and exact child revisions; reject drift rather than silently rewriting
- **Verify:** `cd api; go test ./tests/contract -count=1`; `cd ../admin; pnpm test:run tests/architecture/contract-fetch.test.ts`; `cd ../site; pnpm test:run tests/architecture/contract-fetch.test.ts`

### Task E2 — Full quality and release verification

- **Files:** no production source changes expected
- **Change:** run all child tests/lint/typecheck/build, parent integration/release tests,
  Docker compose health and MariaDB/PostgreSQL migration evidence; record any profile
  that is `not-tested` instead of claiming support
- **Verify:**
  `cd api; CGO_ENABLED=0 go test ./... -count=1; go vet ./...`; 
  `cd ../admin; pnpm test:run; pnpm lint; pnpm typecheck; pnpm build`; 
  `cd ../site; pnpm test:run; pnpm lint; pnpm check; pnpm build`; 
  `cd ..; pnpm exec vitest run integration/tests; pnpm test:release`

### Task E3 — Commit boundaries

- **Files:** parent and each child Git repository
- **Change:** commit each bounded context separately; update parent gitlinks only after
  child commits pass; do not force-push or move release tags
- **Verify:** `git status --short --branch` is clean except explicitly user-owned files;
  `git -C api/admin/site rev-parse HEAD` matches parent gitlinks and release verifier
  passes

## ลำดับการทำงานและ parallelization

- Sequential: A1 → A2 → A3 → A4 → A5 → A6 → A7.
- After A7, B, C และ D แยก bounded contexts ได้ แต่แต่ละ phase ต้องจบ contract/API
  ก่อนเริ่ม UI ของ phase นั้น
- E1/E2/E3 เป็น sequential release gate หลัง A–D เท่านั้น
- ห้ามเริ่ม Phase B–E implementation จนกว่า Phase A design/contract review จะผ่าน
  และผู้ใช้อนุมัติแผน M2 นี้

## Definition of Done

- Back Office ทำ authorization flow end-to-end ได้จริงโดยใช้ permission ไม่ใช้ fixed role
- ทุก write มี transaction, optimistic conflict, audit และ session invalidation ตาม scope
- ทุก screen มี loading/empty/error/retry/forbidden state และเปลี่ยนภาษาได้จาก catalog
- API/OpenAPI/generated clients/checksums/parent gitlinks ตรงกัน
- API, Admin, Site, parent integration และ Docker health verification ผ่านตาม E2
- ไม่มี destructive migration, force push หรือแก้ `D:\infra-stack` โดยไม่มี approval แยก
