# Milestone 3 runbook

This runbook is the repeatable handoff for the CMS/public vertical slice. It
keeps API, Admin, Site and the parent release manifest pinned to exact commits.

## Local verification order

```powershell
Set-Location D:\go-lang-starter
pnpm test:integration
pnpm verify:structure
docker compose --project-name m3verify --profile postgres -f compose.dev.yml config --quiet
docker compose --project-name m3verify --profile mariadb -f compose.dev.yml config --quiet
pnpm test:release
pnpm release:verify -- integration/fixtures/releases/valid.yaml
```

Run child checks after changing a contract or generated client:

```powershell
Set-Location D:\go-lang-starter\api
docker run --rm -v "${PWD}:/src" -w /src golang:1.26.5-bookworm go test ./tests/contract ./tests/migrations -count=1

Set-Location D:\go-lang-starter\admin
# Windows local runs can use one worker to avoid process/memory pressure.
pnpm test:run --maxWorkers=1
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e

Set-Location D:\go-lang-starter\site
pnpm test:run --maxWorkers=1
pnpm check
pnpm lint
pnpm build
pnpm test:e2e
```

## Database profiles

PostgreSQL is the primary local profile. MariaDB is the MySQL-family parity
profile used by the XAMPP configuration. Start only one profile at a time when
using the default API port:

```powershell
docker compose --profile postgres -f compose.dev.yml up --build -d
docker compose --profile mariadb -f compose.dev.yml up --build -d
```

Native XAMPP testing requires a dedicated `go_lang_starter_test_*` database and
the guarded runner documented in
`docs/operations/database-compatibility.md`. Oracle MySQL compatibility is
verified separately with the disposable profile recorded in
`integration/evidence/mysql-oracle.json`.

## Preview and cache checks

- Preview URLs are issued by the Admin API, exchanged once by the Site server,
  and are never accepted as a direct revision ID.
- Preview responses use `Cache-Control: no-store` and `X-Robots-Tag: noindex`.
- Public cache keys include site, locale, path and content version. A publish
  mutation must invalidate the matching key; a failed revalidation may serve
  bounded stale content, otherwise it returns a non-cacheable `503`.

## Release pin procedure

1. Commit API changes first.
2. Refresh Admin/Site contract metadata and locks against that immutable API
   commit; regenerate clients when the OpenAPI bytes change.
3. Commit Admin and Site independently.
4. Stage the three parent gitlinks and update
   `integration/fixtures/releases/valid.yaml` with exact commits and SHA-256
   artifacts.
5. Run `pnpm test:release`, `pnpm release:verify -- ...` and
   `pnpm verify:structure`.
6. Review `git status` in all four repositories. Do not create tags or push as
   part of this local verification step.

The release fixture keeps image digests syntactically immutable even when the
registry has not published those images yet; replace them only with observed
registry digests before a deployable release is created.
