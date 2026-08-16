# Comprehensive local seed implementation plan

This plan follows the approved design in `2026-08-16-comprehensive-local-seed-design.md`. Each task is independently verifiable and keeps one responsibility per file.

## 1. Seed contracts and deterministic identity

Files:

- `api/internal/seed/profile.go` — profile names, environment validation, and configuration parsing.
- `api/internal/seed/ids.go` — deterministic UUID/key derivation for all seed records.
- `api/internal/seed/fixtures.go` — typed, non-secret fixture definitions and permission profiles.
- `api/internal/seed/profile_test.go` and `api/internal/seed/ids_test.go` — RED tests for profile safety and stable IDs.

Validation: tests fail before implementation, then pass with exact profile and ID invariants.

## 2. Foundation and authorization matrix

Files:

- `api/internal/seed/runner.go` — transaction/profile orchestration only.
- `api/internal/seed/store.go` — dialect-neutral persistence helpers and idempotent upserts.
- `api/internal/seed/foundation.go` — account, owner identity, membership and role foundation.
- `api/internal/seed/authorization.go` — explicit permission grants and role assignments.
- `api/internal/seed/identity.go` — demo identities, credentials and profiles (never sessions/tokens).
- `api/internal/seed/runner_test.go` and `api/internal/seed/permission_matrix_test.go` — RED tests for cumulative profiles, idempotence and boundaries.
- `api/cmd/seed/main.go` — CLI entry point and safe environment gate.

Validation: unit tests observe the expected RED→GREEN transition; integration tests run against a disposable database when the runtime is available.

## 3. CMS demo modules

Files:

- `api/internal/seed/localization.go` — locale metadata and translations.
- `api/internal/seed/cms.go` — content, taxonomies, revisions, workflows, schedules, menus, redirects and discoverability metadata.
- `api/internal/seed/media.go` — one valid local media fixture and upload metadata.
- `api/internal/seed/operations.go` — notifications, operation jobs, module settings and sanitized audit examples.

Validation: profile-specific counts, foreign-key integrity and public read model checks.

## 4. Local Compose integration

Files:

- `api/internal/app/bootstrap.go` and `api/internal/app/bootstrap_store.go` — accept an optional deterministic account ID while preserving random IDs for normal bootstrap.
- `api/.env.example` — document seed profile/account variables with empty secrets.
- `api/Dockerfile` — build the seed executable alongside API/healthcheck/bootstrap binaries.
- `compose.dev.yml` — migration → seed → API dependencies for PostgreSQL and MariaDB, with a fixed local account ID and no production seed path.
- `scripts/dev/setup-local.ps1` — pass local bootstrap/seed values without printing passwords and avoid duplicate manual bootstrap.
- `docs/operations/local-setup.md` — local seed and reset instructions.

Validation: Compose config renders, migration/seed/API health checks pass, and `/public/*` resolves the seeded account.

## 5. Verification and handoff

- Run formatter, unit tests, integration tests available in the repository, and frontend build/type checks if affected.
- Run local PostgreSQL smoke first; run MariaDB smoke if Docker and the image are available.
- Inspect status/diff and verify no ignored secret files are staged.
- Commit implementation in the API repository and update the parent submodule pointer only after validation.
- Do not push or claim remote deployment without an explicit remote target and credentials.
