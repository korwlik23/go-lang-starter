# Local setup and verification

This is the shortest repeatable path for the personal `go-lang-starter` starter.
It supports one database profile at a time:

- `mariadb`: Docker MariaDB, compatible with the XAMPP/MariaDB code path
- `postgres`: Docker PostgreSQL, the primary profile

The script does not modify `D:\infra-stack`; that repository remains the deployment
orchestration layer. The starter can be copied into an InfraStack project after a
release is verified.

## Start, migrate and seed

From `D:\go-lang-starter`:

```powershell
.\scripts\dev\setup-local.ps1 -Profile mariadb
```

The command starts the selected profile, waits for migration, runs the idempotent
foundation plus the default `full-local` seed, then checks API liveness/readiness,
Admin login and the Public Site `/th/` route. The Compose dependency order is
`database → migrate → seed → api`.

Choose a smaller cumulative seed when needed:

```powershell
.\scripts\dev\setup-local.ps1 -Profile postgres -SeedProfile permission-matrix
```

The CLI can also be run directly after migration (the foundation step is still
performed by the command):

```powershell
docker compose --profile postgres -f compose.dev.yml run --rm seed-postgres
```

To use PostgreSQL instead:

```powershell
.\scripts\dev\setup-local.ps1 -Profile postgres
```

Only one profile may run at a time because both API services use local port `8080`.
The script detects the other profile and stops before changing anything.

## Bootstrap credentials

For a repeatable local credential, create the ignored file once:

```powershell
Copy-Item .env.bootstrap.example .env.bootstrap
notepad .env.bootstrap
```

Set `BOOTSTRAP_EMAIL`, `BOOTSTRAP_PASSWORD` and `BOOTSTRAP_ACCOUNT_SLUG`, then run
setup again. `.env.bootstrap` is ignored by Git and must never be committed. The API
password policy requires at least 12 characters, so
`password123` is rejected; use a longer development-only value.

If `.env.bootstrap` is absent, the script asks for the password using a secure prompt.
For a one-off non-interactive run, pass it explicitly (PowerShell history may retain
that command, so prefer the ignored file):

```powershell
.\scripts\dev\setup-local.ps1 `
  -Profile mariadb `
  -BootstrapEmail owner@example.com `
  -BootstrapPassword 'replace-with-a-local-12-character-value'
```

Seed is safe to rerun when the deterministic account and permission projection are
present. A partial or conflicting foundation fails closed and must be reviewed; the
script never resets or deletes database data. The demo password is used only for local
fixtures and is never committed.

The default `full-local` profile creates eight test identities:

| Email | Purpose |
|---|---|
| `owner@example.com` | full owner baseline |
| `author@example.com` | own publishing/media workflow |
| `reviewer@example.com` | review boundary |
| `publisher@example.com` | publish/schedule boundary |
| `translator@example.com` | localization system permissions |
| `ops@example.com` | operations/settings/audit permissions |
| `viewer@example.com` | read-only boundary |
| `disabled@example.com` | login rejection boundary |

All active fixtures use the password supplied through `BOOTSTRAP_PASSWORD`; change it
locally before sharing a database dump. The seed intentionally creates no sessions,
recovery tokens, MFA secrets, preview tokens or external service secrets.

## Verify an already-running stack

```powershell
.\scripts\dev\check-local.ps1 -Profile mariadb
```

The check requires the selected database, API, Admin and Site services to be running
and verifies:

- API `GET /livez`
- API `GET /readyz`
- Admin `GET /login`
- Public Site `GET /th/`

## URLs

| Surface | URL |
|---|---|
| Vue Admin | `http://127.0.0.1:5173/login` |
| API liveness | `http://127.0.0.1:8080/livez` |
| API readiness | `http://127.0.0.1:8080/readyz` |
| Astro Public Site (Thai) | `http://127.0.0.1:4321/th/` |
| Astro Public Site (English) | `http://127.0.0.1:4321/en/` |

Admin routes intentionally have no locale prefix. Locale prefixes belong to the
Public Site only.

## XAMPP MariaDB

The Docker `mariadb` profile does not publish port `3306`, so XAMPP MariaDB can stay
running on Windows while the local starter uses the isolated Docker database. To run
the API directly against XAMPP, use `api/.env.mariadb-xampp.example` as the starting
point, create a dedicated development database/user, and run the guarded migration
runner documented in `docs/operations/database-compatibility.md`. Never point a
migration or reset command at a production database.

## Stop without deleting data

```powershell
docker compose --project-name go-lang-starter --profile mariadb -f compose.dev.yml down
```

Do not add `--volumes` unless the local database data is intentionally disposable and
the target has been verified.

## Local backup and restore drill

Create an ignored plain-SQL backup plus non-secret metadata:

```powershell
.\scripts\dev\backup-local.ps1 -Profile mariadb
```

The default output is `tmp/backups/`, which is ignored by Git. The backup contains
application data and must be protected like a secret. It is never served by the API,
Admin or Public Site. Use `-WhatIf` to verify the target path without running a dump.

For a disposable restore drill, create a separate database/volume and pipe the SQL
file to the matching client. Do not run this against the active development database
without an explicit reset plan:

```powershell
Get-Content .\tmp\backups\<backup-file>.sql |
  docker compose --profile mariadb -f compose.dev.yml exec -T mariadb `
    mariadb --user=go_lang_starter --password=development-only-database-password go_lang_starter_dev
```

Production backups belong to the database provider/InfraStack backup policy. The local
script is a development convenience and is not a production retention system.
