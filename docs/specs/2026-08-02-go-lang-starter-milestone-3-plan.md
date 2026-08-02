# Implementation Plan: `go-lang-starter` Milestone 3 — CMS/Public

- สถานะ: Draft — รอผู้ใช้อนุมัติก่อนเริ่ม implementation
- วันที่: 2026-08-02
- Design ref: `D:\go-lang-starter\docs\specs\2026-07-27-go-lang-starter-design.md`
- Master plan: `D:\go-lang-starter\docs\specs\2026-07-27-go-lang-starter-implementation-plan.md`
- M2 ref: `D:\go-lang-starter\docs\specs\2026-08-01-go-lang-starter-milestone-2-plan.md`

## 1. Approved outcome ที่แผนนี้ยึด

แผนนี้ต่อจาก Milestone 2 ที่ทำ Back Office administration เสร็จแล้ว และทำ vertical
slice ของ CMS/Public ให้ใช้งานจริงตั้งแต่ author → review → publish → public localized
page โดย API เป็น source of truth, ใช้ permission key แบบ dynamic (ไม่ตรวจ fixed role),
ทุก mutation มี server-side authorization, optimistic concurrency, transaction และ
audit event และ public site ใช้ locale prefix เฉพาะเส้นทางสาธารณะ เช่น `/th/...` หรือ
`/en/...` เท่านั้น; API และ Admin ไม่เติม locale prefix ใน route

ผลลัพธ์ที่ต้องได้:

1. จัดการ Page/Post, taxonomy, translation, revision, workflow และ schedule ได้
2. upload/finalize media แบบ private-by-default และตรวจ MIME/magic bytes/size ได้
3. จัดการ navigation, redirects และ discoverability metadata ได้
4. สร้าง preview แบบ one-time exchange ที่หมดอายุและ replay ไม่ได้
5. public site resolve เนื้อหาตาม locale/path พร้อม 404 เมื่อ translation ที่ publish
   ไม่ครบ และไม่สร้าง `hreflang` สำหรับ locale ที่ไม่มีเนื้อหา
6. cache มี invalidation, stale-on-error และ no-cache 503 behavior ที่พิสูจน์ได้
7. SEO/GEO/AEO output สอดคล้องกับ content ที่มองเห็นจริง ไม่มี ranking/citation guarantee

## 2. ขอบเขตที่ไม่รวม

- API keys, webhooks, feature flags, import/export, analytics, search, OIDC/JWT
- Redis, S3-compatible provider, SMTP provider และ production observability เต็มชุด
  (วาง provider boundary ไว้ แต่ implementation หลักอยู่ Milestone 4)
- billing, subscription, SaaS tenant provisioning หรือ impersonation
- การแก้ไข `D:\infra-stack` โดยตรง; แผนนี้เพิ่มเฉพาะ parent templates/contract tests
  ที่จำเป็นและต้องมี approval แยกก่อน deploy จริง
- `llms.txt` เป็น optional output; จะไม่เป็น exit gate ของ M3
- hard-coded role เช่น `admin`, `editor` หรือ `owner`; สิทธิ์ทุกจุดอ่านจาก permission
  catalog และ account scope

## 3. Baseline และ preconditions

ก่อนเริ่ม Task A ต้องผ่านทั้งหมด:

- Parent `main` และ child `main` ใช้ commits ที่ push แล้วจาก M2:
  - API `4db2740ea16bda2c9af127db43e6afe04ad2f4eb`
  - Admin `4c833c6a29a83551e70f7a9745abb0bf8b7a5a66`
  - Site `2ccfa694bb33d3b126b1c0d93fe02a7e07100544`
- API/Admin/Site contract lock และ parent gitlinks ต้องเปลี่ยนตาม child commit เท่านั้น
- `D:\go-lang-starter\docs\specs\2026-07-29-predecessor-starter-review.md` เป็นไฟล์
  user-owned ที่ต้องไม่แก้ ลบ หรือ stage โดยอัตโนมัติ
- Docker MariaDB profile ที่มีอยู่ต้องยัง health และ M2 integration tests ต้องผ่าน
- PostgreSQL profile ต้องถูกเปิดก่อน migration task แรก; Oracle MySQL รายงานตามหลักฐานจริง
  และห้ามประกาศ support จากการอ่านเอกสารอย่างเดียว
- ผู้ใช้อนุมัติเอกสารนี้ก่อน implementation; approval นี้ไม่อนุญาตให้แก้
  `D:\infra-stack` หรือ push release tag อัตโนมัติ

## 4. กติกาข้ามทุก task

### 4.1 TDD และ task sizing

สัญลักษณ์:

- `[S]` ต้องทำตามลำดับ
- `[P-x]` ทำขนานกับ lane อื่นได้เมื่อไม่แก้ไฟล์ชุดเดียวกัน
- `[TDD]` ต้องทำ RED → GREEN → REFACTOR
- `[GEN]` generated artifact ที่ห้ามแก้มือ
- `[CFG]` config/scaffold ที่ไม่มี business behavior
- `[QA]` cross-layer regression หรือ E2E หลัง owning package เป็น GREEN

ทุก `[TDD]` แบ่งเป็น microtasks 2–5 นาที:

1. `Task-ID-R`: เพิ่ม/แก้ test อย่างเดียว และเห็น expected RED ที่เกิดจาก behavior ที่ยังไม่มี
2. `Task-ID-G`: implementation ขั้นต่ำในไฟล์ที่ระบุ และรัน targeted test ให้ GREEN
3. `Task-ID-F`: format/refactor โดยไม่เพิ่ม behavior และรัน package suite

ห้ามรวม test ทุก resource ไว้ในไฟล์เดียว และห้ามสร้าง controller/view ที่เป็น god module
เกินประมาณ 500 บรรทัด, 15 public methods หรือ 200 บรรทัดสำหรับ Vue/Astro view/component

### 4.2 Security/data invariants

- ทุก admin mutation ต้องตรวจ session, CSRF, request ID, permission และ account ownership
  ที่ server; frontend guard เป็นเพียง UX ไม่ใช่ security boundary
- ทุก multi-table write อยู่ transaction เดียวกับ audit event; failure ต้อง rollback ทั้งชุด
- ทุก update รับ `expected_version` และคืน stable `409` เมื่อ stale; ห้าม last-write-wins
- list ทุกตัว bounded ด้วย cursor/keyset หรือ limit ที่มีเพดาน และ response ไม่คืน raw model
- JSON mutation ใช้ strict decoder; unknown field, duplicate key และ content-type ผิดต้อง reject
- content block ใช้ allowlist schema/validator ต่อ block type; ห้าม render HTML ที่ไม่ sanitize
- media ตรวจ extension + MIME + magic bytes + size + generated storage key; เก็บ private
  โดย default และห้ามใช้ชื่อไฟล์จากผู้ใช้เป็น path
- redirect target ต้องเป็น same-site path หรือ allowlist ที่ประกาศไว้; ห้ามเปิด SSRF/open redirect
- preview token ใช้ `BoundTokenCodec`, เก็บ hash เท่านั้น, bind กับ user/content/revision,
  expiry และ one-time consume แบบ atomic
- audit payload redaction ใช้ redactor เดิมและห้าม log token, raw upload bytes, secret หรือ PII

### 4.3 Locale/content invariants

- locale registry เพิ่มภาษาได้โดยไม่ต้องแก้ code; Admin เลือก enabled/selectable locale ได้
- content translation แยกจาก UI catalog และแก้ไขผ่าน Admin/API เท่านั้น
- public route ใช้ `[locale]` ของ Site; root `/` ทำ locale selection/redirect ตาม registry เดิม
- หาก content locale นั้นไม่มี published translation ให้ `404` และไม่สร้าง `hreflang` ของ locale นั้น
- draft/review/scheduled/preview ต้อง `noindex`; preview ต้อง `no-store`
- `canonical`, `hreflang`, `x-default`, JSON-LD และ GEO/AEO fields ต้องมาจาก visible content

## 5. Contract decisions ที่ต้องตรึงก่อนเขียน code

### 5.1 Domain vocabulary

- `ContentItem`: ชนิด `page` หรือ `post`, account scope, stable ID, status และ locale-neutral key
- `ContentTranslation`: locale, slug/path, title, excerpt, structured blocks, SEO/GEO/AEO data,
  publication state และ `version`
- Workflow states: `draft → review → scheduled|published → archived`; rollback สร้าง revision ใหม่
  ห้ามแก้ประวัติเดิม
- `Revision`: immutable snapshot ของ translation ที่มี author, created time, change summary และ hash
- `PublicationSchedule`: publish/unpublish timestamps, expected version, idempotency key และ state
- `MediaAsset`: metadata, checksum, visibility, storage key, dimensions และ processing state
- `Menu`/`MenuItem`: locale-aware ordered tree, stable keys และ target reference แบบ validated
- `Redirect`: locale/path source, destination, status code `301|302|307|308`, enabled และ version
- `DiscoverabilityAudit`: checks ที่ deterministic พร้อม severity, rule key, observed value และ status

### 5.2 Permission catalog (ตัวอย่าง key ที่ต้องประกาศจริงใน manifest)

ใช้ module owner และ scope ตาม `modular.Manifest`:

- Publishing: `publishing.pages.read.own`, `publishing.pages.write.own`,
  `publishing.pages.review.any`, `publishing.pages.publish.any`,
  `publishing.revisions.read.own`, `publishing.revisions.rollback.own`
- Media: `media.assets.read.own`, `media.assets.write.own`,
  `media.uploads.finalize.own`, `media.assets.delete.own`
- Navigation: `navigation.menus.read.own`, `navigation.menus.write.own`
- Discoverability: `discoverability.redirects.read.own`,
  `discoverability.redirects.write.own`, `discoverability.audit.read.own`

รายการจริงต้องมี scope/tier/delegable ครบ, route ทุกตัวอ้าง key ที่ manifest ประกาศ,
และห้ามเพิ่ม fallback ที่ตรวจชื่อ role

### 5.3 HTTP surface

Admin/authenticated surface (API `admin` contract):

- `/publishing/pages`, `/publishing/pages/{page_id}`
- `/publishing/posts`, `/publishing/posts/{post_id}`
- `/publishing/content/{content_id}/revisions`, `/publishing/content/{content_id}/workflow`
- `/publishing/content/{content_id}/preview`, `/publishing/schedules`
- `/publishing/categories`, `/publishing/tags`
- `/media/assets`, `/media/uploads`, `/media/uploads/{upload_id}/finalize`
- `/navigation/menus`, `/navigation/menus/{menu_id}/items`
- `/discoverability/redirects`, `/discoverability/settings`, `/discoverability/audits`

Public/site-server read surface (`public` และ `site-server` contracts แยก generated package):

- `GET /public/content/{locale}/*path`
- `GET /public/posts/{locale}` และ `GET /public/posts/{locale}/{slug}`
- `GET /public/menus/{locale}/{location}`
- `POST /public/previews/exchange` (one-time code เท่านั้น; ไม่รับ revision ID ตรง ๆ)

เส้นทาง public HTTP นี้เป็น API path; URL ของเว็บไซต์ยังคงเป็น `/[locale]/...` และไม่มี
locale prefix ใน API/Admin route อื่น

### 5.4 Response/error/cache contract

- list ใช้ envelope เดิม (`items`, `page_info`) และ cursor ที่ deterministic
- write success คืน resource + `version` + `request_id`; stale คืน `409 content_version_conflict`
- missing translation/public unpublished คืน `404 public_content_not_found` แบบไม่บอกว่า draft มีอยู่
- preview หมดอายุ/replay/invalid คืน `404 preview_not_found` และไม่ leak reason
- public cache key อย่างน้อย `(site, locale, path, content_version)`; publish/unpublish/redirect/menu
  mutation ต้อง emit invalidation event ที่ idempotent
- upstream error ระหว่าง revalidate ให้เสิร์ฟ stale content ได้ตาม TTL; ถ้าไม่มี stale ให้ `503`
  พร้อม `cache-control: no-store`

## 6. Approved file/module layout

### API modules

```text
api/internal/modules/publishing/
├── manifest.go
├── permissions.go
├── migrations.go
├── domain/content_item.go
├── domain/content_translation.go
├── domain/revision.go
├── domain/workflow.go
├── domain/schedule.go
├── application/content/create.go
├── application/content/get.go
├── application/content/list.go
├── application/content/update.go
├── application/content/delete.go
├── application/workflow/submit_review.go
├── application/workflow/approve.go
├── application/workflow/publish.go
├── application/workflow/archive.go
├── application/revisions/list.go
├── application/revisions/compare.go
├── application/revisions/rollback.go
├── application/schedules/create.go
├── application/schedules/cancel.go
├── application/schedules/run_due.go
├── application/preview/issue.go
├── application/preview/exchange.go
├── ports/content_repository.go
├── ports/revision_repository.go
├── ports/schedule_repository.go
├── adapters/gorm/content_repository.go
├── adapters/gorm/revision_repository.go
├── adapters/gorm/schedule_repository.go
└── transport/http/{content_handler,workflow_handler,revision_handler,schedule_handler,preview_handler}.go

api/internal/modules/media/
├── manifest.go
├── permissions.go
├── migrations.go
├── domain/asset.go
├── domain/upload.go
├── application/start_upload.go
├── application/finalize_upload.go
├── application/list_assets.go
├── application/delete_asset.go
├── ports/asset_repository.go
├── ports/storage.go
├── adapters/gorm/asset_repository.go
├── adapters/storage/local/provider.go
└── transport/http/{asset_handler,upload_handler}.go

api/internal/modules/navigation/
├── manifest.go
├── permissions.go
├── migrations.go
├── domain/menu.go
├── domain/menu_item.go
├── application/menus/{create,list,get,update,delete}.go
├── application/menus/reorder.go
├── ports/menu_repository.go
├── adapters/gorm/menu_repository.go
└── transport/http/menu_handler.go

api/internal/modules/discoverability/
├── manifest.go
├── permissions.go
├── migrations.go
├── domain/redirect.go
├── domain/seo.go
├── domain/content_audit.go
├── application/redirects/{create,list,update,delete}.go
├── application/audit/run.go
├── ports/{redirect_repository,content_audit_repository}.go
├── adapters/gorm/{redirect_repository,content_audit_repository}.go
└── transport/http/{redirect_handler,settings_handler,audit_handler}.go
```

Cross-cutting additions are intentionally separate:

```text
api/internal/platform/storage/{storage.go,local.go,local_test.go}
api/internal/platform/cache/{cache.go,memory.go,memory_test.go}
api/internal/platform/jobs/{runner.go,runner_test.go}
api/cmd/worker/main.go
```

### Admin and Site

```text
admin/src/modules/publishing/
├── manifest.ts
├── routes.ts
├── navigation.ts
├── api/{content,revisions,workflow,schedules}.client.ts
├── queries/{content,revisions}.queries.ts
├── mutations/{content,workflow,schedules}.mutations.ts
├── schemas/content.schema.ts
├── views/{ContentList,ContentEditor,ReviewQueue,RevisionHistory,ScheduleView}.vue
└── components/{ContentForm,BlockEditor,WorkflowActions,RevisionDiff,PreviewLink}.vue

admin/src/modules/media/{manifest.ts,routes.ts,navigation.ts}
admin/src/modules/media/api/{assets,uploads}.client.ts
admin/src/modules/media/views/MediaLibraryView.vue
admin/src/modules/media/components/{MediaUploader,MediaDetails}.vue

admin/src/modules/navigation/{manifest.ts,routes.ts,navigation.ts,api/menus.client.ts,
views/MenuListView.vue,views/MenuEditorView.vue,components/MenuTreeEditor.vue}

admin/src/modules/discoverability/{manifest.ts,routes.ts,navigation.ts,
api/{redirects,settings,audits}.client.ts,views/RedirectsView.vue,
views/DiscoverabilityView.vue,components/ContentAuditPanel.vue}

site/src/cms/{content-loader.ts,content-cache.ts,preview.ts}
site/src/blocks/{registry.ts,types.ts,TextBlock.astro,ImageBlock.astro,
CalloutBlock.astro,AnswerBlock.astro,StepsBlock.astro,ComparisonBlock.astro}
site/src/seo/{canonical.ts,hreflang.ts,json-ld.ts,sitemap.ts,rss.ts,
schema/{organization,website,breadcrumb,article,faq}.ts}
site/src/views/{CmsPageView,BlogIndexView,ArticleView,DocsView,PreviewView}.astro
site/src/pages/{robots.txt.ts,sitemap-index.xml.ts,sitemap/[locale].xml.ts,rss/[locale].xml.ts}
site/src/pages/[locale]/{[...slug].astro,blog/index.astro,blog/[slug].astro,
docs/[...slug].astro,preview/exchange/[code].astro,preview/[revisionId].astro}
```

Generated files remain under each repository's generated directory and are changed only
by the contract scripts.

## 7. Phase A — Publishing domain and database

### Task A0 — M3 contract vocabulary `[S][CFG]`

- **Files:** `docs/contracts/milestone-3-publishing.md`,
  `docs/contracts/milestone-3-public-rendering.md`
- **Change:** บันทึก resource fields, status transitions, permission matrix, public 404/
  noindex rules, cache headers, idempotency และ error codesตามข้อ 5; เพิ่ม example payloads
  ที่ไม่มี secret และระบุว่า public site เป็นผู้เติม `/[locale]`
- **Verify:** `rg -n "content_version_conflict|public_content_not_found|no-store|hreflang|publishing.pages" docs/contracts/milestone-3-publishing.md docs/contracts/milestone-3-public-rendering.md`
- **Pass:** ไม่มี placeholder และสองเอกสารไม่ขัดกัน

### Task A1 — Publishing manifest and permission RED tests `[S][TDD]`

- **Files:** `api/internal/modules/publishing/{manifest.go,permissions.go,manifest_test.go,permissions_test.go}`,
  `api/internal/app/modules.go`, `api/internal/app/migration_modules.go`,
  `api/internal/app/modules_test.go`
- **Change:** เพิ่ม module `publishing` เป็น `TierDefault`, dependencies คือ `accounts`,
  `authorization`, `localization`, `audit`; ประกาศ permissions/routes/jobs/health และ
  disabled behavior โดยไม่เพิ่ม role ใด ๆ
- **Verify:** `cd api; go test ./internal/modules/publishing ./internal/app -run '^TestM3A1' -count=1`
- **Pass:** manifest validation, route permission ownership และ module ordering ผ่าน

### Task A2 — Content/taxonomy migration parity `[S][TDD]`

- **Files:** `api/internal/modules/publishing/migrations.go`,
  `api/internal/modules/publishing/migrations/{postgres,mariadb,mysql}/000001_create_content_items.sql`,
  `api/internal/modules/publishing/migrations/{postgres,mariadb,mysql}/000002_create_content_translations.sql`,
  `api/internal/modules/publishing/migrations/{postgres,mariadb,mysql}/000003_create_taxonomies.sql`,
  `api/internal/modules/publishing/migrations/{postgres,mariadb,mysql}/000004_create_content_taxonomy_terms.sql`,
  `api/tests/migrations/publishing_content_test.go`,
  `api/tests/migrations/publishing_content_parity_test.go`
- **Change:** เพิ่ม account-scoped content, locale FK, kind/status/path/slug constraints,
  revision/version columns, soft-delete policy, foreign keys และ composite indexes สำหรับ
  `(account_id, updated_at, id)`, `(locale_id, path, status)`; dialect ทั้งสามใช้ logical
  migration basename เดียวกัน
- **Verify:** `cd api; go test ./tests/migrations -run '^TestM3A2' -count=1`; จากนั้นรัน
  migration `up → down → up` บน PostgreSQL และ MariaDB profile
- **Pass:** constraint/index behavior เท่ากันตาม dialect semantics; ไม่มี destructive backfill

### Task A3 — Domain values and block validator `[P][TDD]`

- **Files:** `api/internal/modules/publishing/domain/{content_item,content_translation,revision,workflow,schedule}.go`,
  `api/internal/modules/publishing/domain/{content_item,content_translation,revision,workflow,schedule}_test.go`,
  `api/internal/modules/publishing/application/content/validate.go`,
  `api/internal/modules/publishing/application/content/validate_test.go`
- **Change:** validate content kind, locale, slug/path, status transitions, structured block
  allowlist, visible-text requirement และ SEO/GEO/AEO field lengths; reject unknown block type,
  unsafe URL, invalid locale และ duplicate path
- **Verify:** `cd api; go test ./internal/modules/publishing/domain ./internal/modules/publishing/application/content -run '^TestM3A3' -count=1 -race`
- **Pass:** happy/edge/malicious input tests ผ่านโดยไม่พึ่ง database

### Task A4 — Content repository/query boundary `[P][TDD]`

- **Files:** `api/internal/modules/publishing/ports/content_repository.go`,
  `api/internal/modules/publishing/adapters/gorm/content_repository.go`,
  `api/internal/modules/publishing/adapters/gorm/content_repository_test.go`,
  `api/internal/modules/publishing/application/content/{list,get}.go`,
  `api/internal/modules/publishing/application/content/{list,get}_test.go`
- **Change:** implement bounded cursor listing, account/locale/status filters, path lookup,
  projection-only reads และ SQL ownership predicates; query ต้องไม่คืน drafts ให้ public resolver
- **Verify:** `cd api; go test ./internal/modules/publishing/adapters/gorm ./internal/modules/publishing/application/content -run '^TestM3A4' -count=1 -race`
- **Pass:** deterministic ordering, no `SELECT *`, no N+1 และ cross-account access ถูกปฏิเสธ

### Task A5 — Draft create/update/delete vertical slice `[S][TDD]`

- **Files:** `api/internal/modules/publishing/application/content/{create,update,delete}.go`,
  `api/internal/modules/publishing/application/content/{create,update,delete}_test.go`,
  `api/internal/modules/publishing/transport/http/content_handler.go`,
  `api/internal/modules/publishing/transport/http/content_handler_test.go`
- **Change:** strict JSON create/update/delete สำหรับ Page/Post, expected version,
  account ownership, soft-delete, audit append และ stable 400/401/403/404/409/422 responses
- **Verify:** `cd api; go test ./internal/modules/publishing/application/content ./internal/modules/publishing/transport/http -run '^TestM3A5' -count=1 -race`
- **Pass:** ทุก mutation rollback เมื่อ audit/persistence fail และ duplicate submit ไม่สร้างสอง row

### Task A6 — Revision diff and rollback `[P][TDD]`

- **Files:** `api/internal/modules/publishing/migrations/{postgres,mariadb,mysql}/000005_create_content_revisions.sql`,
  `api/internal/modules/publishing/application/revisions/{list,compare,rollback}.go`,
  `api/internal/modules/publishing/ports/revision_repository.go`,
  `api/internal/modules/publishing/adapters/gorm/revision_repository.go`,
  `api/internal/modules/publishing/adapters/gorm/revision_repository_test.go`,
  `api/internal/modules/publishing/application/revisions/{list,compare,rollback}_test.go`,
  `api/internal/modules/publishing/transport/http/revision_handler.go`,
  `api/internal/modules/publishing/transport/http/revision_handler_test.go`
- **Change:** immutable snapshot/hash, deterministic diff, rollback สร้าง revision ใหม่,
  expected-version conflict และ audit action `publishing.revision.rolled_back`
- **Verify:** `cd api; go test ./internal/modules/publishing/application/revisions ./internal/modules/publishing/transport/http -run '^TestM3A6' -count=1 -race`
- **Pass:** history ไม่ถูกแก้ย้อนหลัง, diff ไม่เผย draft ของ account อื่น

### Task A7 — Workflow transitions and audit `[S][TDD]`

- **Files:** `api/internal/modules/publishing/migrations/{postgres,mariadb,mysql}/000006_create_workflow_events.sql`,
  `api/internal/modules/publishing/application/workflow/{submit_review,approve,publish,archive}.go`,
  `api/internal/modules/publishing/domain/workflow.go`,
  `api/internal/modules/publishing/transport/http/workflow_handler.go`,
  `api/internal/modules/publishing/transport/http/workflow_handler_test.go`,
  `api/internal/modules/publishing/application/workflow/{submit_review,approve,publish,archive}_test.go`,
  `api/internal/app/authorization_audit.go` และ `authorization_audit_test.go`
- **Change:** enforce allowed transitions, reviewer/publisher permissions, transactionally
  append workflow event + audit, publish timestamp and cache invalidation event; disabled module
  must expose neither routes nor jobs
- **Verify:** `cd api; go test ./internal/modules/publishing/... ./internal/app -run '^TestM3A7' -count=1 -race`
- **Pass:** unauthorized transition 403, invalid transition 409/422, successful publish produces
  exactly one auditable event and a public version

### Task A8 — Scheduling and idempotent worker `[S][TDD]`

- **Files:** `api/internal/modules/publishing/migrations/{postgres,mariadb,mysql}/000007_create_publication_schedules.sql`,
  `api/internal/modules/publishing/application/schedules/{create,cancel,run_due}.go`,
  `api/internal/modules/publishing/ports/schedule_repository.go`,
  `api/internal/modules/publishing/adapters/gorm/schedule_repository.go`,
  `api/internal/modules/publishing/adapters/gorm/schedule_repository_test.go`,
  `api/internal/modules/publishing/application/schedules/{create,cancel,run_due}_test.go`,
  `api/internal/platform/jobs/{runner,runner_test}.go`, `api/cmd/worker/main.go`
- **Change:** schedule publish/unpublish with idempotency key, lease/timeout, bounded retries,
  cancellation and explicit failed state; repeated worker run must not double-publish or double-audit
- **Verify:** `cd api; go test ./internal/modules/publishing/application/schedules ./internal/platform/jobs -run '^TestM3A8' -count=1 -race`
- **Pass:** due job executes once, retry is safe, failed job remains observable and old release stays healthy

## 8. Phase B — Media, navigation และ discoverability API

### Task B1 — Storage boundary and local private provider `[S][TDD]`

- **Files:** `api/internal/platform/storage/{storage,local}.go`,
  `api/internal/platform/storage/{storage,local}_test.go`,
  `api/internal/modules/media/ports/storage.go`,
  `api/internal/modules/media/adapters/storage/local/provider.go`,
  `api/internal/modules/media/adapters/storage/local/provider_test.go`
- **Change:** define `Put/Stat/Delete/Open` interface; local provider generates non-user-controlled
  keys under private root, prevents path traversal and supports compensation on failed finalize;
  S3 provider is not implemented in M3
- **Verify:** `cd api; go test ./internal/platform/storage ./internal/modules/media/adapters/storage/local -run '^TestM3B1' -count=1 -race`
- **Pass:** traversal, overwrite, permission and cleanup tests pass

### Task B2 — Media migrations and upload/finalize service `[S][TDD]`

- **Files:** `api/internal/modules/media/{manifest,permissions,migrations}.go`,
  `api/internal/modules/media/migrations/{postgres,mariadb,mysql}/000001_create_media_assets.sql`,
  `api/internal/modules/media/migrations/{postgres,mariadb,mysql}/000002_create_media_uploads.sql`,
  `api/internal/modules/media/domain/{asset,upload}.go`,
  `api/internal/modules/media/application/{start_upload,finalize_upload,list_assets,delete_asset}.go`,
  `api/internal/modules/media/ports/asset_repository.go`,
  `api/internal/modules/media/adapters/gorm/asset_repository.go`,
  `api/internal/modules/media/adapters/gorm/asset_repository_test.go`,
  `api/internal/modules/media/domain/{asset,upload}_test.go`,
  `api/internal/modules/media/application/{start_upload,finalize_upload,list_assets,delete_asset}_test.go`
- **Change:** private-by-default asset metadata, upload session, SHA-256, byte size, dimensions,
  allowed MIME/magic bytes and versioned finalize with transaction/audit; delete is soft or
  compensation-only when storage cleanup is uncertain
- **Verify:** `cd api; go test ./internal/modules/media/... ./tests/migrations -run '^TestM3B2' -count=1 -race`
- **Pass:** wrong MIME/magic/size, duplicate finalize, path traversal and cross-account IDOR all fail safely

### Task B3 — Media HTTP contract `[S][TDD]`

- **Files:** `api/internal/modules/media/transport/http/{asset_handler,upload_handler}.go`,
  `api/internal/modules/media/transport/http/{asset_handler,upload_handler}_test.go`,
  `api/internal/app/routes_media.go`, `api/internal/app/routes_media_test.go`,
  `api/openapi/modules/media/assets.yaml`,
  `api/openapi/modules/media/uploads.yaml`, `api/openapi/root.yaml`
- **Change:** authenticated start/list/finalize/delete routes with permission guards, bounded lists,
  content-type/length checks and non-secret error envelope; direct public storage URL is never returned
- **Verify:** `cd api; go test ./internal/modules/media/transport/http ./tests/contract -run '^TestM3B3' -count=1`; `go test ./tests/contract -run 'OpenAPI' -count=1`
- **Pass:** OpenAPI route/permission/checksum is generated and no manual generated file edit exists

### Task B4 — Navigation menus and ordering `[P][TDD]`

- **Files:** `api/internal/modules/navigation/{manifest,permissions,migrations}.go`,
  `api/internal/modules/navigation/migrations/{postgres,mariadb,mysql}/000001_create_menus.sql`,
  `api/internal/modules/navigation/migrations/{postgres,mariadb,mysql}/000002_create_menu_items.sql`,
  `api/internal/modules/navigation/domain/{menu,menu_item}.go`,
  `api/internal/modules/navigation/application/menus/{create,list,get,update,delete,reorder}.go`,
  `api/internal/modules/navigation/ports/menu_repository.go`,
  `api/internal/modules/navigation/adapters/gorm/menu_repository.go`,
  `api/internal/modules/navigation/adapters/gorm/menu_repository_test.go`,
  `api/internal/modules/navigation/domain/{menu,menu_item}_test.go`,
  `api/internal/modules/navigation/application/menus/{create,list,get,update,delete,reorder}_test.go`,
  `api/internal/modules/navigation/transport/http/menu_handler.go`,
  `api/internal/modules/navigation/transport/http/menu_handler_test.go`,
  `api/openapi/modules/navigation/menus.yaml`
- **Change:** locale-aware ordered tree, cycle/depth validation, stable IDs/targets, optimistic
  versioning, account scope and audit; public resolver returns only enabled menu items
- **Verify:** `cd api; go test ./internal/modules/navigation/... ./tests/migrations -run '^TestM3B4' -count=1 -race`
- **Pass:** reorder is deterministic, cycles/invalid target are rejected and disabled menu is not public

### Task B5 — Redirects and SEO defaults `[P][TDD]`

- **Files:** `api/internal/modules/discoverability/{manifest,permissions,migrations}.go`,
  `api/internal/modules/discoverability/migrations/{postgres,mariadb,mysql}/000001_create_redirects.sql`,
  `api/internal/modules/discoverability/migrations/{postgres,mariadb,mysql}/000002_create_seo_defaults.sql`,
  `api/internal/modules/discoverability/domain/{redirect,seo}.go`,
  `api/internal/modules/discoverability/application/redirects/{create,list,update,delete}.go`,
  `api/internal/modules/discoverability/ports/redirect_repository.go`,
  `api/internal/modules/discoverability/adapters/gorm/redirect_repository.go`,
  `api/internal/modules/discoverability/adapters/gorm/redirect_repository_test.go`,
  `api/internal/modules/discoverability/domain/{redirect,seo}_test.go`,
  `api/internal/modules/discoverability/application/redirects/{create,list,update,delete}_test.go`,
  `api/internal/modules/discoverability/transport/http/{redirect_handler,settings_handler}.go`,
  `api/internal/modules/discoverability/transport/http/{redirect_handler,settings_handler}_test.go`
- **Change:** locale/path unique redirects, safe same-site destinations, 301/302/307/308 allowlist,
  per-locale title/description/canonical defaults and cache invalidation
- **Verify:** `cd api; go test ./internal/modules/discoverability/... ./tests/migrations -run '^TestM3B5' -count=1 -race`
- **Pass:** open redirect, loop, duplicate path and unauthorized account access are rejected

### Task B6 — GEO/AEO content audit `[P][TDD]`

- **Files:** `api/internal/modules/discoverability/migrations/{postgres,mariadb,mysql}/000003_create_content_audits.sql`,
  `api/internal/modules/discoverability/domain/content_audit.go`,
  `api/internal/modules/discoverability/application/audit/run.go`,
  `api/internal/modules/discoverability/ports/content_audit_repository.go`,
  `api/internal/modules/discoverability/adapters/gorm/content_audit_repository.go`,
  `api/internal/modules/discoverability/transport/http/audit_handler.go`,
  `api/internal/modules/discoverability/transport/http/audit_handler_test.go`,
  `api/internal/modules/discoverability/application/audit/run_test.go`,
  `api/internal/modules/discoverability/adapters/gorm/content_audit_repository_test.go`,
  `api/openapi/modules/discoverability/audit.yaml`
- **Change:** deterministic checks for direct answer, definition, steps/comparison/key facts,
  author credentials, citations, dates and provenance; report warnings/errors without inventing
  structured data and never promise ranking/citation
- **Verify:** `cd api; go test ./internal/modules/discoverability/application ./internal/modules/discoverability/transport/http -run '^TestM3B6' -count=1 -race`
- **Pass:** audit results match visible blocks and are stored with content revision/version

## 9. Phase C — Preview, public resolver และ cache

### Task C1 — Public content resolver `[S][TDD]`

- **Files:** `api/internal/modules/publishing/application/content/public_get.go`,
  `api/internal/modules/publishing/application/content/public_list_posts.go`,
  `api/internal/modules/publishing/transport/http/public_handler.go`,
  `api/internal/modules/publishing/application/content/{public_get,public_list_posts}_test.go`,
  `api/internal/modules/publishing/transport/http/public_handler_test.go`,
  `api/openapi/modules/publishing/public.yaml`, `api/openapi/codegen/{public,site-server}.yaml`,
  `api/tests/contract/public_content_http_test.go`
- **Change:** resolve only published revision by locale/path, return visible structured blocks,
  alternate locales that are also published, menu/SEO metadata and stable 404 when translation
  is missing; no draft existence leak
- **Verify:** `cd api; go test ./internal/modules/publishing/application/content ./internal/modules/publishing/transport/http ./tests/contract -run '^TestM3C1' -count=1 -race`
- **Pass:** missing translation is 404 and alternate list excludes unpublished locale

### Task C2 — Preview issue/exchange `[S][TDD]`

- **Files:** `api/internal/modules/publishing/application/preview/{issue,exchange}.go`,
  `api/internal/modules/publishing/ports/preview_repository.go`,
  `api/internal/modules/publishing/adapters/gorm/preview_repository.go`,
  `api/internal/modules/publishing/migrations/{postgres,mariadb,mysql}/000008_create_preview_tokens.sql`,
  `api/internal/modules/publishing/transport/http/preview_handler.go`,
  `api/internal/modules/publishing/application/preview/{issue,exchange}_test.go`,
  `api/internal/modules/publishing/transport/http/preview_handler_test.go`,
  `api/internal/platform/crypto/bound_token.go`
  only if a narrowly-scoped regression test requires it
- **Change:** authenticated issue binds token to user/content/revision; public exchange atomically
  consumes hash, checks expiry/audience and returns no-store preview payload; replay/expired/code
  tampering all map to same 404
- **Verify:** `cd api; go test ./internal/modules/publishing/application/preview ./internal/modules/publishing/transport/http -run '^TestM3C2' -count=1 -race`
- **Pass:** one successful exchange only; preview cannot be indexed or cached

### Task C3 — Cache port and invalidation event `[S][TDD]`

- **Files:** `api/internal/platform/cache/{cache,memory}.go`,
  `api/internal/platform/cache/{cache,memory}_test.go`,
  `api/internal/modules/publishing/application/cache_invalidation.go`,
  `api/internal/modules/publishing/application/cache_invalidation_test.go`
- **Change:** bounded TTL cache interface with versioned keys, explicit invalidate by content/path/locale,
  stale-on-error decision and metrics hooks; publish, unpublish, redirect and menu writes call it
  after commit only
- **Verify:** `cd api; go test ./internal/platform/cache ./internal/modules/publishing/application -run '^TestM3C3' -count=1 -race`
- **Pass:** failed transaction does not invalidate cache; successful commit invalidates exactly once

### Task C4 — Public HTTP headers and failure semantics `[P][TDD]`

- **Files:** `api/internal/modules/publishing/transport/http/public_handler.go`,
  `site/src/cms/content-cache.ts`, `site/src/api/errors.ts`,
  `site/tests/unit/content-cache.test.ts`,
  `api/internal/modules/publishing/transport/http/public_cache_test.go`
- **Change:** set cache headers for published content, `no-store` for preview/503, `ETag`/version
  response and stale-on-error behavior; never cache authenticated/admin response in shared public cache
- **Verify:** `cd api; go test ./internal/modules/publishing/transport/http -run '^TestM3C4' -count=1`; `cd ../site; pnpm vitest run tests/unit/content-cache.test.ts -t '^M3C4$'`
- **Pass:** stale content is served only within configured TTL; no stale value yields 503/no-store

## 10. Phase D — OpenAPI and Admin Back Office

### Task D1 — Admin/public/site contract generation `[S][GEN]`

- **Files:** `api/openapi/root.yaml`,
  `api/openapi/modules/publishing/{content,workflow,revisions,schedules,public}.yaml`,
  `api/openapi/modules/media/{assets,uploads}.yaml`,
  `api/openapi/modules/navigation/menus.yaml`,
  `api/openapi/modules/discoverability/{redirects,settings,audit}.yaml`,
  `api/openapi/dist/{admin,public,site-server}.openapi.yaml`,
  `admin/contracts/admin.openapi.lock.json`, `admin/src/generated/api/schema.ts`,
  `admin/src/generated/api/contract.meta.json`, `site/contracts/openapi.lock.json`,
  `site/src/api/generated/public/schema.ts`, `site/src/api/generated/site-server/schema.ts`,
  `site/src/api/contract.meta.json`
- **Change:** add paths/schemas/security and regenerate through repository scripts; update checksums
  only after API commit is immutable; no hand editing generated schema/client
- **Verify:** `cd api; go test ./tests/contract -run 'OpenAPI|M3D1' -count=1`; `cd ../admin; pnpm contract:fetch; pnpm contract:generate; pnpm test:run tests/architecture/contract-fetch.test.ts`; `cd ../site; pnpm contracts:fetch:local; pnpm contracts:generate; pnpm test:run tests/architecture/contract-fetch.test.ts`
- **Pass:** no-diff contract checks and public/admin/site surfaces contain only intended paths

### Task D2 — Publishing clients and forms `[P][TDD]`

- **Files:** `admin/src/modules/publishing/api/{content,revisions,workflow,schedules}.client.ts`,
  `admin/src/modules/publishing/queries/{content,revisions}.queries.ts`,
  `admin/src/modules/publishing/mutations/{content,workflow,schedules}.mutations.ts`,
  `admin/src/modules/publishing/schemas/content.schema.ts`,
  `admin/tests/unit/publishing-client.test.ts`, `admin/tests/unit/publishing-schema.test.ts`
- **Change:** typed wrappers map 401/403/404/409/422, preserve cursor/version, prevent duplicate
  submit and keep server errors safe; block editor sends only schema-valid structured blocks
- **Verify:** `cd admin; pnpm vitest run tests/unit/publishing-client.test.ts -t '^D2'`
- **Pass:** client tests cover happy/invalid/forbidden/stale/error responses

### Task D3 — Content authoring/review screens `[P][TDD]`

- **Files:** `admin/src/modules/publishing/views/{ContentList,ContentEditor,ReviewQueue,RevisionHistory,ScheduleView}.vue`,
  `admin/src/modules/publishing/components/{ContentForm,BlockEditor,WorkflowActions,RevisionDiff,PreviewLink}.vue`,
  `admin/tests/components/publishing/ContentEditor.test.ts`,
  `admin/tests/components/publishing/ReviewQueue.test.ts`,
  `admin/tests/components/publishing/RevisionHistory.test.ts`,
  `admin/tests/components/publishing/FeedbackStates.test.ts`
- **Change:** page/post editor, locale/translation selector, taxonomy, revision diff/rollback,
  review/publish/schedule actions and preview link; every screen has loading/empty/error/retry/
  forbidden/long-content/unsaved-change states
- **Verify:** `cd admin; pnpm vitest run tests/components/publishing -t '^D3'`; `pnpm lint; pnpm typecheck`
- **Pass:** no screen checks role name; required buttons are disabled while mutation is pending

### Task D4 — Media/navigation/discoverability screens `[P][TDD]`

- **Files:** `admin/src/modules/media/{manifest,routes,navigation}.ts`,
  `admin/src/modules/media/api/{assets,uploads}.client.ts`,
  `admin/src/modules/media/views/MediaLibraryView.vue`,
  `admin/src/modules/media/components/{MediaUploader,MediaDetails}.vue`,
  `admin/src/modules/navigation/{manifest,routes,navigation}.ts`,
  `admin/src/modules/navigation/api/menus.client.ts`,
  `admin/src/modules/navigation/views/{MenuListView,MenuEditorView}.vue`,
  `admin/src/modules/navigation/components/MenuTreeEditor.vue`,
  `admin/src/modules/discoverability/{manifest,routes,navigation}.ts`,
  `admin/src/modules/discoverability/api/{redirects,settings,audits}.client.ts`,
  `admin/src/modules/discoverability/views/{RedirectsView,DiscoverabilityView}.vue`,
  `admin/src/modules/discoverability/components/ContentAuditPanel.vue`,
  `admin/tests/components/media/MediaLibrary.test.ts`,
  `admin/tests/components/navigation/MenuEditor.test.ts`,
  `admin/tests/components/discoverability/Discoverability.test.ts`
- **Change:** media library/uploader/details, menu tree editor, redirects, SEO defaults and
  content audit panel; upload progress/errors never expose storage keys or raw server details
- **Verify:** `cd admin; pnpm vitest run tests/components/media tests/components/navigation tests/components/discoverability -t '^D4'`; `pnpm build`
- **Pass:** responsive 375/768/1440 states, keyboard path, visible focus, alt text and 44px touch targets

### Task D5 — Dynamic routes/navigation and permissions `[S][TDD]`

- **Files:** `admin/src/app/router/core-routes.ts`, `admin/src/app/layouts/AdminRouteShell.vue`,
  `admin/src/app/modules/{manifest,registry,activate}.ts`,
  `admin/src/modules/{publishing,media,navigation,discoverability}/{routes,navigation}.ts`,
  `admin/tests/routes/cms-routes.test.ts`, `admin/tests/components/cms-navigation.test.ts`
- **Change:** register each module only when enabled and guard each route with exact permission key;
  navigation labels come from editable catalog; disabled module removes route/job/navigation
- **Verify:** `cd admin; pnpm vitest run tests/routes/cms-routes.test.ts tests/components/cms-navigation.test.ts -t '^D5'`
- **Pass:** unauthorized route resolves to forbidden; disabled module does not render a dead link

## 11. Phase E — Astro Public Site

### Task E1 — Public content client and cache loader `[S][TDD]`

- **Files:** `site/src/api/{server-client,client}.ts`, `site/src/cms/{content-loader,content-cache}.ts`,
  `site/src/runtime/site-runtime.ts`, `site/tests/unit/content-loader.test.ts`,
  `site/tests/unit/content-cache.test.ts`, `site/tests/integration/content-client.test.ts`
- **Change:** typed public/site-server read clients, timeout/error mapping, locale/path loading,
  versioned cache, stale-on-error and no-store 503 behavior; no admin credentials in browser bundle
- **Verify:** `cd site; pnpm vitest run tests/unit/content-loader.test.ts tests/unit/content-cache.test.ts -t '^E1$'`
- **Pass:** API 404/503/timeout semantics are preserved and cache key includes locale/path/version

### Task E2 — Block registry and visible-content components `[P][TDD]`

- **Files:** `site/src/blocks/{types,registry,TextBlock,ImageBlock,CalloutBlock,AnswerBlock,StepsBlock,ComparisonBlock}.ts|.astro`,
  `site/tests/unit/block-rendering.test.ts`
- **Change:** one allowlisted block type per component; Image requires dimensions/alt, Answer/Steps/
  Comparison render only data that is present, and registry performs mapping only
- **Verify:** `cd site; pnpm vitest run tests/unit/block-rendering.test.ts -t '^E2$'; pnpm check`
- **Pass:** unknown block type is rejected/omitted safely, no raw HTML execution and no fabricated JSON-LD facts

### Task E3 — Locale content routes `[S][TDD]`

- **Files:** `site/src/pages/[locale]/{[...slug].astro,blog/index.astro,blog/[slug].astro,docs/[...slug].astro}`,
  `site/src/views/{CmsPageView,BlogIndexView,ArticleView,DocsView}.astro`,
  `site/tests/integration/content-routes.test.ts`
- **Change:** resolve published content by locale/path, render Page/Post/Docs views, preserve root
  locale redirect, return 404 for disabled/missing/unpublished locale content and never fallback to
  another locale's content
- **Verify:** `cd site; pnpm vitest run tests/integration/content-routes.test.ts -t '^E3$'; pnpm build`
- **Pass:** `/th/...` and `/en/...` can differ; `/...` without locale is not a public CMS route

### Task E4 — Preview routes and safeguards `[P][TDD]`

- **Files:** `site/src/pages/[locale]/preview/{exchange/[code].astro,[revisionId].astro}`,
  `site/src/cms/preview.ts`, `site/tests/integration/preview-route.test.ts`, `site/e2e/preview.spec.ts`
- **Change:** exchange one-time code server-side, render revision preview with `noindex`/`no-store`,
  reject direct revision ID access and replay/expired codes
- **Verify:** `cd site; pnpm vitest run tests/integration/preview-route.test.ts -t '^E4$'; pnpm test:e2e --grep '^E4$'`
- **Pass:** browser cannot reuse code or discover unpublished content through public list/sitemap

### Task E5 — SEO/GEO/AEO metadata and feeds `[P][TDD]`

- **Files:** `site/src/seo/{canonical,hreflang,json-ld,sitemap,rss}.ts`,
  `site/src/seo/schema/{organization,website,breadcrumb,article,faq}.ts`,
  `site/src/pages/{robots.txt.ts,sitemap-index.xml.ts,sitemap/[locale].xml.ts,rss/[locale].xml.ts}`,
  `site/src/layouts/BaseLayout.astro`, `site/tests/unit/seo.test.ts`,
  `site/tests/integration/seo-routes.test.ts`
- **Change:** canonical/hreflang/x-default, Open Graph, visible-content JSON-LD, locale sitemap,
  robots and RSS; omit alternate links/schema when source content is missing or unpublished
- **Verify:** `cd site; pnpm vitest run tests/unit/seo.test.ts tests/integration/seo-routes.test.ts -t '^E5$'; pnpm check`
- **Pass:** JSON-LD facts equal rendered visible content; drafts/preview never appear in feeds

### Task E6 — Public accessibility/responsive/error QA `[QA]`

- **Files:** `site/e2e/public-content.spec.ts`, `site/e2e/accessibility.spec.ts`,
  `site/tests/integration/public-errors.test.ts`
- **Change:** exercise 375/768/1440 viewports, keyboard navigation, missing image/long text,
  loading/empty/404/503 states and no console errors on public content
- **Verify:** `cd site; pnpm test:e2e --grep '^E6$'; pnpm test:run`
- **Pass:** critical public flow passes without accessibility blocker; residual browser gaps recorded

## 12. Phase F — Parent integration, Docker และ database matrix

### Task F1 — Worker/local profile wiring `[S][CFG]`

- **Files:** `api/Dockerfile`, `api/compose.dev.yml`, `api/.env.example`, `api/.env.postgres.example`,
  `api/.env.mariadb-xampp.example`, `ops/local/compose.yml`, `ops/local/.env.example`,
  `docs/operations/local-development.md`
- **Change:** add worker/migrate service contract, private media volume, upload limits, cache TTL,
  preview TTL and schedule polling settings; keep frontend off backend network and preserve existing
  health paths; do not add host-published DB ports by default
- **Verify:** render Compose for PostgreSQL and MariaDB; build API/worker images; inspect numeric
  non-root/read-only/no-new-privileges and health checks
- **Pass:** migration failure prevents rollout, worker restart is safe, media volume is not public

### Task F2 — API/Admin/Site integration fixture `[P][QA]`

- **Files:** `integration/fixtures/cms/seed.yaml`, `integration/tests/cms-public-flow.test.ts`,
  `integration/tests/compose/local-stack.test.ts`
- **Change:** deterministic fixture with at least two locales, one missing translation, one draft,
  one scheduled post, one media asset and one redirect; test author → review → publish → public,
  missing translation 404, cache invalidation and preview replay rejection
- **Verify:** `pnpm exec vitest run integration/tests/cms-public-flow.test.ts integration/tests/compose/local-stack.test.ts`
- **Pass:** test uses real running containers and does not insert data by bypassing API contracts

### Task F3 — Database compatibility matrix `[S][QA]`

- **Files:** `api/tests/migrations/publishing_content_test.go`,
  `api/tests/migrations/media_assets_test.go`, `api/tests/migrations/navigation_menus_test.go`,
  `api/tests/migrations/discoverability_test.go`,
  `docs/operations/database-compatibility.md`
- **Change:** run migration/repository suites on pinned PostgreSQL and MariaDB/XAMPP profiles;
  run Oracle MySQL only when an actual test service is available, otherwise record `NOT TESTED`
- **Verify:** `go test ./tests/migrations -run 'M3' -count=1` per profile plus repository ping,
  `up → down → up`, constraint/index checks and representative public queries
- **Pass:** no claim exceeds observed evidence; migration rollback path is documented

### Task F4 — Security and performance regression `[S][QA]`

- **Files:** `api/tests/security/{publishing,media,preview,redirects}_http_test.go`,
  `api/tests/contract/{publishing,media,public_content}_http_test.go`,
  `site/tests/integration/cache-security.test.ts`
- **Change:** cover IDOR/account scope, 401/403, strict JSON, CSRF, XSS/block sanitization,
  upload bypass, path traversal, preview replay, redirect abuse, cache poisoning, bounded lists,
  query count and stale/503 behavior
- **Verify:** `cd api; go test ./tests/security ./tests/contract -run 'M3' -count=1 -race`; `cd ../site; pnpm test:run tests/integration/cache-security.test.ts`
- **Pass:** critical security paths are green; no secret/token appears in response or logs

### Task F5 — Cross-repository contract/release pin `[S]`

- **Files:** child generated contract metadata/locks, parent `integration/fixtures/releases/valid.yaml`,
  parent gitlinks and `docs/operations/milestone-3-runbook.md`
- **Change:** commit API bounded contexts first, regenerate Admin/Site clients, commit child repos,
  update parent gitlinks and release fixture only after checksums and tests pass; no tag or force push
- **Verify:** API contract tests; Admin/Site no-diff checks; `pnpm test:release`; `pnpm release:verify -- integration/fixtures/releases/valid.yaml`; all four `git status` checks
- **Pass:** exact child revisions/checksums match and release verifier reports no drift; image digests
  remain explicit even if production registry publication is deferred

### Task F6 — Structural verification and milestone exit `[S][QA]`

- **Files:** `scripts/verify-structure.mjs`, `integration/tests/structure/m3-layout.test.ts`,
  `docs/specs/2026-08-02-go-lang-starter-milestone-3-plan.md` (Observed section)
- **Change:** measure largest handwritten API/Admin/Site files, route/controller counts, generated
  boundary and module disable behavior; record exact commands, test counts and unverified DB/browser profiles
- **Verify:** `node scripts/verify-structure.mjs`; `pnpm exec vitest run integration/tests/structure/m3-layout.test.ts`; full child test/lint/typecheck/build suite
- **Pass:** no god module, no unlisted generated edit, M3 E2E author→public is observed, and all residual risks are explicit

## 13. Dependency order and parallelization

Sequential critical path:

`A0 → A1 → A2 → A3 → A4 → A5 → A6 → A7 → A8 → C1 → C2 → C3 → D1 → D2 → D3 → E1 → E3 → F2 → F5 → F6`

Parallel lanes after A2 schema contract:

- `[P-B]` Media B1–B3
- `[P-N]` Navigation B4
- `[P-D]` Discoverability B5–B6
- `[P-UI]` Admin D2/D3 only after D1 generated contract is green
- `[P-SITE]` Site E2 can start with fixture schemas, but E3 waits for C1

Rules:

- B/C domain writes must not merge until A7 audit/transaction adapters are reusable and tested
- D2/D3 and E1/E3 cannot start with stale OpenAPI locks
- F2/F3/F4 are QA gates, not substitutes for owning package tests
- F5 must happen after child commits; parent gitlinks never point to unverified worktrees

## 14. Milestone 3 Definition of Done / exit gate

M3 ผ่านเมื่อมีหลักฐานทั้งหมดต่อไปนี้:

- author → review → publish → localized public page ผ่าน suite E2E จริง
- Page/Post/taxonomy/revision/workflow/schedule, media, navigation, redirects และ discoverability
  มี API, migrations, permission catalog, Admin UI, tests และ disabled behavior ตาม scope
- missing translation เป็น 404 และไม่สร้าง `hreflang`; draft/preview ไม่เข้า sitemap/RSS/JSON-LD
- preview one-time exchange มี expiry/replay prevention/`noindex`/`no-store`
- cache invalidation, stale-on-error และ no-cache 503 behavior ผ่าน tests
- PostgreSQL และ MariaDB/XAMPP evidence ผ่าน; Oracle MySQL ถูกระบุ `PASS` หรือ `NOT TESTED`
  ตามหลักฐานจริงเท่านั้น
- OpenAPI, generated clients, checksums และ parent gitlinks ตรงกัน
- API/Admin/Site lint, typecheck, unit/integration/E2E/build และ parent integration ผ่าน
- structural verification ไม่พบ god module หรือ generated boundary violation
- ไม่มี destructive migration, force push หรือการแก้ `D:\infra-stack` โดยไม่มี approval แยก

## 15. Risks และ mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Content model กว้างเกินไป | API/UI กลายเป็น generic CRUD | จำกัด Page/Post + block allowlist ใน M3; custom types ไป M4 |
| Scheduled publish ทำซ้ำ | เนื้อหา/notification ซ้ำ | idempotency key, lease, transaction และ audit uniqueness |
| Media upload เปิด public โดยไม่ตั้งใจ | data leak/XSS | private-by-default, magic-byte/size check, generated key, no direct path |
| Locale fallback ทำให้เนื้อหาผิดภาษา | UX/SEO ผิดและ index ผิด | public missing translation = 404; UI catalog fallback แยกจาก CMS content |
| JSON-LD/GEO/AEO สร้างข้อมูลเกินหน้า | search/AI trust ลดลง | generate จาก visible blocks เท่านั้น และมี audit pre-publish |
| Cache เสิร์ฟ draft | content leak | cache key มี status/version; preview/admin ไม่ใช้ shared cache |
| Database dialect drift | production failure เฉพาะ engine | logical migration parity + profile tests + explicit evidence |
| M3 ขยายไป M4 | ส่งมอบล่าช้า | provider boundary เท่านั้น; Redis/S3/search/OIDC อยู่ M4 |

## 16. Approval gate

## 17. Observed implementation evidence (2026-08-02)

> The user approval gate is satisfied. The historical draft note below is
> retained for traceability and must not be read as the current status.

This plan is approved and implementation evidence is recorded here as M3 work
advances. The verified child revisions are:

Latest observed evidence (2026-08-03): API commit `80862457dd584a7d07a7299f4406c9b9773d7127` was exercised on disposable PostgreSQL (`postgres:18.4-alpine3.24`): `GET /readyz 200`, authenticated `POST page 201` → `submit_review 200` → `publish 200`, and unauthenticated `GET /api/v1/public/content/th/live-release-final-3 200` with published GEO/AEO content. Native XAMPP MariaDB `10.4.32` passed the dedicated migration, bootstrap, operations, audit, and database integration packages against `go_lang_starter_test_m3`; disposable Oracle MySQL `8.4.11` passed the same compatibility package suite. The four repositories were pushed without force; `D:\infra-stack` and user databases were not touched. Browser Playwright E2E remains unverified.

- API: `80862457dd584a7d07a7299f4406c9b9773d7127`
- Admin: `87b9df7b48ef91da93a93199c12cf891db0bfb06`
- Site: `6fa157e34c7ecd171d3694cfe19aebf9d8c34eba`

Observed checks include API publishing repository/schedule/contract tests in a
pinned Go container, Admin and Site contract lock tests, parent CMS fixture and
structure tests, pinned PostgreSQL migration, pinned Docker MariaDB migration
parity, native XAMPP MariaDB integration packages, and Compose configuration
rendering. Browser Playwright E2E remains explicitly unverified until the
browser runtime is intentionally enabled; the live author-to-public API flow
is verified above.

เอกสารนี้เป็น plan เท่านั้น ยังไม่มี implementation ใน M3 จนกว่าจะได้รับ approval ชัดเจน
หลังอนุมัติ ลำดับถัดไปคือ `test-driven-development` + `backend-architecture` สำหรับ
Phase A และเปิด child branch แยกตาม bounded context; การ commit/push/release tag ต้องทำ
ตาม approval ของแต่ละ release boundary
