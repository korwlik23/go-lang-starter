# `go-lang-starter` Implementation Plan

- สถานะ: อนุมัติ implementation plan และ TDD exceptions แล้ว; Gate 0 ผ่านครบ
  และเริ่ม Phase R repository foundation แล้ว
- วันที่: 2026-07-27
- Design ref: `D:\go-lang-starter\docs\specs\2026-07-27-go-lang-starter-design.md`
- ขอบเขต: `D:\go-lang-starter` เท่านั้น
- โครงการที่ไม่แตะ: `D:\go-lang-starter-saas`

## 1. Design Anchor

สร้าง Personal Starter แบบ modular monolith ที่มี parent Git superproject และ child Git
repositories อิสระ 3 ตัว ได้แก่ Go API, Vue Admin และ Astro Public Site โดย API เป็น
source of truth ของ OpenAPI, ใช้ opaque server-side session, permission-based
authorization ที่ไม่ hardcode role, localization เพิ่มภาษาและแก้คำแปลจากระบบได้,
รองรับ PostgreSQL และ MariaDB/XAMPP เป็นหลัก พร้อม Oracle MySQL compatibility profile,
และ deploy ผ่าน contract ที่เข้ากับ `D:\infra-stack` โดยไม่แก้ InfraStack อัตโนมัติ

## 2. Planning Strategy

ขอบเขตทั้งหมดใหญ่เกินกว่าจะตรึงรายละเอียด implementation ทุก milestone ตั้งแต่ก่อนมี
API contract และ schema จริง จึงใช้ rolling-wave plan ดังนี้:

1. เอกสารนี้เป็น master plan และกำหนดลำดับ, boundary, exit gate และ release contract
   ของทั้งระบบ
2. `2026-07-27-go-lang-starter-milestone-1-plan.md` เป็น executable plan แรก
   มี file paths, RED/GREEN verification และ commit boundaries ครบ
3. ก่อนเริ่ม Milestone 2–4 ต้องเขียนและอนุมัติ executable plan ของ milestone นั้น
   โดยอ้างอิง contract และหลักฐานจาก milestone ก่อนหน้า
4. ห้ามเริ่ม code ของ milestone ถัดไปเพื่อ “เตรียมไว้ก่อน”

แนวทางนี้ไม่ลด scope ที่อนุมัติ แต่ป้องกันแผนที่ล้าสมัยและ skeleton modules ที่มีเพียงชื่อ

## 3. Current Evidence และ Blocking Inputs

| รายการ | หลักฐานปัจจุบัน | Gate |
|---|---|---|
| Parent Git | สร้าง `.git` บน branch `main` แล้ว; initial parent commit บันทึกเอกสารชุดนี้ | R1–R3 |
| Workspace | มี approved docs และ independent child repositories `api`, `admin`, `site` ที่ clean | ต้อง preserve child histories |
| Go | `go version go1.26.5 windows/amd64` | ผ่าน |
| Docker | Client/Server `29.6.2`, API `1.55`, Compose `v5.3.1` ตอบจาก `desktop-linux` | ผ่าน |
| Node/Corepack/pnpm | ตรวจพบและเรียกได้ | ใช้ bootstrap frontend/dev tooling ได้ |
| Quality CLIs | Gitleaks `8.30.1`, actionlint `1.7.12`, ShellCheck `0.11.0`; Git Bash `5.2.37` ผ่าน | ผ่าน |
| PostgreSQL image | official `postgres:18.4-alpine3.24` พร้อม immutable digest และ runtime probe `18.4` | ผ่านสำหรับ test profile |
| XAMPP database | client รายงาน MariaDB 10.4.32 | ใช้ชื่อ profile `mariadb-xampp` |
| InfraStack Git | clean `codex/public-repo-cleanup` ที่ `ee4df171bbc00783d2f560e8a907d60937e61782`; origin `korwlik23/infra-stack` | ใช้เป็น compatibility baseline; milestone นี้ไม่แก้ |
| Remotes | exact parent/API/Admin/Site URLs บันทึกแล้ว; parent ว่างและ child `main` ตรง local SHAs | ผ่าน |
| Go module | `github.com/korwlik23/go-api-starter` | ผ่าน |
| OCI registry | `ghcr.io/korwlik23` และ exact child image repositories บันทึกแล้ว | ผ่าน |

ค่าที่บันทึกและตรวจแล้วก่อน repository bootstrap:

- `PARENT_REMOTE_URL`
- `API_REMOTE_URL`
- `ADMIN_REMOTE_URL`
- `SITE_REMOTE_URL`
- `GO_MODULE_PATH`
- `OCI_REGISTRY_NAMESPACE` และ image repository ของแต่ละ child
- canonical InfraStack checkout/revision ที่จะใช้เป็น compatibility baseline

Child remotes ทั้งสามต้องมี default branch `main` และ initial commit ที่ clone ได้
เพื่อใช้ `git submodule add`; parent remote ควรเป็น repository ว่างเพื่อให้ approved
local docs เป็น first commit การสร้าง remote, seed/push, tag, publish image และ
production deploy เป็น external mutation จึงไม่รวมอยู่ในการอนุมัติ design/plan โดยปริยาย

## 4. Toolchain และ Version Policy

- ตรวจ current supported releases จาก official documentation ณ วันที่ลงมือ
- pin dependency ที่เลือกใน `go.mod`/`go.sum` หรือ `pnpm-lock.yaml`
- ห้าม commit คำสั่งหรือ manifest ที่พึ่ง `latest`
- project manifests และ lockfiles เป็น source of truth หลัง bootstrap
- child repositories ใช้ SemVer อิสระ
- parent ใช้ annotated tag รูปแบบ `suite-v<semver>`
- release manifest pin child version, commit SHA, immutable image digest, contract
  checksum, database evidence และ exact InfraStack compatibility commit SHA
- ไม่มี version bump หรือ tag ก่อน build, lint และ tests ที่เกี่ยวข้องผ่านจริง

## 5. TDD และ Generated-Artifact Policy

Behavior code ทุกส่วนใช้ rigid RED → GREEN → REFACTOR:

1. เพิ่ม test เพียง behavior เดียว
2. รัน targeted test และเห็น failure ที่คาดไว้
3. เพิ่ม implementation ขั้นต่ำ
4. รัน targeted test ให้ผ่าน
5. refactor โดยไม่เพิ่ม behavior และรัน package suite ซ้ำ

ข้อยกเว้นที่ต้องอนุมัติพร้อมแผนนี้:

- framework-generated scaffold
- lockfiles
- OpenAPI-generated Go/TypeScript clients
- pure configuration เช่น `.gitmodules`, Docker Compose และ CI YAML

ข้อยกเว้นเหล่านี้ยังต้องผ่าน generator no-diff, schema/config validation, build หรือ smoke
test ที่ระบุใน Milestone 1 plan และห้ามแก้ generated files ด้วยมือ

## 6. Delivery Sequence

```text
Repository inputs
  -> parent + child Git topology
  -> Milestone 1 Foundation
  -> Milestone 1 verification/review
  -> Milestone 2 executable plan + approval
  -> Administration
  -> Milestone 3 executable plan + approval
  -> CMS/Public
  -> Milestone 4 executable plan + approval
  -> Optional/Production
  -> full v1.0 acceptance audit
  -> child releases
  -> suite manifest/tag
```

แต่ละ child commit แยกจาก parent commit เสมอ Parent commit อัปเดตเฉพาะ gitlink และ
suite-owned files หลัง child commit ที่อ้างถึงมีอยู่จริง

## 7. Milestone 1 — Foundation

Executable plan:
`D:\go-lang-starter\docs\specs\2026-07-27-go-lang-starter-milestone-1-plan.md`

Deliverables:

- parent/child Git topology และ release/contract verifier
- API config, JSON logging, request IDs, health, graceful shutdown
- PostgreSQL, MariaDB/XAMPP และ conditional Oracle MySQL profiles
- dialect-owned Goose migrations และ `up-and-reconcile`
- OpenAPI admin/public/site-server artifacts และ generated-client drift checks
- anonymous pre-auth → `mfa_pending` → authenticated session lifecycle
- CSRF, exact CORS, general per-instance rate limiter, strict auth policies, password,
  MFA, recovery/session security foundation
- hidden default account, dynamic roles, permission-only default-deny authorization
- privilege-change authorization version, affected-session invalidation และ self-session
  rotation โดยไม่ hardcode role
- locale registry, bundled catalogs, DB override และ per-user switchable locale set
- Vue Admin runtime config, auth shell, permission/module guards และ locale switcher
- Astro runtime locale foundation, on-demand `/`, `/healthz` และ client boundary
- local Compose, hardened images, parent InfraStack wrapper contract และ CI
- login/permission/locale critical flow

Exit gate:

- API/Admin boot จาก clean checkout
- Site boot และ root locale/health smoke ผ่าน
- PostgreSQL และ MariaDB/XAMPP migration/repository tests ผ่าน
- Oracle MySQL แสดง `passed`, `failed` หรือ `not-tested` ตาม evidence จริง
- OpenAPI/generated clients no-diff
- session/CSRF/CORS/permission/cross-account security matrix ผ่าน
- Admin login, permission boundary และ locale switch critical flow ผ่าน
- ไม่มี handwritten file เกิน structural ceiling โดยไม่มี approved deviation

## 8. Milestone 2 — Administration

Plan file ที่ต้องสร้างและอนุมัติก่อน code:
`docs/specs/2026-07-27-go-lang-starter-milestone-2-plan.md`

Bounded contexts และ paths ที่อนุญาต:

- `api/internal/modules/identity`: users, profile, sessions, activation/recovery
- `api/internal/modules/accounts`: account settings, memberships
- `api/internal/modules/authorization`: roles, grants, permission catalog
- `api/internal/modules/localization`: locales, translation editor/import/export
- `api/internal/modules/settings`: non-secret settings และ security policy
- `api/internal/modules/audit`: query/read model ของ append-only audit
- `api/internal/modules/operations`: module status, jobs, failed jobs, outbox และ
  deactivation guard ที่บังคับ drain/cancel pending/running jobs พร้อม audit
- `api/internal/modules/notifications`: templates และ delivery history
- `admin/src/modules/<module>`: หนึ่ง view ต่อ screen ตาม approved layout

แผน Milestone 2 ต้องแตก test/use case ต่อ resource และห้ามสร้าง generic CRUD screen
ที่เปลี่ยนเพียง schema/label

Exit gate:

- Back Office core ใช้งาน end-to-end
- create role → assign member → permission boundary ผ่าน
- add locale → edit catalog → switch Admin locale ผ่านโดยไม่แก้ code
- audit ครอบคลุม auth, permission, localization, settings และ module changes
- jobs/outbox retry/idempotency tests ผ่าน
- module ที่ยังมี pending/running jobs ปิดไม่ได้จน explicit drain/cancel สำเร็จ
- ทุก screen มี loading, empty, error, retry, forbidden และ long-content state

## 9. Milestone 3 — CMS/Public

Plan file ที่ต้องสร้างและอนุมัติก่อน code:
`docs/specs/2026-07-27-go-lang-starter-milestone-3-plan.md`

Bounded contexts และ paths ที่อนุญาต:

- `api/internal/modules/publishing`: page/post/taxonomy/revision/workflow/schedule
- `api/internal/modules/media`: upload/finalize/metadata/storage compensation
- `api/internal/modules/navigation`: menus
- `api/internal/modules/discoverability`: redirects, SEO defaults, GEO/AEO content
  signals และ content audit
- `admin/src/modules/<module>`: authoring, review, media, navigation, discoverability
- `site/src/cms`, `site/src/blocks`, `site/src/seo`, `site/src/views`
- `site/src/pages/[locale]`: localized CMS/blog/docs/preview routes

Exit gate:

- author → review → publish → localized public page ผ่าน E2E
- missing translation เป็น 404 และไม่สร้าง `hreflang`
- preview one-time exchange, expiry, replay prevention, `noindex`/`no-store` ผ่าน
- cache, invalidation, stale-on-error และ no-cache 503 behavior ผ่าน
- upload type/magic bytes/size/private-default tests ผ่าน
- JSON-LD และ GEO/AEO signals สอดคล้องกับ visible content;
  canonical/sitemap/robots/RSS ผ่าน โดยไม่อ้าง ranking guarantee

## 10. Milestone 4 — Optional/Production

Plan file ที่ต้องสร้างและอนุมัติก่อน code:
`docs/specs/2026-07-27-go-lang-starter-milestone-4-plan.md`

Optional modules แยก bounded context:

- `api_keys`
- `webhooks`
- `feature_flags`
- `import_export`
- `analytics`
- `search`
- `oidc`
- `jwt`

Provider work:

- Redis session/cache/rate-limit adapters
- S3-compatible media provider
- SMTP provider
- production metrics/alerts
- backup/restore runbooks และ restore drill
- InfraStack template integration ที่ `D:\infra-stack` หลังมี separate approval และ
  writable access

Exit gate:

- optional module ที่ประกาศว่าพร้อมมี migrations, permissions, API, Admin views,
  tests และ disable behavior ครบ
- production containers ทำงาน non-root/read-only/drop-capabilities ตาม contract
- migration fail แล้วหยุดก่อน rollout และ old release ยัง healthy
- restore drill มี observed evidence
- metrics ไม่ public และ logs ไม่มี secrets/high-cardinality identifiers

## 11. Release Plan

1. แต่ละ child ผ่าน build, lint, unit/integration/security/E2E ที่เป็นของตน
2. ตรวจ breaking changes และเลือก SemVer จากหลักฐานจริง
3. อัปเดต child `CHANGELOG.md`; commit และสร้าง annotated child tag หลัง review
4. build immutable image และบันทึก digest
5. API publish immutable OpenAPI/catalog artifacts
6. Admin/Site regenerate clients และยืนยัน checksum/no-diff
7. parent สร้าง `releases/suite-v<semver>.yaml`
8. parent verifier ตรวจ gitlinks, tags, digests, checksums, DB evidence และ InfraStack
9. commit manifest และสร้าง annotated suite tag หลัง review
10. rollback ใช้ manifest เก่า; ห้ามย้าย tag หรือใช้ mutable image tag

## 12. Structural Verification

หลังแต่ละ bounded context:

- วัดจำนวนบรรทัดของ handwritten files
- backend file เป้าหมายไม่เกินประมาณ 500 บรรทัดหรือ 15 public methods
- handler ไม่เกินประมาณ 7 public actions
- Vue/Astro view/component เป้าหมายไม่เกินประมาณ 200 บรรทัด
- registry/wiring ไม่มี business logic
- generated files อยู่ directory เฉพาะและ no-diff
- หากเกินเพดาน ให้ split ก่อนเพิ่ม behavior ถัดไป

## 13. Commit Boundaries

- Conventional Commits
- หนึ่ง behavior/contract ที่ผ่าน test ต่อ commit หรือหนึ่ง tightly-coupled TDD slice
- child commit ก่อน parent gitlink update
- ไม่ commit `.env`, secrets, build output หรือ mutable artifacts
- ไม่ force-push shared branch
- ไม่ tag/push/publish/deploy โดยไม่มี explicit authorization

## 14. Completion Rule

การอนุมัติ master plan อนุญาตให้เริ่มเฉพาะ Milestone 1 ตาม executable plan หลัง
blocking inputs พร้อม ไม่อนุญาตให้ข้าม RED test, ลด database evidence, อ้าง Oracle
MySQL support โดยไม่มี test, แก้ `D:\infra-stack` อัตโนมัติ หรือเริ่ม Milestone 2–4
ก่อน plan ของ milestone นั้นได้รับอนุมัติ
