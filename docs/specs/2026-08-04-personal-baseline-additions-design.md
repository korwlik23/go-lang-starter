# Personal Go Starter Baseline Additions — Design

## Problem and goal

The Go starter already provides the CMS/public foundation (publishing, revisions,
workflow, schedules, media, navigation, localization, discoverability and the Astro
site), but it is missing the reusable personal Back Office operations that are present
in the Laravel and Next starters. This change adds those personal foundations without
introducing SaaS tenancy, billing or subscription coupling.

Success means a clean local project can use the starter with:

- permission-controlled account/user administration and self-service profile/password
  actions;
- mail delivery through a safe local adapter plus an SMTP adapter boundary, including
  registration/recovery verification messages;
- in-app notifications with list/read/read-all behavior;
- non-secret system settings, persistent jobs with failed/retry visibility, readiness
  reporting, and an offline backup/restore verification command;
- localization catalog import/export with audit provenance;
- repeatable demo content (including legal pages) and an Admin UI that exercises the
  new operations without bypassing the existing OpenAPI/client boundaries.

SaaS-only features (tenants, plans, subscriptions, Stripe/manual payment, coupons,
usage limits, impersonation, SSO, API-key products and SaaS analytics) remain out of
scope for `go-lang-starter` and belong to `go-lang-starter-saas`.

## Approaches considered

1. **Copy Laravel/Next features directly into the existing app composition.** Fastest
   short-term path, but it creates a god composition file, couples personal and SaaS
   data, and makes permission behavior inconsistent.
2. **Recommended — bounded-context modules plus provider ports.** Add `settings` and
   `notifications` modules, extend `identity`, `operations` and `localization` in
   separate application/transport files, and expose mail/backup through platform
   ports. This preserves the current module registry, three-dialect migrations,
   OpenAPI ownership and permission-only authorization.
3. **Add only UI shells first.** Gives visible pages quickly but leaves the existing
   runtime unable to support them and would create false readiness.

## Proposed architecture

### Runtime and data flow

`HTTP middleware → permission guard → thin handler → application action → repository`
with audit events emitted in the same transaction for mutations. External mail is
behind `platform/mail`; the default local sender captures metadata without logging
raw tokens. SMTP is an opt-in adapter. Backup is a CLI-only capability and never
returns database/media bytes over HTTP.

### API modules and files

```text
api/internal/modules/settings/
  domain/setting.go
  ports/repository.go
  adapters/gorm/repository.go
  application/read.go
  application/update.go
  transport/http/handler.go
  transport/http/routes.go
  manifest.go  permissions.go  migrations.go
  migrations/{postgres,mariadb,mysql}/000001_create_system_settings.sql

api/internal/modules/notifications/
  domain/notification.go
  ports/repository.go
  adapters/gorm/repository.go
  application/list.go  application/mark_read.go  application/mark_all_read.go
  transport/http/handler.go  transport/http/routes.go
  manifest.go  permissions.go  migrations.go
  migrations/{postgres,mariadb,mysql}/000001_create_notifications.sql

api/internal/modules/identity/
  application/auth/register.go
  application/auth/verify_email.go
  application/profile/read.go  application/profile/update.go
  transport/http/registration_handler.go
  transport/http/verification_handler.go
  transport/http/profile_handler.go
  adapters/gorm/{registration_repository,profile_repository}.go
  ports/{registration_repository,profile_repository}.go
  migrations/{postgres,mariadb,mysql}/000007_identity_profile_verification.sql

api/internal/modules/operations/
  domain/job.go
  ports/job_repository.go
  adapters/gorm/job_repository.go
  application/jobs/{list,retry,run_due}.go
  transport/http/jobs_handler.go
  migrations/{postgres,mariadb,mysql}/000002_create_jobs.sql

api/internal/platform/mail/{mail.go,log_sender.go,smtp_sender.go}
api/internal/platform/backup/{service.go,restore_check.go}
api/cmd/backup/main.go
```

Localization adds `application/catalog/import.go`, `application/catalog/export.go`,
and matching transport/OpenAPI operations. Existing CMS modules are not rewritten.

### Admin and site files

```text
admin/src/modules/settings/{api/settings.client.ts,views/SettingsView.vue}
admin/src/modules/notifications/{api/notifications.client.ts,views/NotificationsView.vue}
admin/src/modules/operations/{api/jobs.client.ts,views/JobsView.vue}
admin/src/modules/identity/{views/ProfileView.vue,components/RegistrationForm.vue}
admin/src/modules/localization/{api/catalog-transfer.client.ts,views/CatalogTransferView.vue}
```

All views use existing shared UI primitives and module API adapters. No view imports a
generated client directly. Astro legal pages are seeded as CMS content so they follow
the same public localized rendering path.

## Authorization and security

- Every new mutation has an explicit permission key and is default-deny.
- Own-scoped notification/profile actions resolve the authenticated user and account;
  system settings, job operations and user administration use system permissions.
- Registration, verification, recovery and retry endpoints receive strict rate limits.
- Tokens remain hashed/encrypted at rest, are single-use and never appear in API
  responses or logs. Local mail captures metadata only.
- Upload/storage behavior remains private-by-default and existing magic-byte/size
  validation is preserved.
- Settings API accepts only an allow-listed non-secret key set; secrets remain env/config
  concerns.

## Testing and acceptance

Each action follows RED → GREEN → REFACTOR with unit tests for validation and service
rules, HTTP tests for 401/403/404/422/409 paths, migration tests for all PostgreSQL,
MariaDB and MySQL bundles, and Admin adapter/component tests. Acceptance requires:

1. OpenAPI lint/bundle/generate completes with no generated drift.
2. API unit/contract/migration tests pass on the pinned Go toolchain.
3. Admin lint/typecheck/build/tests pass.
4. A local seeded flow can log in, update a setting, read/mark a notification, import
   and export a catalog, retry a failed job, and render a seeded legal page publicly.
5. Backup dry-run and restore verification pass without exposing backup bytes through
   HTTP.

## Risks and boundaries

- SMTP and S3/MinIO remain provider adapters; local development does not require those
  services.
- A durable job table is intentionally small and generic; product-specific jobs must
  register an idempotent handler rather than add business logic to the operations
  controller.
- This design does not add billing, tenant provisioning or subscription behavior.
