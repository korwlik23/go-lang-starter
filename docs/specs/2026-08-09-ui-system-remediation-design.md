# UI System Remediation Design

สถานะ: เลือกแนวทาง system-first แล้วจากการคุยครั้งนี้ ก่อน visual checkpoint อนุญาต
เฉพาะ representative pilots ที่ระบุ; ห้าม mass migration ไปหน้าอื่นจนกว่าจะอนุมัติ

## เป้าหมาย

ทำให้ Admin และ Public Site เปลี่ยนหน้าตาในอนาคตได้จากจุดกลางจริง โดยแก้รากของ
ปัญหา 3 เรื่องพร้อมกัน:

1. สี, surface, border, radius และ shadow กระจายอยู่ใน scoped styles ของแต่ละหน้า
2. รูปแบบซ้ำ เช่น page header, panel, toolbar, alert และ table frame ยังไม่ใช่
   shared components
3. navigation มีพฤติกรรมผิดจากสถาปัตยกรรมที่ตั้งใจไว้: Admin ตกกลับไปใช้รายการ
   hardcode ส่วน Public Site ซ่อน navigation บนมือถือโดยไม่มีทางเลือกทดแทน

ผลลัพธ์ที่ต้องการคือการเปลี่ยน palette, spacing, shape หรือโครงหน้าในภายหลังต้อง
แก้ที่ semantic tokens หรือ shared component ไม่ใช่ไล่แก้ทุกหน้า

## หลักฐานจากโค้ดปัจจุบัน

- `admin/src/app/navigation.ts` สร้างรายการเมนูจาก enabled modules และ permissions
  อยู่แล้ว แต่ parent route ใน `admin/src/app/router/core-routes.ts` ไม่ส่งรายการนั้น
  เข้า `admin/src/app/layouts/AdminRouteShell.vue`
- `AdminRouteShell.vue` จึงใช้ fallback navigation ที่ hardcode 8 รายการ และ
  `admin/src/shared/components/shell/Sidebar.vue` ใช้ `<a>` ซึ่ง reload ทั้ง SPA
- ใน `admin/src` พบ raw color 530 จุด, 68 ค่าสี และยังไม่มีการใช้ CSS custom
  properties ใน component styles
- Admin มี Vue components 65 ไฟล์; pattern `page-header`, `panel`, table wrapper และ
  error message ซ้ำข้ามหลาย module
- `site/src/styles/global.css` ซ่อน `nav` ทั้งหมดที่ viewport ไม่เกิน 760px และไม่มี
  mobile trigger/menu
- Public content และ block components ใช้ class หลายชุด แต่ไม่มี selector รองรับครบ
  ทำให้ home, CMS, blog, docs และ preview มี visual contract คนละชุด
- `admin/` และ `site/` เป็น Git submodules คนละ repository จึงห้าม import source
  ข้ามกัน

## แนวทางที่พิจารณา

### A. แก้ทีละหน้า

เร็วที่สุดสำหรับภาพหนึ่งหรือสองหน้า แต่ raw values และ pattern ซ้ำจะยังอยู่ การปรับ
ดีไซน์รอบถัดไปต้องแก้ซ้ำหลายสิบไฟล์ จึงไม่แก้ปัญหาที่ผู้ใช้ระบุ

### B. สร้างระบบกลางแยกในแต่ละ frontend แล้วค่อย migrate (เลือกแนวทางนี้)

Admin และ Site มี semantic vocabulary เหมือนกัน แต่มี token values และ components
ของตัวเอง จากนั้นย้าย representative screens ก่อนเพื่อขออนุมัติภาพจริง แล้วจึงย้าย
module อื่นเป็นชุดเล็ก ๆ ข้อดีคือเปลี่ยนหน้าตาภายหลังได้จากจุดกลางและ rollback ได้
เป็น milestone ข้อเสียคือมีงาน foundation ก่อนเห็นทุกหน้าเปลี่ยน

### C. สร้าง shared UI package ข้าม Admin และ Site

ลดชื่อ token ซ้ำได้บางส่วน แต่ Vue กับ Astro มี component model ต่างกัน และทั้งสอง
อยู่คนละ submodule การเพิ่ม package กลางจะสร้าง coupling, release coordination และ
build complexity เกินประโยชน์ในขอบเขตนี้

## สถาปัตยกรรมที่เลือก

ทั้งสอง frontend ใช้ชั้นเดียวกันตามลำดับนี้:

```text
semantic tokens
  -> base/accessibility rules
  -> UI primitives and visible shell
  -> feature components
  -> route views
```

ชื่อ token ใช้ semantic role เช่น canvas, surface, text, border, action, focus และ
status ไม่ใช้ชื่อสีเช่น `blue-500` เป็น public contract ค่าจริงของ Admin และ Site
เปลี่ยนได้อิสระ ภายใน feature page อนุญาต layout ที่เฉพาะกับงานนั้น แต่ห้ามนิยาม
palette, shadow หรือ radius ใหม่เอง

shared components ใช้ composition/slots และมี responsibility เดียว ไม่สร้าง
configurable mega-component ตัวอย่างสำคัญคือ table ใช้เพียง `UiTableFrame` สำหรับ
surface/overflow แล้วให้ feature render `<table><caption>…</caption></table>` และเป็น
เจ้าของ columns/business actions เอง เพื่อคง HTML semantics และไม่สร้าง generic
data-table engine

## File/module layout

### Admin: ไฟล์ใหม่

```text
admin/src/styles/tokens.css
  semantic tokens, light/dark values, type/space/radius/elevation scales
admin/src/styles/base.css
  reset, body, focus, reduced-motion and shared document defaults

admin/src/shared/components/ui/UiPage.vue
  page width and vertical rhythm slots
admin/src/shared/components/ui/UiPageHeader.vue
  title, description and action slots
admin/src/shared/components/ui/UiToolbar.vue
  filter and action grouping with responsive wrapping
admin/src/shared/components/ui/UiAlert.vue
  inline notice/error/success semantics and live-region policy
admin/src/shared/components/ui/UiTableFrame.vue
  surface/horizontal-overflow wrapper only; feature owns table/caption semantics

admin/src/modules/authorization/composables/useRoleAdministration.ts
  role loading, selection and mutation state; no presentation
admin/src/modules/authorization/components/RoleSummaryPanel.vue
  selected-role summary
admin/src/modules/authorization/components/RolePermissionProjection.vue
  permission projection table
admin/src/modules/authorization/components/RoleAssignmentsPanel.vue
  assignment form and assignment list

admin/src/modules/localization/composables/useCatalogEditor.ts
  catalog load/save/dirty-state and transfer orchestration
admin/src/modules/localization/components/CatalogTransferActions.vue
  import/export controls and file-input interaction

admin/tests/architecture/design-system.test.ts
  CSS/inline/arbitrary-value boundary, migration allowlist, handwritten 400-line
  ceiling and 200-line new-file guard
admin/tests/components/ui/LayoutComponents.test.ts
  shared layout, alert and table-frame contracts
admin/tests/components/authorization/RoleDetailsPanel.test.ts
  split authorization presentation contracts
admin/tests/components/localization/CatalogEditorView.test.ts
  split catalog composition and dirty-state contracts
admin/tests/components/localization/CatalogTransferActions.test.ts
  file selection/reset and typed command events
admin/tests/components/operations/OperationsViews.test.ts
  foundation/jobs/modules shared-layout adoption
admin/tests/components/localization/LocalizationViews.test.ts
  locales/catalog shared-layout adoption
admin/tests/components/identity/IdentityAdministrationViews.test.ts
  profile/users shared-layout adoption
admin/tests/components/accounts/MembershipsView.test.ts
  memberships table/state adoption
admin/tests/components/audit/AuditEventsView.test.ts
  audit filters/table/state adoption
admin/tests/components/notifications/NotificationsView.test.ts
  inbox states/actions adoption
admin/tests/components/settings/SettingsView.test.ts
  settings form/state adoption
admin/tests/e2e/fixtures/admin-api.ts
  authenticated session/module/permission API stubs shared by Admin E2E
admin/tests/e2e/design-system.spec.ts
  shell, navigation, responsive, keyboard and theme smoke coverage
```

ไฟล์กลางที่แก้คือ `admin/src/styles/main.css`, primitives ทั้งหมดใน
`admin/src/shared/components/ui/`, feedback components, shell components,
`admin/src/app/layouts/AdminRouteShell.vue`, `admin/src/app/layouts/AdminShell.vue`,
`admin/src/app/router/core-routes.ts`, `admin/playwright.config.ts` และ
`admin/src/modules/operations/views/UIComponentsView.vue`

ไฟล์ feature เดิมจะ migrate ตาม bounded context: authorization/localization,
operations, identity/accounts/audit/notifications/settings, publishing และ
media/navigation/discoverability รายการไฟล์ที่แน่นอนอยู่ใน implementation plan

### Public Site: ไฟล์ใหม่

```text
site/src/styles/tokens.css
  Site semantic tokens and light/dark values
site/src/styles/base.css
  reset, typography, focus, skip-link, RTL and reduced-motion defaults
site/src/styles/components/shell.css
  header, desktop/mobile views of one navigation model, language switcher and footer
site/src/styles/components/content.css
  CMS/blog/docs/preview/status typography and content layout
site/src/styles/components/blocks.css
  text, image, callout, answer, steps and comparison block presentation
site/src/styles/pages/home.css
  home-only hero, features, architecture and FAQ layout

site/src/components/site/PrimaryNavigation.astro
  localized link renderer invoked for desktop and mobile from the same item model
site/src/components/site/navigation-model.ts
  pure localized item/current-path model shared by both rendered nav instances
site/src/components/site/LanguageSwitcher.astro
  locale links that preserve the current content path
site/src/components/site/SiteHeader.astro
  desktop header and native mobile disclosure around the same navigation
site/src/components/site/SiteFooter.astro
  localized shared footer
site/src/components/site/Breadcrumbs.astro
  localized breadcrumb semantics
site/src/layouts/SiteLayout.astro
  visible site chrome composed inside BaseLayout
site/src/layouts/StatusLayout.astro
  minimal status document with route-provided robots policy and no registry dependency
site/src/views/StatusView.astro
  presentational 404/503 content inside StatusLayout
site/src/i18n/status-context.ts
  safe bundled locale/copy context when remote locale discovery is unavailable

site/tests/architecture/public-ui-system.test.ts
  raw-value boundary, selector coverage and migration allowlist
site/tests/e2e/public-shell.spec.ts
  desktop/mobile navigation, locale path, RTL and keyboard coverage
site/tests/e2e/public-content.spec.ts
  blog/CMS/block/long-content responsive coverage
site/tests/e2e/public-errors.spec.ts
  styled 404/503, actions and exact route-specific robots/cache regression coverage
site/tests/unit/status-context.test.ts
  English/Thai/requested-locale fallback behavior without remote data
site/tests/unit/navigation-model.test.ts
  exact home/blog/content/preview locale-path behavior
```

route flow ของหน้าปกติคือ
`route → SiteLayout → BaseLayout(document/head/body) → SiteHeader → <main id="main">`
`<slot /> → SiteFooter` โดย SiteLayout เป็น owner เดียวของ `<main>` และ forward
`metadata`, `indexable`, canonical, hreflang และ structured-data inputs เข้า BaseLayout
โดยไม่ recompute หรือเพิ่ม API request views ทุกตัวจึงเป็น fragment ที่ไม่มี `<main>`
ของตัวเอง `ArticleView.astro`/`DocsView.astro` ยังเป็น thin route-specific wrappers
ไม่ถูกรวมเป็น god view

`StatusLayout.astro` เป็นเอกสารขั้นต่ำสำหรับ degraded error branch ที่อาจไม่มี remote
locale registry จึงไม่สร้าง canonical/hreflang ปลอม และเพิ่ม robots/cache behavior
เฉพาะเมื่อ route เดิมมี contract นั้น

## Navigation contracts

### Admin

- parent route ส่ง `dependencies.navigation()` เข้า `AdminRouteShell` ผ่าน route props
- ลบ hardcoded fallback ทั้งหมด ถ้าไม่มี permission-filtered item ให้แสดงเฉพาะค่าที่
  builder อนุญาต ไม่เดาเมนูเพิ่ม
- Foundation item ต้องผ่าน `operations` module และ
  `operations.foundation.read.system` เหมือน route; ทุก item ต้องมี route metadata
  ที่ตรงกับ module/permission ของ builder
- `Sidebar.vue` ใช้ `RouterLink custom` และ `isExactActive` เพื่อไม่ให้ `/` active บน
  nested routes
- module disabled ยังคง 404 และ permission ไม่พอยังคง 403 ตาม guards เดิม

### Public Site

- ใช้ navigation item model/catalog เดียว แล้ว render `PrimaryNavigation` สองครั้ง:
  desktop และ mobile; CSS ต้องทำให้มองเห็นเพียงหนึ่งชุดต่อ viewport
- mobile ใช้ native `<details>/<summary>` แบบ in-flow; desktop ไม่ hydrate framework
  และ script เล็กมีหน้าที่ close-on-link/Escape พร้อมคืน focus ไป `<summary>` เท่านั้น
- trigger และ links มี touch target อย่างน้อย 44px, focus visible และใช้งานด้วย
  keyboard ได้
- language switcher รักษา content path และ preview route ไม่ใส่ preview secret/code
  ลง locale links
- current-path contract คือ home `""`, blog index `"blog"`, CMS/docs/post ใช้
  `content.path`, preview ไม่ส่ง pathและปิด language switcher; missing translation ไป
  same path แล้วรับ 404 ไม่ fallback ไปภาษาอื่น
- home ส่ง remote navigation catalog ที่โหลดอยู่แล้ว ส่วน content routes ใช้
  `bundledCatalog(locale, "navigation")`; ห้ามเพิ่ม network request ใหม่

## Public response-contract matrix

การเปลี่ยน presentation ต้องรักษา contract ต่อไปนี้แบบ route-level:

| State | Status/cache | SEO |
|---|---|---|
| normal public success | 200 + ETag/public cache ตาม route เดิม | canonical, hreflang, JSON-LD ตาม BaseLayout |
| matching ETag | 304 + ETag เดิม | ไม่มีการ render body ใหม่ |
| ordinary public 404 | 404; ไม่เพิ่ม `no-store` หาก route เดิมไม่มี | ไม่เพิ่ม robots header/meta ใหม่ในงานนี้ |
| public 503 branch ที่มีอยู่ | 503 + `cache-control: no-store` | ไม่สร้าง canonical/hreflang ปลอม |
| preview permanent 404 | 404 + `no-store` + `x-robots-tag: noindex, nofollow` | standalone status; ไม่เรียก API |
| preview exchange success/error | คง `previewHeaders()` และ one-time exchange semantics | ไม่มี canonical/hreflang/JSON-LD; code ไม่อยู่ใน links/actions |

`PublicContentUnavailableError` ที่ยังหลุดจากบาง content routes เป็น pre-existing
failure-classification defect ไม่ใช่ presentation change แผนนี้จะไม่อ้างว่าแก้ defect
ดังกล่าวและควรเปิด bugfix แยกด้วย `bug-debugging` หากต้องการเปลี่ยน bare 500 เป็น 503

## Visual checkpoint

ก่อน migrate ทุก module ต้อง render และส่งภาพจริงของชุดต่อไปนี้ให้ผู้ใช้ตรวจ:

- Admin: `/ui-components`, role administration และ shell/navigation
- Site: localized home, CMS pilot และ mobile menu
- viewport: 320px, 375px, 768px และ 1440px; light/dark และ long content
- English/Thai/RTL matrix ใช้กับ Site; Admin ยังไม่มี runtime UI i18n ในขอบเขตนี้

การอนุมัติตรงนี้ล็อก visual direction ของรอบนั้น หากไม่ผ่าน ให้แก้เฉพาะ tokens และ
shared components แล้วถ่ายใหม่ ห้ามเริ่ม mass migration เพื่อหลีกเลี่ยงการกระจาย
ดีไซน์ที่ผู้ใช้ยังไม่ชอบไปทุกหน้า

## Behavior ที่ต้องรักษา

- ไม่เปลี่ยน API contracts, query/mutation behavior, validation หรือ native media
  file-picker semantics
- ไม่เปลี่ยน secure session, MFA, CSRF, permission default-deny หรือ module gating
- ไม่เปลี่ยน CMS draft/review/publish/schedule/revision/preview workflow
- Public locale URLs, 404/503 status, cache headers, canonical, hreflang, robots และ
  structured data ต้องเหมือนเดิม; `StatusLayout`/`StatusView` เปลี่ยน presentation
  เท่านั้นและต้องไม่กลืน unknown errors
- ไม่เพิ่ม UI framework, client state library หรือ cross-repo shared package

## Rollout และ rollback

1. เพิ่ม guardrails แบบ baseline allowlist เพื่อกัน debt ใหม่ก่อน
2. เพิ่ม Admin tokens/primitives/pilots และ Site tokens/shell/home/CMS route เดียว
3. commit child pilot revisions และผ่าน visual checkpoint
4. หลังอนุมัติเท่านั้นจึง migrate Admin bounded contexts และ Site blog/docs/blocks/
   preview/status พร้อมลบ allowlist ทีละชุด
5. เมื่อ allowlist ว่าง รัน full gates ของแต่ละ submodule
6. ทำให้ child commits reachable แล้วอัปเดต parent gitlinks, release fixture,
   hardcoded pin test และ localization checksum โดยไม่แตะ API pin

แต่ละ batch ต้องเป็น commit แยกและ revert ได้โดยไม่ย้อน API/backend การ rollback
theme ทำได้จาก token commit; rollback feature migration ทำได้เป็น module batch

## Acceptance criteria

- raw palette/shadow/radius ไม่มีอยู่นอก token/primitives boundary ที่ระบุ และ
  architecture tests ป้องกันการย้อนกลับ
- repeated page shell patterns ใช้ shared components; feature pages เหลือเฉพาะ
  business-specific layout/state
- Admin ไม่มี hardcoded fallback navigation และเห็นเฉพาะรายการที่ผ่าน module และ
  permission filters
- Public navigation เข้าถึงได้ที่ 320/375/414px โดยไม่ซ่อนทางออกของผู้ใช้
- home, CMS, blog, docs, preview, empty, 404 และ 503 มี style contract ครบ โดย HTTP/
  cache/SEO headers ตรงกับ response-contract matrix
- keyboard, focus, 44px targets, contrast, RTL, reduced motion, long content และ
  horizontal overflow ผ่าน browser checks ที่กำหนด
- Admin และ Site lint/typecheck/check/test/build/E2E ผ่าน และ parent structure/integration
  checks ผ่านหลังอัปเดต submodule pins

## นอกขอบเขต

- ยังไม่เพิ่ม theme toggle; ใช้ `prefers-color-scheme`
- ไม่สร้าง generic data-grid, form builder หรือ page-builder UI abstraction
- ไม่เปลี่ยน information architecture, API, database หรือ publishing semantics
- ไม่แก้ bootstrap lifecycle/blank-screen resilience ในรอบนี้; ให้ติดตามเป็นงาน UX
  แยกเพื่อไม่ขยาย remediation เกินปัญหา hardcode/component/navigation
- ไม่แก้ pre-existing `PublicContentUnavailableError` classification หรือเพิ่ม
  `Referrer-Policy` ให้ preview แบบเงียบ ๆ; สองเรื่องนี้ต้องเป็น security/bugfix design
  แยกพร้อม tests ก่อนเปลี่ยน behavior
