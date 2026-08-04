# Personal Go Starter Implementation Plan

Design ref: approved Personal Go scope in the conversation on 2026-08-03

## Scope

This plan completes the Personal CMS/Back Office/Public Site starter only. SaaS concerns
(billing, subscriptions, tenant onboarding, invitations, usage limits, SSO, impersonation
and SaaS analytics) remain out of scope and will be implemented in a separate Go SaaS
project. The account and permission boundaries stay reusable for a future fork.

## Task 1 — Lock the current API/Admin contract ✅

- **Files:** `api/internal/app/routes_authorization.go`,
  `api/internal/app/api_routes_authorization_test.go`,
  `admin/src/modules/operations/api/modules.client.ts`,
  `admin/tests/unit/audit.client.test.ts`
- **Change:** Keep `/operations/modules` and `/authorization/effective-permissions`
  consistent across runtime, OpenAPI, generated clients and tests; preserve the existing
  auth/CSRF/permission middleware order.
- **Verify:** targeted API route test, targeted Admin client test, then Admin full suite.

## Task 2 — Wire CMS Admin routes to real clients ✅

- **Files:** `admin/src/app/router/cms-routes.ts`,
  `admin/src/modules/publishing/*`, `admin/src/modules/media/*`,
  `admin/src/modules/navigation/*`, `admin/src/modules/discoverability/*`,
  related component tests.
- **Change:** Replace placeholder `unavailable()` providers and empty arrays with
  query/mutation adapters for content, workflow, revisions, schedules, media, menus,
  redirects and SEO/audits. Each view must expose loading, empty, error, success and
  optimistic-conflict states, while router guards remain permission-driven.
- **Verify:** unit/component tests for each adapter and a browser smoke flow that creates
  a page, edits it, changes workflow, and reads it from the public site.

## Task 3 — Add repeatable local setup and demo seed 🟡 (foundation complete)

- **Files:** `scripts/dev/*`, `api/cmd/bootstrap/*`, `api/internal/app/bootstrap*`,
  root `package.json`, `README.md`, local setup tests.
- **Change:** Provide one documented command that starts the selected DB profile, runs
  migrations, creates a local admin/account/permission seed, initializes locales and
  optionally creates demo CMS content, navigation, media metadata and SEO defaults.
  Production runs must reject development credentials and demo content.
- **Implemented:** migrations/bootstrap/local permission seed and locale initialization
  are available and idempotent; demo legal/CMS fixtures are still optional follow-up.
- **Verify:** run setup against a fresh disposable PostgreSQL and MariaDB database,
  login with the generated local account, and rerun setup to prove idempotency.

## Task 4 — Complete Personal operations baseline ✅ (current slice)

- **Files:** `api/internal/platform/health/*`, `api/internal/platform/storage/*`,
  `api/internal/platform/jobs/*`, `api/internal/modules/operations/*`,
  `admin/src/modules/operations/*`, `docs/operations/*`.
- **Change:** Add DB/cache/storage/job/migration readiness contributors, production
  readiness checks, backup metadata/CLI and retention runbook, failed-job listing/retry,
  and a permission-protected Admin operations view. Do not expose backup bytes through
  public HTTP routes.
- **Implemented:** readiness, durable jobs/list/retry, backup manifest/checksum command,
  operations Admin view and runbook.
- **Verify:** unit tests for each check, API authorization tests, backup dry-run/restore
  drill in a disposable environment, and Admin operations E2E smoke.

## Task 5 — Harden identity, media and localization 🟡 (core slice complete)

- **Files:** `api/internal/modules/identity/*`, `api/internal/modules/media/*`,
  `api/internal/modules/localization/*`, Admin clients/views/tests, locale bundles.
- **Change:** Add email-verification/mail ports, upload MIME/size/visibility policies,
  safe object-key checks, and the requested locale lifecycle: add, enable/disable,
  default/fallback, user-selectable subset/all, catalog edit, import/export and audit.
  Keep registration disabled by default for Personal CMS.
- **Implemented:** provider-neutral local mail boundary, profile/password with session
  invalidation, private media checks, full locale lifecycle and catalog import/export UI.
- **Remaining:** SMTP/S3 adapters and optional registration/email-delivery workflow.
- **Verify:** unauthorized/forbidden/validation/duplicate/empty-path tests, media path
  traversal tests, locale concurrency tests, and Admin interaction tests.

## Task 6 — Prove the public CMS flow ✅ (build/contract slice)

- **Files:** `site/src/*`, `api/internal/modules/publishing/*`,
  `site/tests/e2e/*`, `integration/tests/cms-public-flow.test.ts`.
- **Change:** Seed/configure a public account, render localized page/post/docs routes,
  secure preview/noindex behavior, and validate SEO/GEO/AEO, sitemap, RSS, robots and
  missing-content 404 behavior.
- **Implemented:** public Astro routes/build, localized content contract and SEO/GEO/AEO
  surface foundations; project-specific content seed remains operator configuration.
- **Verify:** Astro build, public E2E smoke, API contract tests and authenticated
  preview exchange test.

## Task 7 — Stabilize CI, database profiles and release documentation ✅

- **Files:** `api/scripts/test-db.*`, `.github/workflows/*`, `integration/tests/*`,
  `README.md`, `docs/operations/*`, release manifests/changelog.
- **Change:** Remove shared-database/parallel migration interference, add XAMPP/MariaDB
  smoke coverage, run clean-clone verification, document rollback/backup/configuration,
  and pin the child repository commits in the parent release manifest.
- **Implemented:** disposable PostgreSQL/MariaDB migration smoke, release pin/contract
  checks, structure checks and backup/rollback documentation. Real local XAMPP smoke
  still depends on the operator's running XAMPP instance.
- **Verify:** full API/Admin/Site suites, PostgreSQL and MariaDB profiles, XAMPP smoke,
  release verification, and a clean clone from GitHub.

## Ordering

Tasks 1–3 are sequential prerequisites. Task 4 can start after Task 1. Task 5 can run
in parallel with Task 4 after the current contracts are green. Task 6 depends on Tasks
2–3. Task 7 is the release gate after all functional tasks are green.

## Explicitly Out of Scope

Billing, Stripe, plans, subscriptions, trials, entitlements, metering, tenant onboarding,
invitations, SSO/OAuth, impersonation, API-key products and SaaS analytics.
