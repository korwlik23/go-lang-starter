# Backup and restore verification

The API keeps backup tooling provider-neutral. Create a dump with the native
database tool (`pg_dump`, `mysqldump`, or `mariadb-dump`), then generate a
sidecar manifest:

```powershell
go run ./cmd/backup manifest -artifact .\backup\starter.sql -output .\backup\starter.manifest.json -dialect postgres
go run ./cmd/backup verify -manifest .\backup\starter.manifest.json
```

The manifest records the dialect, artifact path, creation time, and SHA-256.
Restore verification must run against an isolated database, apply migrations,
restore the dump, and execute the API contract/migration tests before promotion.
Never place credentials or raw session tokens in a dump directory with broad
permissions; the local file-mail provider and backup artifacts use restrictive
file modes by default.
