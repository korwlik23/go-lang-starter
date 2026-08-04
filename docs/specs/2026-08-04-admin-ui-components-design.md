# Admin UI Component System Design

## Goal

Make the approved Vue Admin design visible and reusable: provide a protected UI
Components Showcase page and a small shared primitive layer that feature views can
compose without bypassing existing authentication or permission guards.

## Approach

Use local, open-code Vue components styled by the existing Tailwind setup. This keeps
the starter forkable and avoids adding a runtime UI dependency. A full Storybook app is
not needed for the starter; the in-app showcase is the runnable visual contract.

## Module layout

```text
admin/src/shared/components/ui/
  UiButton.vue       # action semantics, variants, loading/disabled states
  UiCheckbox.vue     # native checkbox model wrapper
  UiInput.vue        # labelled-compatible text input wrapper
  UiRadio.vue        # native radio model wrapper
  UiSelect.vue       # native select wrapper
  UiTextarea.vue     # native textarea wrapper
  UiCard.vue         # surface/container slots
  UiBadge.vue        # status/label presentation
  UiField.vue        # label, hint and error association
  UiEmptyState.vue   # empty collection state
  index.ts           # public primitive exports

admin/src/modules/operations/views/UIComponentsView.vue
  # interactive showcase of every primitive and state
admin/src/app/router/core-routes.ts
  # protected /ui-components route
admin/src/app/navigation.ts
  # permission-gated navigation entry
admin/tests/components/ui/UIComponents.test.ts
  # primitive and showcase behavior
admin/tests/routes/core-routes.test.ts
  # route contract and permission metadata
admin/tests/architecture/ui-primitives.test.ts
  # prevents module pages from reintroducing raw controls
```

## Reuse contract

Primitives are presentation-only and do not call the API. Feature views own data
fetching and business actions, then compose primitives for controls, feedback and
surfaces. The showcase is protected by `operations.foundation.read.system`, matching
the existing permission model; it must not introduce a hardcoded role or bypass guard.

## Acceptance

- `/ui-components` is reachable for an authenticated principal with the required
  permission and returns 403/redirect behavior otherwise.
- Showcase visibly demonstrates normal, disabled, loading, error, empty, form and
  selection-control states at desktop and narrow viewport widths.
- Module pages use the shared primitives for buttons, text inputs, selects,
  textareas, checkboxes and radios; the media file picker remains native by design.
- Primitives have unit/component tests and Admin lint, typecheck, build and test suites
  remain green.
