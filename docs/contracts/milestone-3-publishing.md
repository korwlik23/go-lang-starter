# Milestone 3 Publishing Contract

สถานะ: approved design input สำหรับ implementation ของ Milestone 3

## Scope

Publishing owns account-scoped `Page` และ `Post` content, locale-aware translations,
taxonomy, immutable revisions, workflow transitions และ publication schedules. CMS content
translation แยกจาก UI catalog และแก้ไขผ่าน API/Admin เท่านั้น

## Resource vocabulary

- `ContentItem`: stable ID, account ID, kind (`page|post`), locale-neutral key, status,
  version, timestamps และ soft-delete marker
- `ContentTranslation`: content ID, locale ID, slug/path, title, excerpt, structured blocks,
  SEO/GEO/AEO metadata, publication state และ version
- `Revision`: immutable snapshot hash, author, change summary, created time และ source version
- `WorkflowEvent`: transition, actor, request ID, source/target state และ occurred time
- `PublicationSchedule`: content translation, publish/unpublish time, expected version,
  idempotency key, lease/retry state และ failure reason ที่ไม่เผย secret
- `Taxonomy`: category/tag with account scope, normalized name/slug, version และ soft-delete

## Workflow

```text
draft -> review -> published -> archived
                 \-> scheduled -> published
draft/review/published -> archived
```

- `submit_review` ต้องมี content write permission
- `approve` ต้องมี review permission
- `publish` และ schedule ต้องมี publish permission
- rollback สร้าง `Revision` ใหม่และไม่แก้ snapshot เดิม
- transition ที่ไม่อยู่ในรายการคืน `409` หรือ `422` ตาม error contract
- ทุก successful transition append audit ภายใน transaction เดียวกับ state change

## Block contract

M3 รองรับเฉพาะ block types ที่ประกาศใน API schema และมี validator แยกต่อ type:

- `text`: visible text ที่ไม่เป็น raw executable HTML
- `image`: media asset ID, alt text และ dimensions
- `callout`: heading/body ที่ผ่าน text sanitization
- `answer`: direct answer ที่แสดงบนหน้า
- `steps`: ordered steps ที่แสดงบนหน้า
- `comparison`: rows/columns ที่แสดงบนหน้า

Unknown block type, malformed JSON, unsafe URL, oversized field หรือ data ที่ไม่สามารถ
สร้าง visible output ได้ต้องถูก reject ก่อน persistence

## Permission catalog

Permission key ต้องประกาศใน `publishing` module manifest และตรวจตาม account scope:

- `publishing.pages.read.own`
- `publishing.pages.write.own`
- `publishing.pages.review.any`
- `publishing.pages.publish.any`
- `publishing.revisions.read.own`
- `publishing.revisions.rollback.own`

ไม่ตรวจชื่อ role และไม่สร้าง role ใหม่เพื่อให้ contract นี้ทำงาน

## Mutation invariants

- strict JSON decoder, content-type validation และ request ID ทุก mutation
- `expected_version` required สำหรับ update/transition/rollback/schedule
- stale version คืน `409 content_version_conflict`
- duplicate idempotency key ไม่สร้าง revision/workflow/audit ซ้ำ
- actor มาจาก authenticated principal เท่านั้น
- audit payload redacts token, secret, raw block payload ที่ sensitive และ file bytes

## Admin API surface

- `GET|POST /api/v1/publishing/pages`
- `GET|PATCH|DELETE /api/v1/publishing/pages/{page_id}`
- `GET|POST /api/v1/publishing/posts`
- `GET|PATCH|DELETE /api/v1/publishing/posts/{post_id}`
- `GET /api/v1/publishing/content/{content_id}/revisions`
- `POST /api/v1/publishing/content/{content_id}/workflow`
- `POST /api/v1/publishing/content/{content_id}/preview`
- `GET|POST /api/v1/publishing/schedules`
- taxonomy routes remain bounded and account-scoped under `/api/v1/publishing/categories`
  and `/api/v1/publishing/tags`

All admin mutations require session authentication and CSRF protection. Lists are bounded,
cursor ordered and return projections instead of raw database rows.
