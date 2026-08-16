# Comprehensive local seed design

## Context

The Go starter currently has an idempotent foundation bootstrap, but it creates only one account member and does not provide a repeatable local CMS dataset for testing authorization, publishing, localization, discoverability, operations, or the admin UI. The predecessor Laravel and Next starters also provide role/permission and translation examples that are useful for local development, but SaaS tenants, billing, and production-like credentials are out of scope for this personal starter.

## Goal

Provide a safe, repeatable local seed command that can create a useful CMS/Back Office dataset without hard-coding authorization decisions to role names. A clean local PostgreSQL or MariaDB database must be able to run the migration and seed flow, rerun it without duplicates, and expose a deterministic account ID so the public site can render the seeded account.

## Profiles

| Profile | Contents | Intended use |
| --- | --- | --- |
| `foundation` | Deterministic account, owner user/credentials/profile, membership, account/system roles, full permission catalog, audit event | Minimal local baseline |
| `permission-matrix` | Foundation plus active users for author, reviewer, publisher, translator, operations, viewer and a disabled user; explicit permission grants and memberships | Authorization and UI testing |
| `demo-cms` | Permission matrix plus locales/translations, content, taxonomy, revisions/workflow, schedules, menus, redirects, SEO/GEO/AEO, media, notifications, jobs and sanitized audit examples | CMS feature walkthrough |
| `full-local` | All of the above; default local demo profile | One-command local development |

Profiles are cumulative and idempotent. A rerun reconciles records by deterministic IDs/unique keys and never creates sessions, auth attempts, password-reset tokens, MFA secrets/codes, preview tokens, SMTP/API secrets, SaaS billing/tenant records, or production logs.

## Authorization model

Roles are display/grouping metadata only. Every seeded user receives explicit permission keys from the existing catalog. System-scoped permissions are assigned through system roles; account-scoped permissions are assigned through account roles. The seed never grants wildcard permissions and does not rely on role-name checks in runtime authorization.

The matrix is:

- owner: all existing system and account permissions;
- author: own publishing/revision/media/navigation/discoverability plus own identity, account and notifications;
- reviewer: own read access plus `publishing.pages.review.any`;
- publisher: own read access plus review/publish any and menu publish;
- translator: localization system permissions plus account viewer permissions;
- ops: operations/settings/audit system permissions plus account viewer permissions;
- viewer: read-only account publishing/media/navigation/discoverability plus own identity/notifications;
- disabled: no permissions and a disabled account membership; login must be rejected.

## Demo data rules

The demo content includes published, draft, review, scheduled and archived examples; incomplete `th`/`en`/`ja` translation coverage; taxonomy and revision/workflow records; a future publication schedule; locale-specific menus; a redirect; SEO defaults; GEO/AEO values; one valid local media asset; notification read/unread examples; and queued, failed and completed operation jobs. `ja` is enabled for data coverage but is not included in the selectable locale list by default, proving that enabled languages and user-selectable languages are separate concerns.

Because the current bundled locale registry only guarantees `th` and `en` during migration, the seed must add the `ja` locale metadata after migration rather than changing production migration defaults.

## Local deployment contract

The seed executable is only allowed when `APP_ENV=development` (or an explicit local-test environment) and requires a profile. The local Compose flow runs migration → seed → API. A deterministic `PUBLIC_ACCOUNT_ID` is supplied to the API so `/public/*` renders the same seeded account on every clean local reset. Passwords come from process environment/ignored local env files; the repository contains only placeholders and never a usable secret.

Remote deployment is intentionally not part of this change: no VPS host, SSH target, registry, or production secret has been supplied. Once those are provided, the same artifacts can be built and deployed through the repository's existing production runbook, without running the demo seed in production.

## Acceptance criteria

1. Unit tests cover profile parsing, deterministic IDs, permission matrix, and idempotent seed orchestration.
2. A clean PostgreSQL database can migrate and run each profile; a clean MariaDB database can migrate and run at least `foundation` and `full-local`.
3. Rerunning the same profile does not increase deterministic record counts.
4. Active demo users can authenticate and authorization boundaries return the expected allow/deny result; disabled login is rejected.
5. Public content/menu endpoints resolve the deterministic account and locale data.
6. A repository scan confirms no seeded sessions, tokens, MFA values, or secrets.
