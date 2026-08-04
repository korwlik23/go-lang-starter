# Admin UI Component System Implementation Plan

Design ref: `docs/specs/2026-08-04-admin-ui-components-design.md`

## Task 1 — RED component contracts

- **Files:** `admin/tests/components/ui/UIComponents.test.ts`,
  `admin/tests/routes/core-routes.test.ts`
- **Change:** Assert primitive variants/states, field associations, showcase text and
  the protected `/ui-components` route.
- **Verify:** Run the focused Vitest files and observe the expected RED failures.

## Task 2 — Shared primitives

- **Files:** `admin/src/shared/components/ui/UiButton.vue`, `UiCheckbox.vue`,
  `UiInput.vue`, `UiRadio.vue`, `UiSelect.vue`, `UiTextarea.vue`,
  `UiCard.vue`, `UiBadge.vue`, `UiField.vue`, `UiEmptyState.vue`,
  `index.ts`
- **Change:** Implement typed, accessible, presentation-only primitives with existing
  Tailwind tokens and no new dependency.
- **Verify:** Focused component tests pass.

## Task 3 — Showcase screen

- **Files:** `admin/src/modules/operations/views/UIComponentsView.vue`
- **Change:** Render each primitive with normal/disabled/loading/error/empty examples,
  labels and responsive sections.
- **Verify:** Showcase test passes and the route renders in the running Admin.

## Task 4 — Route and navigation

- **Files:** `admin/src/app/router/core-routes.ts`, `admin/src/app/navigation.ts`
- **Change:** Add the permission-gated `/ui-components` route and navigation item.
- **Verify:** Route tests and access-guard tests pass.

## Task 5 — Adopt primitives across Admin modules

- **Files:** all affected module views/components under
  `admin/src/modules/**`, plus `admin/src/shared/components/shell/**` and feedback
  components.
- **Change:** Replace duplicated action/input/select/textarea markup with shared
  primitives while preserving API, validation, native file-picker behavior and
  permission behavior.
- **Verify:** `ui-primitives.test.ts` proves only the intentional native file input
  remains in module code.

## Task 6 — Full verification

- **Files:** no new implementation files
- **Change:** Run the complete Admin test/lint/typecheck/build suite and inspect the
  Showcase in the local browser at desktop and narrow widths.
- **Verify:** Record observed command output and any unverified browser limitation.
