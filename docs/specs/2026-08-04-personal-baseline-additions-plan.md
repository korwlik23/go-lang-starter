# Personal Go Starter Baseline Additions — Implementation Plan

Design ref: `docs/specs/2026-08-04-personal-baseline-additions-design.md`

## Task 1 — Contract and migration scaffolding ✅

- **Files:** `api/openapi/modules/{settings,notifications,identity,operations,localization}/*.yaml`, `api/openapi/root.yaml`, `api/internal/app/modules.go`, `api/internal/app/migration_modules.go`, new three-dialect migration files.
- **Change:** Define permission keys, routes and bounded-context schemas first; register the modules and migrations without exposing handlers until tests assert the composition.
- **Verify:** Existing module and migration parity tests show the expected RED for missing handlers only; `go test ./internal/app -run 'Modules|Migration'`.

## Task 2 — Settings module ✅

- **Files:** `api/internal/modules/settings/**`, `api/internal/app/dependencies_settings.go`, `api/internal/app/routes_settings.go`.
- **Change:** Implement allow-listed non-secret settings read/update with transactional audit and system permission guards.
- **Verify:** Unit, repository, HTTP 401/403/422/409 tests plus all-dialect migration tests.

## Task 3 — Notifications and mail boundary ✅ (provider boundary)

- **Files:** `api/internal/modules/notifications/**`, `api/internal/platform/mail/**`, `api/internal/app/dependencies_notifications.go`, `api/internal/app/routes_notifications.go`.
- **Change:** Add in-app notification list/read/read-all and safe local/SMTP sender ports. Wire recovery/verification delivery without returning raw tokens.
- **Verify:** Notification service/HTTP tests, mail adapter tests, rate-limit and token-redaction tests.

## Task 4 — Identity lifecycle and profile 🟡 (partial)

- **Files:** `api/internal/modules/identity/application/auth/register.go`, `verify_email.go`, `application/profile/**`, identity repositories/handlers/migrations, OpenAPI identity contracts, Admin identity adapters/views.
- **Change:** Add registration, email verification, self-service profile/password operations and permission-controlled admin user create/edit/disable/reset actions.
- **Implemented now:** self-service profile/password operations, permission-controlled
  admin list/detail/disable/enable, and session invalidation on password change.
- **Remaining:** registration/email verification lifecycle and admin create/edit/reset
  workflow; these require a delivery adapter/config contract before being enabled by
  default.
- **Verify:** RED/GREEN HTTP tests for happy, duplicate, expired, unauthorized and forbidden flows; integration login → verify → profile smoke.

## Task 5 — Durable operations and backup ✅ (manifest/verification)

- **Files:** `api/internal/modules/operations/domain/job.go`, repository/application/HTTP files, `api/internal/platform/backup/**`, `api/cmd/backup/main.go`, Admin operations adapters/views.
- **Change:** Persist job state/attempts/errors, expose bounded list/retry endpoints, add readiness summary and offline backup manifest/dry-run/restore verification.
- **Implemented now:** durable jobs, readiness summary, and offline backup manifest
  creation/checksum verification. Native database dump/restore remains operator-run.
- **Verify:** Idempotency/retry/failed-state unit tests, HTTP permission tests, command dry-run/restore fixture, no-secret output check.

## Task 6 — Localization transfer and demo content 🟡 (transfer complete)

- **Files:** `api/internal/modules/localization/application/catalog/{import,export}.go`, transport/OpenAPI contracts, Admin catalog-transfer adapter/view, bootstrap/demo seed files, Astro legal content fixtures.
- **Change:** Add schema-validated import/export with `source=import`, version conflict handling, audit, and repeatable localized legal/demo content.
- **Implemented now:** schema-validated API import/export and Admin JSON transfer UI.
- **Remaining:** repeatable localized legal/demo seed fixtures.
- **Verify:** Import/export round-trip, malformed input rejection, conflict tests, public `/th/` and `/en/` legal-page smoke.

## Task 7 — Generated clients and verification ✅ (current slice)

- **Files:** generated OpenAPI artifacts and contract metadata only through repository scripts, Admin/Site tests, docs/runbooks.
- **Change:** Regenerate immutable clients, update adapters/navigation, document local mail/backup/job workflows and keep SaaS features explicitly out of scope.
- **Verify:** `pnpm openapi:check`, API tests, Admin lint/typecheck/build/tests, Site check/lint/build/tests, integration/release contract tests, `pnpm verify:structure`.

Tasks 2–3 are independent after Task 1. Task 4 depends on Task 3. Task 5 can run in
parallel with Task 4. Task 6 depends on Task 1 and can run in parallel with Tasks 4–5.
Task 7 is strictly last.
