# Implementation Plan: UI System Remediation

Design ref: `docs/specs/2026-08-09-ui-system-remediation-design.md`

แนวทางที่เลือกคือสร้าง design-system boundary แยกใน `admin/` และ `site/`, แก้
permission-aware/mobile navigation ที่ต้นทาง, ทำ Admin representative screens และ
Site home/CMS pilot แล้วหยุดรอ visual approval ก่อนย้ายหน้าอื่น งาน implementation
ใช้ `test-driven-development` + `frontend-ux-engineering`; ทุก task ด้านล่างให้เขียน
focused assertion ก่อน, รันจนเห็น RED ด้วยเหตุผลที่คาด, ทำเฉพาะ GREEN ของ task นั้น
และห้าม commit/ไป task ถัดไปจนคำสั่ง Verify exit 0

## Milestone 1 — Admin guardrails และ shared UI

### Task 1 — ล็อก Admin design-system boundary

- **Files:** `admin/tests/architecture/design-system.test.ts`
- **Change:** สร้าง validator สำหรับ CSS files, Vue `<style>`, inline `style`/`:style`
  และ Tailwind arbitrary color/radius/shadow values; อนุญาต raw values เฉพาะ
  `tokens.css` และ explicit legacy allowlist ห้าม violation ใหม่ ตรวจ handwritten
  `.vue`/`.ts` ต่ำกว่า 400 บรรทัดด้วย legacy size baseline และไฟล์ใหม่ไม่เกิน 200
  บรรทัด; exclude generated clients; ทดสอบ validator ด้วย inline invalid sources
- **Verify:** `pnpm --dir admin exec vitest run tests/architecture/design-system.test.ts`

### Task 2 — นิยาม Admin semantic tokens

- **Files:** `admin/src/styles/tokens.css`,
  `admin/tests/architecture/design-system.test.ts`
- **Change:** เพิ่ม light/dark tokens สำหรับ canvas/surface/text/border/action/focus/
  feedback, type, space, width, radius, elevation และ motion; เพิ่ม test ว่า token
  references resolve และชื่อ public token ไม่ผูกกับชื่อสี
- **Verify:** `pnpm --dir admin exec vitest run tests/architecture/design-system.test.ts`

### Task 3 — แยก Admin base stylesheet

- **Files:** `admin/src/styles/base.css`, `admin/src/styles/main.css`
- **Change:** ให้ `main.css` import Tailwind, tokens และ base ตามลำดับ; ย้าย reset,
  body, focus, skip-link และ reduced-motion ไป base โดยใช้ tokens
- **Verify:** `pnpm --dir admin exec vitest run tests/architecture/design-system.test.ts && pnpm --dir admin lint && pnpm --dir admin typecheck && pnpm --dir admin build`

### Task 4 — Migrate action/surface primitives แบบ RED→GREEN

- **Files:** `admin/tests/components/ui/UIComponents.test.ts`,
  `admin/src/shared/components/ui/UiButton.vue`,
  `admin/src/shared/components/ui/UiBadge.vue`,
  `admin/src/shared/components/ui/UiCard.vue`
- **Change:** เพิ่ม focused contract `action and surface primitives` แล้ว migrate
  variants/loading/disabled/status/surface ไป semantic tokens; คง presentation-only
- **Verify:** `pnpm --dir admin exec vitest run tests/components/ui/UIComponents.test.ts -t "action and surface primitives" && pnpm --dir admin exec vitest run tests/architecture/design-system.test.ts`

### Task 5 — Migrate text-entry primitives แบบ RED→GREEN

- **Files:** `admin/tests/components/ui/UIComponents.test.ts`,
  `admin/src/shared/components/ui/UiInput.vue`,
  `admin/src/shared/components/ui/UiTextarea.vue`,
  `admin/src/shared/components/ui/UiSelect.vue`,
  `admin/src/shared/components/ui/UiFileInput.vue`
- **Change:** เพิ่ม focused contract `text entry primitives`; ใช้ field/surface/focus/
  error tokens ชุดเดียว รักษา native input/file semantics, typed model และ labels
- **Verify:** `pnpm --dir admin exec vitest run tests/components/ui/UIComponents.test.ts -t "text entry primitives" && pnpm --dir admin exec vitest run tests/architecture/design-system.test.ts`

### Task 6 — Migrate selection/field/empty primitives แบบ RED→GREEN

- **Files:** `admin/tests/components/ui/UIComponents.test.ts`,
  `admin/src/shared/components/ui/UiCheckbox.vue`,
  `admin/src/shared/components/ui/UiRadio.vue`,
  `admin/src/shared/components/ui/UiField.vue`,
  `admin/src/shared/components/ui/UiEmptyState.vue`
- **Change:** เพิ่ม focused contract `selection and field feedback`; ใช้ tokens,
  ผูก hint/error ด้วย `aria-describedby` และไม่บังคับ business copy ใน empty state
- **Verify:** `pnpm --dir admin exec vitest run tests/components/ui/UIComponents.test.ts -t "selection and field feedback" && pnpm --dir admin exec vitest run tests/architecture/design-system.test.ts`

### Task 7 — สร้าง page shell primitives แบบ RED→GREEN

- **Files:** `admin/tests/components/ui/LayoutComponents.test.ts`,
  `admin/src/shared/components/ui/UiPage.vue`,
  `admin/src/shared/components/ui/UiPageHeader.vue`,
  `admin/src/shared/components/ui/index.ts`
- **Change:** เพิ่ม contract `page shell`; สร้าง slot-based page width/rhythm และ
  title/description/actions โดยไม่รับ feature data
- **Verify:** `pnpm --dir admin exec vitest run tests/components/ui/LayoutComponents.test.ts -t "page shell"`

### Task 8 — สร้าง toolbar/alert/table frame แบบ RED→GREEN

- **Files:** `admin/tests/components/ui/LayoutComponents.test.ts`,
  `admin/src/shared/components/ui/UiToolbar.vue`,
  `admin/src/shared/components/ui/UiAlert.vue`,
  `admin/src/shared/components/ui/UiTableFrame.vue`,
  `admin/src/shared/components/ui/index.ts`
- **Change:** เพิ่ม contract `toolbar alert and table frame`; toolbar wrap responsive,
  alert กำหนด role/live policy และ table frame มีเฉพาะ surface/overflow Feature ต้อง
  render `<table>`/`<caption>` เอง
- **Verify:** `pnpm --dir admin exec vitest run tests/components/ui/LayoutComponents.test.ts -t "toolbar alert and table frame" && pnpm --dir admin exec vitest run tests/architecture/design-system.test.ts`

## Milestone 2 — Admin navigation และ representative pilots

### Task 9 — แก้ navigation builder และ parent route แบบ RED→GREEN

- **Files:** `admin/src/app/navigation.ts`,
  `admin/src/app/router/core-routes.ts`,
  `admin/src/app/layouts/AdminRouteShell.vue`,
  `admin/tests/routes/core-routes.test.ts`,
  `admin/tests/routes/guards.test.ts`,
  `admin/tests/components/AdminRouteShell.test.ts`,
  `admin/tests/components/cms-navigation.test.ts`
- **Change:** test ก่อนว่า Foundation ต้องผ่าน `operations` +
  `operations.foundation.read.system`, ทุก item ตรงกับ route meta, disabled module →
  404, missing permission → 403 และ parent route ส่ง dynamic props; จากนั้นย้าย
  `navigationItems` ออกจาก child Foundation props, gate builder และลบ fallback 8 เมนู
- **Verify:** `pnpm --dir admin exec vitest run tests/components/cms-navigation.test.ts tests/components/AdminRouteShell.test.ts tests/routes/core-routes.test.ts tests/routes/guards.test.ts`

### Task 10 — ใช้ exact SPA navigation แบบ RED→GREEN

- **Files:** `admin/src/shared/components/shell/Sidebar.vue`,
  `admin/tests/components/AdminNavigation.test.ts`
- **Change:** test nested route ก่อน; ใช้ `RouterLink custom` + `isExactActive`, คง
  `href` data contract, ป้องกัน `/` active ทุกหน้าและไม่ reload SPA
- **Verify:** `pnpm --dir admin exec vitest run tests/components/AdminNavigation.test.ts`

### Task 11 — ทำ Admin browser harness ให้รันได้

- **Files:** `admin/playwright.config.ts`,
  `admin/tests/e2e/fixtures/admin-api.ts`,
  `admin/tests/e2e/design-system.spec.ts`
- **Change:** ใช้ `pnpm exec vite --host 127.0.0.1 --port 5174`; สร้าง deterministic
  stubs สำหรับ session/modules/permissions และ role list/permissions/assignments;
  เพิ่ม shell/navigation viewport/focus/touch-target assertions
- **Verify:** `pnpm --dir admin exec playwright test tests/e2e/login-smoke.spec.ts tests/e2e/design-system.spec.ts`

### Task 12 — แยก role state แบบ RED→GREEN

- **Files:** `admin/tests/components/RoleAdministrationView.test.ts`,
  `admin/src/modules/authorization/composables/useRoleAdministration.ts`,
  `admin/src/modules/authorization/views/RoleAdministrationView.vue`
- **Change:** characterize load/select/create/rename/assign/remove และ busy/error/success
  ก่อน; ย้าย refs/computed/API orchestration เข้า composable โดยไม่เปลี่ยน client calls
- **Verify:** `pnpm --dir admin exec vitest run tests/components/RoleAdministrationView.test.ts && pnpm --dir admin exec vitest run tests/architecture/design-system.test.ts`

### Task 13 — แยก role detail sections แบบ RED→GREEN

- **Files:** `admin/tests/components/authorization/RoleDetailsPanel.test.ts`,
  `admin/src/modules/authorization/components/RoleSummaryPanel.vue`,
  `admin/src/modules/authorization/components/RolePermissionProjection.vue`,
  `admin/src/modules/authorization/components/RoleAssignmentsPanel.vue`,
  `admin/src/modules/authorization/components/RoleDetailsPanel.vue`
- **Change:** เพิ่ม typed props/events contract แล้วแยก summary, permission projection
  และ assignments; subcomponents ใช้ shared UI/tokens และไม่มี API calls
- **Verify:** `pnpm --dir admin exec vitest run tests/components/authorization/RoleDetailsPanel.test.ts && pnpm --dir admin exec vitest run tests/architecture/design-system.test.ts`

### Task 14 — ประกอบ role pilot ด้วย shared UI

- **Files:** `admin/src/modules/authorization/views/RoleAdministrationView.vue`,
  `admin/src/modules/authorization/components/RoleDirectoryPanel.vue`,
  `admin/src/modules/authorization/components/RoleDetailsPanel.vue`,
  `admin/src/modules/authorization/components/RoleSummaryPanel.vue`,
  `admin/src/modules/authorization/components/RolePermissionProjection.vue`,
  `admin/src/modules/authorization/components/RoleAssignmentsPanel.vue`,
  `admin/tests/components/RoleAdministrationView.test.ts`
- **Change:** compose `UiPage`, header, toolbar, card, alert และ table frame; ลบ raw/
  duplicated styles และให้ view/components ใหม่ต่ำกว่า size thresholds
- **Verify:** `pnpm --dir admin exec vitest run tests/components/RoleAdministrationView.test.ts tests/components/authorization/RoleDetailsPanel.test.ts tests/architecture/design-system.test.ts`

### Task 15 — แยก catalog state แบบ RED→GREEN

- **Files:** `admin/tests/components/localization/CatalogEditorView.test.ts`,
  `admin/src/modules/localization/composables/useCatalogEditor.ts`,
  `admin/src/modules/localization/views/CatalogEditorView.vue`
- **Change:** characterize initialize/load/save/dirty confirmation/import/export ก่อน;
  composable เป็น owner ของ API, import validation, export Blob, dirty/transfer state
  และ `beforeunload` cleanup
- **Verify:** `pnpm --dir admin exec vitest run tests/components/localization/CatalogEditorView.test.ts tests/unit/catalog-merge.test.ts && pnpm --dir admin exec vitest run tests/architecture/design-system.test.ts`

### Task 16 — แยก catalog transfer controls แบบ RED→GREEN

- **Files:** `admin/tests/components/localization/CatalogTransferActions.test.ts`,
  `admin/src/modules/localization/components/CatalogTransferActions.vue`,
  `admin/src/modules/localization/views/CatalogEditorView.vue`
- **Change:** component เป็น owner ของ controls/file selection/reset และ emit typed
  commands เท่านั้น; compose catalog view ด้วย shared page/toolbar/alert/table UI
- **Verify:** `pnpm --dir admin exec vitest run tests/components/localization/CatalogTransferActions.test.ts tests/components/localization/CatalogEditorView.test.ts tests/architecture/design-system.test.ts`

### Task 17 — Migrate Admin shell/feedback/showcase pilot

- **Files:** `admin/src/app/layouts/AdminShell.vue`,
  `admin/src/shared/components/shell/Header.vue`,
  `admin/src/shared/components/shell/LocaleSwitcher.vue`,
  `admin/src/shared/components/shell/Sidebar.vue`,
  `admin/src/shared/components/feedback/LoadingState.vue`,
  `admin/src/shared/components/feedback/ErrorState.vue`,
  `admin/src/shared/components/feedback/ForbiddenState.vue`,
  `admin/src/shared/components/feedback/NotFoundState.vue`,
  `admin/src/modules/operations/views/UIComponentsView.vue`,
  `admin/tests/components/AdminShell.test.ts`,
  `admin/tests/components/FeedbackStates.test.ts`,
  `admin/tests/components/ui/UIComponents.test.ts`
- **Change:** เพิ่ม focused regression cases แล้วใช้ tokens/shared patterns กับ shell,
  loading/error/403/404 และ showcase; responsive/contrast/44px ตรวจใน Playwright ไม่
  claim จาก jsdom
- **Verify:** `pnpm --dir admin exec vitest run tests/components/AdminShell.test.ts tests/components/FeedbackStates.test.ts tests/components/ui/UIComponents.test.ts && pnpm --dir admin exec playwright test tests/e2e/design-system.spec.ts`

## Milestone 3 — Public Site foundation และ pilots เท่านั้น

### Task 18 — ล็อก Site design-system boundary

- **Files:** `site/tests/architecture/public-ui-system.test.ts`,
  `site/src/styles/global.css`
- **Change:** validator ห้าม raw palette/shadow/radius นอก tokens, generic hidden-nav
  selector และ block class ที่ไม่มี selector; ใช้ explicit legacy allowlist และ inline
  invalid CSS tests ระหว่าง migration `global.css` ยังเก็บ legacy rules ไว้เพื่อไม่ทำ
  หน้าเดิมเสีย style จน owner layer ถูกสร้าง
- **Verify:** `pnpm --dir site exec vitest run tests/architecture/public-ui-system.test.ts`

### Task 19 — เพิ่ม Site tokens/base โดยไม่ถอด legacy styles

- **Files:** `site/src/styles/tokens.css`, `site/src/styles/base.css`,
  `site/src/styles/global.css`
- **Change:** เพิ่ม light/dark semantic tokens และ import tokens/base ก่อน legacy rules;
  base รับ reset, typography, focus, skip-link, logical properties, RTL และ reduced
  motion โดยห้ามลบ home rules ใน task นี้
- **Verify:** `pnpm --dir site exec vitest run tests/architecture/public-ui-system.test.ts && pnpm --dir site check && pnpm --dir site build`

### Task 20 — สร้าง localized navigation model แบบ RED→GREEN

- **Files:** `site/tests/unit/navigation-model.test.ts`,
  `site/src/components/site/navigation-model.ts`,
  `site/src/components/site/PrimaryNavigation.astro`,
  `site/src/components/site/LanguageSwitcher.astro`,
  `site/src/locales/en/navigation.json`,
  `site/src/locales/th/navigation.json`,
  `site/src/locales/en/common.json`,
  `site/src/locales/th/common.json`
- **Change:** unit-test path contract ก่อน; item model มีเฉพาะ
  features/architecture/FAQ,
  home path `""`, blog `"blog"`, content `content.path`; switcher ไป same path และ
  missing translation รับ 404 ไม่ fallback ภาษาอื่น
- **Verify:** `pnpm --dir site exec vitest run tests/unit/navigation-model.test.ts && pnpm --dir site check`

### Task 21 — สร้าง desktop/mobile header แบบ RED→GREEN

- **Files:** `site/src/components/site/SiteHeader.astro`,
  `site/src/components/site/PrimaryNavigation.astro`,
  `site/src/styles/components/shell.css`,
  `site/src/styles/global.css`,
  `site/tests/e2e/public-shell.spec.ts`
- **Change:** render PrimaryNavigation สองครั้งจาก catalog เดียว; desktop/mobile CSS
  ทำให้มองเห็นหนึ่งชุดต่อ viewport; mobile `<details>/<summary>` ปิดด้วย link/Escape
  และคืน focus; ตรวจ 320/375/414/768/1024/1440, 44px, focus, overflow, reduced
  motion และ light/dark
- **Verify:** `pnpm --dir site exec playwright test tests/e2e/public-shell.spec.ts --grep "header|mobile navigation"`

### Task 22 — สร้าง shared footer และ breadcrumbs แบบ RED→GREEN

- **Files:** `site/src/components/site/SiteFooter.astro`,
  `site/src/components/site/Breadcrumbs.astro`,
  `site/src/styles/components/shell.css`,
  `site/src/locales/en/common.json`,
  `site/src/locales/th/common.json`,
  `site/tests/e2e/public-shell.spec.ts`
- **Change:** เพิ่ม localized footer/breadcrumb labels, semantic landmarks และ long
  text wrapping โดยไม่เพิ่ม IA links
- **Verify:** `pnpm --dir site exec playwright test tests/e2e/public-shell.spec.ts --grep "footer|breadcrumbs"`

### Task 23 — สร้าง SiteLayout integration boundary

- **Files:** `site/src/layouts/SiteLayout.astro`,
  `site/tests/e2e/public-shell.spec.ts`
- **Change:** SiteLayout forward BaseLayout metadata/indexable props โดยไม่ recompute,
  เป็น owner เดียวของ `<main id="main">`, header/footer และรับ resolved navigation;
  BaseLayout คง document/SEO owner และไม่มี API call ใหม่
- **Verify:** `pnpm --dir site check && pnpm --dir site exec playwright test tests/e2e/public-shell.spec.ts --grep "landmarks|SEO passthrough"`

### Task 24 — Migrate localized home pilot แบบ RED→GREEN

- **Files:** `site/src/pages/[locale]/index.astro`,
  `site/src/views/HomeView.astro`,
  `site/src/styles/pages/home.css`,
  `site/src/styles/global.css`,
  `site/tests/e2e/public-shell.spec.ts`
- **Change:** route ใช้ SiteLayout และ remote navigation catalog เดิม; HomeView เป็น
  fragment ไม่มี header/main/footer; ย้าย hero/features/architecture/FAQ rules ออกจาก
  legacy global และเอา hardcoded UI copy ออก
- **Verify:** `pnpm --dir site exec playwright test tests/e2e/public-shell.spec.ts --grep "home pilot" && pnpm --dir site exec vitest run tests/integration/locale-route.test.ts tests/unit/seo.test.ts`

### Task 25 — Migrate CMS route เดียวเป็น content pilot แบบ RED→GREEN

- **Files:** `site/tests/e2e/public-content.spec.ts`,
  `site/tests/fixtures/mock-site-api.mjs`,
  `site/src/pages/[locale]/[...slug].astro`,
  `site/src/views/CmsPageView.astro`,
  `site/src/styles/components/content.css`,
  `site/src/styles/components/blocks.css`,
  `site/src/styles/global.css`
- **Change:** เพิ่ม text-only CMS/long-content fixture; route ใช้ SiteLayout กับ bundled
  navigation (ไม่มี request ใหม่), `currentPath=content.path`; view เป็น fragment ใช้
  Breadcrumbs และ content tokens; blocks.css เริ่มเฉพาะ text block pilot คง 200/304/
  ETag/cache/canonical/hreflang/JSON-LD เดิม
- **Verify:** `pnpm --dir site exec playwright test tests/e2e/public-content.spec.ts --grep "CMS pilot|public response contract" && pnpm --dir site exec vitest run tests/integration/content-routes.test.ts tests/unit/seo.test.ts`

## Milestone 4 — Visual approval gate

### Task 26 — Capture representative browser matrix

- **Files:** `admin/tests/e2e/design-system.spec.ts`,
  `site/tests/e2e/public-shell.spec.ts`,
  `site/tests/e2e/public-content.spec.ts`,
  `tmp/ui-review/admin/` และ `tmp/ui-review/site/` (generated artifacts)
- **Change:** เพิ่ม deterministic screenshots ของ Admin showcase/role/shell และ Site
  home/CMS/mobile menu ที่ 320, 375, 768, 1440px; light/dark; Site English/Thai/RTL;
  วัด contrast คู่หลักจาก computed colors และตรวจ focus/overflow/44px
- **Verify:** `pnpm --dir admin exec playwright test tests/e2e/design-system.spec.ts && pnpm --dir site exec playwright test tests/e2e/public-shell.spec.ts tests/e2e/public-content.spec.ts` และ artifact matrix ครบตามชื่อ viewport/theme/locale

### Task 27 — บันทึก visual approval (blocking)

- **Files:** `docs/specs/2026-08-09-ui-system-remediation-design.md`
- **Change:** ส่ง artifacts ให้ผู้ใช้; หากไม่ผ่านให้แก้เฉพาะ tokens/shared components
  และ rerun Task 26 เมื่อผ่านให้บันทึก approval date, scope และ exact Admin/Site pilot
  commit SHAs ห้ามเริ่ม Task 28 ก่อนมีข้อความอนุมัติ
- **Verify:** design spec มี approval record ที่อ้าง artifact matrix รอบล่าสุดและ child
  commits ทั้งสอง reachable จาก repository ที่เกี่ยวข้อง

## Milestone 5 — Admin migration หลัง visual approval

### Task 28 — Migrate Foundation view

- **Files:** `admin/src/modules/operations/views/FoundationStatusView.vue`,
  `admin/tests/components/operations/OperationsViews.test.ts`
- **Change:** test states ก่อนแล้วใช้ page/card/alert patterns; รักษา retry/module status
- **Verify:** `pnpm --dir admin exec vitest run tests/components/operations/OperationsViews.test.ts -t "foundation" && pnpm --dir admin exec vitest run tests/architecture/design-system.test.ts`

### Task 29 — Migrate Jobs/Modules views

- **Files:** `admin/src/modules/operations/views/JobsView.vue`,
  `admin/src/modules/operations/views/ModulesView.vue`,
  `admin/tests/components/operations/OperationsViews.test.ts`
- **Change:** test actions/tables/states ก่อนแล้วใช้ shared page/table/alert UI
- **Verify:** `pnpm --dir admin exec vitest run tests/components/operations/OperationsViews.test.ts -t "jobs and modules" && pnpm --dir admin exec vitest run tests/architecture/design-system.test.ts`

### Task 30 — Migrate remaining localization views

- **Files:** `admin/src/modules/localization/views/LocalesView.vue`,
  `admin/src/modules/localization/components/CatalogEntryEditor.vue`,
  `admin/tests/components/localization/LocalizationViews.test.ts`
- **Change:** test locale actions/editor validation ก่อนแล้วใช้ shared layout/fields
- **Verify:** `pnpm --dir admin exec vitest run tests/components/localization/LocalizationViews.test.ts tests/unit/localization.client.test.ts tests/architecture/design-system.test.ts`

### Task 31 — Migrate login/MFA presentation

- **Files:** `admin/src/modules/identity/components/LoginForm.vue`,
  `admin/src/modules/identity/components/login-form.css`,
  `admin/src/modules/identity/components/MfaChallengeForm.vue`,
  `admin/src/modules/identity/views/LoginView.vue`,
  `admin/src/modules/identity/views/MfaChallengeView.vue`,
  `admin/tests/components/LoginForm.test.ts`,
  `admin/tests/components/LoginView.test.ts`,
  `admin/tests/components/MfaChallenge.test.ts`
- **Change:** characterize session/returnTo/validation/busy ก่อนแล้ว migrate styles/forms;
  ไม่เปลี่ยน auth/MFA/CSRF calls
- **Verify:** `pnpm --dir admin exec vitest run tests/components/LoginForm.test.ts tests/components/LoginView.test.ts tests/components/MfaChallenge.test.ts tests/unit/bootstrap.test.ts tests/unit/auth-client.test.ts tests/unit/login-mutation.test.ts tests/architecture/design-system.test.ts`

### Task 32 — Migrate profile/users views

- **Files:** `admin/src/modules/identity/views/ProfileView.vue`,
  `admin/src/modules/identity/views/UsersView.vue`,
  `admin/tests/components/identity/IdentityAdministrationViews.test.ts`
- **Change:** test profile/user loading/error/actions ก่อนแล้วใช้ shared page/table/form UI
- **Verify:** `pnpm --dir admin exec vitest run tests/components/identity/IdentityAdministrationViews.test.ts tests/architecture/design-system.test.ts`

### Task 33 — Migrate memberships view

- **Files:** `admin/src/modules/accounts/views/MembershipsView.vue`,
  `admin/tests/components/accounts/MembershipsView.test.ts`
- **Change:** test scope/filter/table/actions ก่อนแล้ว migrate shared UI โดยคง permission
- **Verify:** `pnpm --dir admin exec vitest run tests/components/accounts/MembershipsView.test.ts tests/architecture/design-system.test.ts`

### Task 34 — Migrate audit view

- **Files:** `admin/src/modules/audit/views/AuditEventsView.vue`,
  `admin/tests/components/audit/AuditEventsView.test.ts`
- **Change:** test filters/loading/error/table ก่อนแล้ว migrate shared UI
- **Verify:** `pnpm --dir admin exec vitest run tests/components/audit/AuditEventsView.test.ts tests/unit/audit.client.test.ts tests/architecture/design-system.test.ts`

### Task 35 — Migrate notifications view

- **Files:** `admin/src/modules/notifications/views/NotificationsView.vue`,
  `admin/tests/components/notifications/NotificationsView.test.ts`
- **Change:** test inbox empty/read/actions ก่อนแล้ว migrate shared UI
- **Verify:** `pnpm --dir admin exec vitest run tests/components/notifications/NotificationsView.test.ts tests/architecture/design-system.test.ts`

### Task 36 — Migrate settings view

- **Files:** `admin/src/modules/settings/views/SettingsView.vue`,
  `admin/tests/components/settings/SettingsView.test.ts`
- **Change:** test load/dirty/save/error ก่อนแล้ว migrate shared form/alert UI
- **Verify:** `pnpm --dir admin exec vitest run tests/components/settings/SettingsView.test.ts tests/architecture/design-system.test.ts`

### Task 37 — Migrate publishing lists/review

- **Files:** `admin/src/modules/publishing/views/ContentList.vue`,
  `admin/src/modules/publishing/views/ReviewQueue.vue`,
  `admin/src/modules/publishing/components/WorkflowActions.vue`,
  `admin/tests/components/publishing/ReviewQueue.test.ts`
- **Change:** test permission metadata/workflow actions ก่อนแล้วใช้ shared page/table/alert
- **Verify:** `pnpm --dir admin exec vitest run tests/components/publishing/ReviewQueue.test.ts tests/routes/cms-routes.test.ts tests/unit/publishing-client.test.ts tests/architecture/design-system.test.ts`

### Task 38 — Migrate revisions/schedule

- **Files:** `admin/src/modules/publishing/views/RevisionHistory.vue`,
  `admin/src/modules/publishing/views/ScheduleView.vue`,
  `admin/src/modules/publishing/components/RevisionDiff.vue`,
  `admin/src/modules/publishing/components/ScheduleForm.vue`,
  `admin/tests/components/publishing/RevisionHistory.test.ts`
- **Change:** test revision/schedule states/actions ก่อนแล้ว migrate shared UI; คง
  preview/schedule workflow
- **Verify:** `pnpm --dir admin exec vitest run tests/components/publishing/RevisionHistory.test.ts tests/routes/cms-routes.test.ts tests/unit/publishing-client.test.ts tests/architecture/design-system.test.ts`

### Task 39 — Migrate content editor shell/form

- **Files:** `admin/src/modules/publishing/views/ContentEditor.vue`,
  `admin/src/modules/publishing/components/ContentForm.vue`,
  `admin/tests/components/publishing/ContentEditor.test.ts`
- **Change:** characterize schema/dirty/save/error ก่อนแล้วใช้ page/card/alert/form UI;
  ไม่สร้าง form builder
- **Verify:** `pnpm --dir admin exec vitest run tests/components/publishing/ContentEditor.test.ts tests/unit/publishing-schema.test.ts tests/routes/cms-routes.test.ts tests/architecture/design-system.test.ts`

### Task 40 — Migrate publishing field/block/preview components

- **Files:** `admin/src/modules/publishing/components/ContentIdentityFields.vue`,
  `admin/src/modules/publishing/components/ContentMetadataFields.vue`,
  `admin/src/modules/publishing/components/BlockEditor.vue`,
  `admin/src/modules/publishing/components/PreviewLink.vue`,
  `admin/tests/components/publishing/ContentEditor.test.ts`
- **Change:** test field/block/preview behavior ก่อนแล้วใช้ shared primitives; คง native
  controls, schema และ preview URL behavior
- **Verify:** `pnpm --dir admin exec vitest run tests/components/publishing/ContentEditor.test.ts tests/unit/publishing-schema.test.ts tests/routes/cms-routes.test.ts tests/architecture/design-system.test.ts`

### Task 41 — Migrate media module

- **Files:** `admin/src/modules/media/components/MediaDetails.vue`,
  `admin/src/modules/media/components/MediaUploader.vue`,
  `admin/src/modules/media/views/MediaLibraryView.vue`,
  `admin/tests/components/media/MediaLibrary.test.ts`
- **Change:** test upload/select/error ก่อนแล้ว use shared UI; native file input remains
- **Verify:** `pnpm --dir admin exec vitest run tests/components/media/MediaLibrary.test.ts tests/architecture/design-system.test.ts`

### Task 42 — Migrate navigation module

- **Files:** `admin/src/modules/navigation/components/MenuTreeEditor.vue`,
  `admin/src/modules/navigation/views/MenuEditorView.vue`,
  `admin/src/modules/navigation/views/MenuListView.vue`,
  `admin/tests/components/navigation/MenuEditor.test.ts`
- **Change:** test tree keyboard/actions ก่อนแล้ว migrate surfaces/forms; คง menu behavior
- **Verify:** `pnpm --dir admin exec vitest run tests/components/navigation/MenuEditor.test.ts tests/architecture/design-system.test.ts`

### Task 43 — Migrate discoverability module

- **Files:** `admin/src/modules/discoverability/components/ContentAuditPanel.vue`,
  `admin/src/modules/discoverability/views/DiscoverabilityView.vue`,
  `admin/src/modules/discoverability/views/RedirectsView.vue`,
  `admin/tests/components/discoverability/Discoverability.test.ts`
- **Change:** test audit/redirect/actions ก่อนแล้ว migrate page/table/alert UI
- **Verify:** `pnpm --dir admin exec vitest run tests/components/discoverability/Discoverability.test.ts tests/architecture/design-system.test.ts`

### Task 44 — ปิด Admin legacy allowlists

- **Files:** `admin/tests/architecture/design-system.test.ts`
- **Change:** ลบ raw-value และ size legacy entries ที่ remediation แก้แล้ว; scanner ต้อง
  ครอบทุก handwritten Admin source และ allowlist ว่าง
- **Verify:** `pnpm --dir admin exec vitest run tests/architecture/design-system.test.ts`
  ผ่านด้วย allowlist ว่าง; manual scan
  `rg -n --glob '*.vue' --glob '*.css' --glob '!tokens.css' '#[0-9A-Fa-f]{3,8}|rgb\(|hsl\(' admin/src`
  ไม่คืนผลลัพธ์

## Milestone 6 — Public Site migration หลัง visual approval

### Task 45 — Migrate blog index/article

- **Files:** `site/src/views/BlogIndexView.astro`,
  `site/src/views/ArticleView.astro`,
  `site/src/pages/[locale]/blog/index.astro`,
  `site/src/pages/[locale]/blog/[slug].astro`,
  `site/src/styles/components/content.css`,
  `site/tests/e2e/public-content.spec.ts`
- **Change:** add empty/success/long-title cases; views เป็น fragments, routes ใช้
  SiteLayout + bundled navigation และ exact current paths; คง ETag/cache/SEO
- **Verify:** `pnpm --dir site exec playwright test tests/e2e/public-content.spec.ts --grep "blog" && pnpm --dir site exec vitest run tests/integration/content-routes.test.ts`

### Task 46 — Migrate docs route/view

- **Files:** `site/src/views/DocsView.astro`,
  `site/src/pages/[locale]/docs/[...slug].astro`,
  `site/src/styles/components/content.css`,
  `site/tests/e2e/public-content.spec.ts`
- **Change:** add docs/long-word/stale/304 cases; thin view fragment + SiteLayout,
  bundled nav และ `currentPath=content.path`; คง stale cache semantics
- **Verify:** `pnpm --dir site exec playwright test tests/e2e/public-content.spec.ts --grep "docs|stale|304" && pnpm --dir site exec vitest run tests/integration/content-routes.test.ts`

### Task 47 — Style all remaining public blocks

- **Files:** `site/src/blocks/TextBlock.astro`,
  `site/src/blocks/ImageBlock.astro`,
  `site/src/blocks/CalloutBlock.astro`,
  `site/src/blocks/AnswerBlock.astro`,
  `site/src/blocks/StepsBlock.astro`,
  `site/src/blocks/ComparisonBlock.astro`,
  `site/src/styles/components/blocks.css`,
  `site/src/styles/global.css`,
  `site/tests/e2e/public-content.spec.ts`
- **Change:** add six-type fixture; responsive media dimensions, comparison intentional
  scroll, non-color-only status และ token-only visuals
- **Verify:** `pnpm --dir site exec playwright test tests/e2e/public-content.spec.ts --grep "content blocks" && pnpm --dir site exec vitest run tests/unit/block-rendering.test.ts`

### Task 48 — ทำ AnswerBlock IDs unique

- **Files:** `site/src/blocks/types.ts`,
  `site/src/blocks/BlockRenderer.astro`,
  `site/src/blocks/AnswerBlock.astro`,
  `site/src/views/CmsPageView.astro`,
  `site/src/views/PreviewView.astro`,
  `site/tests/unit/block-rendering.test.ts`,
  `site/tests/e2e/public-content.spec.ts`
- **Change:** test duplicate question ก่อน; pure helper สร้าง stable ID จาก block index,
  call sites ส่ง index และ rendered DOM ไม่มี duplicate IDs
- **Verify:** `pnpm --dir site exec vitest run tests/unit/block-rendering.test.ts && pnpm --dir site exec playwright test tests/e2e/public-content.spec.ts --grep "duplicate answer"`

### Task 49 — Migrate preview exchange success แบบ restricted

- **Files:** `site/src/views/PreviewView.astro`,
  `site/src/pages/[locale]/preview/exchange/[code].astro`,
  `site/src/styles/components/content.css`,
  `site/tests/fixtures/mock-site-api.mjs`,
  `site/tests/e2e/public-errors.spec.ts`
- **Change:** add mock POST exchange/expiry/replay; success ใช้ SiteLayout แบบไม่มี
  navigation/language switcher/external actions, view เป็น fragment; code ไม่อยู่ใน
  anchors/forms/HTML ที่ไม่จำเป็น คง `previewHeaders()` และ one-time semantics
- **Verify:** `pnpm --dir site exec playwright test tests/e2e/public-errors.spec.ts --grep "preview exchange" && pnpm --dir site exec vitest run tests/integration/preview-route.test.ts`

### Task 50 — Characterize exact public error matrix

- **Files:** `site/tests/e2e/public-errors.spec.ts`,
  `site/tests/fixtures/mock-site-api.mjs`
- **Change:** เพิ่ม ordinary 404, existing 503, root outage, preview permanent 404 และ
  exchange error casesที่ assert status/cache/robots/canonical/hreflang/JSON-LD ตาม
  behavior ปัจจุบันก่อนเปลี่ยน presentation; ไม่ claim uncaught
  `PublicContentUnavailableError` เป็น 503
- **Verify:** `pnpm --dir site exec playwright test tests/e2e/public-errors.spec.ts --grep "response contract"`
  ผ่านกับ markup ปัจจุบัน

### Task 51 — สร้าง status context/layout/view

- **Files:** `site/src/i18n/status-context.ts`,
  `site/src/layouts/StatusLayout.astro`,
  `site/src/views/StatusView.astro`,
  `site/src/locales/en/common.json`,
  `site/src/locales/th/common.json`,
  `site/src/styles/components/content.css`,
  `site/tests/unit/status-context.test.ts`,
  `site/tests/e2e/public-errors.spec.ts`
- **Change:** test fallback/presentation ก่อนแล้วสร้าง bundled en/th context (unknown
  → en), minimal styled document without
  registry/canonical/hreflang และ optional robots meta only when existing route contract
  requires; view มี localized home/retry presentation แต่ไม่กำหนด status/header เอง
- **Verify:** `pnpm --dir site exec vitest run tests/unit/status-context.test.ts && pnpm --dir site check && pnpm --dir site exec playwright test tests/e2e/public-errors.spec.ts --grep "status presentation"`

### Task 52 — ใช้ StatusView ใน home/CMS/blog/docs branches

- **Files:** `site/src/pages/[locale]/index.astro`,
  `site/src/pages/[locale]/[...slug].astro`,
  `site/src/pages/[locale]/blog/index.astro`,
  `site/src/pages/[locale]/blog/[slug].astro`,
  `site/src/pages/[locale]/docs/[...slug].astro`
- **Change:** replace bare error markup only; คง classifiers, unknown-error throw,
  status/cache/SEO contract เดิมทุก branch
- **Verify:** `pnpm --dir site exec playwright test tests/e2e/public-errors.spec.ts --grep "public 404|public 503" && pnpm --dir site exec vitest run tests/integration/content-routes.test.ts tests/integration/locale-route.test.ts`

### Task 53 — ใช้ standalone StatusView ใน root/preview errors

- **Files:** `site/src/pages/index.astro`,
  `site/src/pages/[locale]/preview/[revisionId].astro`,
  `site/src/pages/[locale]/preview/exchange/[code].astro`
- **Change:** root outage ใช้ safe fallback; permanent revision route ต้องยัง
  dependency-free 404 ไม่เรียก API; exchange error ห้าม retry one-time URL และคง
  preview headers
- **Verify:** `pnpm --dir site exec playwright test tests/e2e/public-errors.spec.ts --grep "root outage|preview permanent|preview error" && pnpm --dir site exec vitest run tests/integration/root-route.test.ts tests/integration/preview-route.test.ts`

### Task 54 — ปิด Site legacy allowlist

- **Files:** `site/src/styles/global.css`,
  `site/tests/architecture/public-ui-system.test.ts`
- **Change:** ลบ migrated legacy rules ให้ global.css เป็น imports เท่านั้น; ลบ
  allowlist, ยืนยันทุก public/block class มี owner selector และไม่มี generic hidden nav
- **Verify:** `pnpm --dir site exec vitest run tests/architecture/public-ui-system.test.ts && pnpm --dir site check && pnpm --dir site build`

## Milestone 7 — Verification, child commits และ parent integration

### Task 55 — รัน Admin full gate

- **Files:** ไม่มี
- **Change:** รันทุก gate บน clean ports; หาก fail ให้หยุดและเปิด `bug-debugging`
  พร้อม fix task แยก ห้าม patch แบบคาดเดาใน verification task
- **Verify:** `pnpm --dir admin lint && pnpm --dir admin typecheck && pnpm --dir admin test:run && pnpm --dir admin build && pnpm --dir admin test:e2e`

### Task 56 — รัน Site full gate แบบ serialized

- **Files:** ไม่มี
- **Change:** รัน Playwright specs รวมครั้งเดียวเพราะ fixture ports 14321/14322 คงที่;
  หาก fail ให้ใช้ `bug-debugging` และ task แยก
- **Verify:** `pnpm --dir site lint && pnpm --dir site check && pnpm --dir site test:run && pnpm --dir site build && pnpm --dir site test:e2e`

### Task 57 — Commit และทำให้ child revisions reachable

- **Files:** Git histories ของ `admin/` และ `site/`
- **Change:** commit bounded-context batches แยกจาก pilot, ตรวจ child branches เริ่มจาก
  parent-pinned SHAs และ push/otherwise make final commits reachable ตาม workflow ที่
  ผู้ใช้อนุมัติ; ไม่ tag/force-push และไม่แตะ `api/`
- **Verify:** `git -C admin status --short && git -C site status --short` ว่าง และ
  `git -C admin rev-parse HEAD`/`git -C site rev-parse HEAD` ตรงกับ recorded final SHAs

### Task 58 — อัปเดต parent pins/release fixture/checksum

- **Files:** parent gitlinks `admin`, `site`,
  `integration/fixtures/releases/valid.yaml`,
  `integration/tests/release/submodule-pins.test.ts`
- **Change:** update Admin/Site commit literals และ gitlinks เป็น final reachable SHAs;
  คำนวณ SHA-256 ใหม่ของ `site/src/locales/en/common.json` ใน fixture; คง API pin,
  OpenAPI checksums, infra pin และ image digests เดิม
- **Verify:** `(Get-FileHash -Algorithm SHA256 site/src/locales/en/common.json).Hash.ToLower()` ตรง fixture และ `pnpm test:release` ผ่าน

### Task 59 — รัน parent integration gate

- **Files:** ไม่มี
- **Change:** ตรวจ structure, integration, gitlink/HEAD และ diff scope ก่อน parent commit
- **Verify:** `pnpm verify:structure && pnpm test:integration && git submodule status --recursive && git diff --check && git diff --submodule=log -- admin site integration/fixtures/releases/valid.yaml integration/tests/release/submodule-pins.test.ts`

## Parallelizable

- Tasks 4–8 และ Tasks 18–19 ทำขนานข้าม `admin/`/`site/` ได้
- Tasks 12–14 กับ Tasks 15–16 ทำขนานได้ แต่มี owner เดียวสำหรับ shared UI barrel
- หลัง Task 27: Admin bounded contexts 28–43 ทำขนานตาม module ได้; owner ของ shared
  primitivesรับ conflict เท่านั้น
- หลัง Task 27: Site authoring 45–49 ทำแยก tracks ได้ แต่ `mock-site-api.mjs`,
  `content.css` และ preview routes ใช้ owner handoff แบบ serialized
- Playwright commands ทั้ง Admin/Site ต้อง serialized ต่อ submodule เพราะ fixed ports;
  Tasks 55/56 ทำขนานกันได้คนละ port set แล้ว Task 57–59 เป็น sequential

## Plan self-review checklist

- ทุก task มี exact paths, concrete change และ command/observable result
- RED→GREEN หรือ characterization→GREEN จบภายในทุก task; ไม่มี standalone RED commit
- Foundation/navigation filter, 403/404 guards, MFA/session/CSRF, CMS workflow,
  locale/current path, preview code, cache/SEO response matrix มี direct regression gates
- Site ก่อน visual approval แตะเฉพาะ foundation, home และ CMS route เดียว
- ไม่มี cross-submodule package, generic data-grid/form-builder หรือ UI dependency ใหม่
- parent pin bump รวม hardcoded SHA fixture/test และ localization checksum โดยไม่แตะ API
