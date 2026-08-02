# Database compatibility matrix

This document separates schema/runtime evidence from compatibility intent. A
profile is not marked supported until the exact test described here has a
recorded result.

| Profile | Observed status | Evidence |
| --- | --- | --- |
| PostgreSQL 18.4 | PASS — clean migration/build on the pinned Compose image | `integration/evidence/postgresql.json` |
| MariaDB/XAMPP | PASS — native XAMPP MariaDB 10.4.32 dedicated integration suite and Docker MariaDB parity | `integration/evidence/mariadb-xampp.json` |
| Oracle MySQL | NOT TESTED | No evidence file is created until an Oracle MySQL service is available |

The application keeps the MySQL-family dialect boundary (`DB_DRIVER=mysql`,
`DB_FLAVOR=mariadb`) separate from PostgreSQL. Native XAMPP verification must
use a dedicated database named `go_lang_starter_test_*` and the guarded runner:

```powershell
Set-Location D:\go-lang-starter\api
$env:XAMPP_TEST_PASSWORD = '<read from a local secret store>'
.\scripts\test-db.ps1 `
  -Profile mariadb-xampp `
  -XamppDatabase go_lang_starter_test_m3 `
  -XamppUser go_lang_starter_test `
  -XamppPasswordEnv XAMPP_TEST_PASSWORD `
  -AllowTestDatabaseReset `
  -Package ./tests/migrations
```

Do not point the runner at a development or production database. The reset
guard is intentionally explicit because migration tests modify schema and
data. Stateful integration packages (`./internal/app`,
`./internal/modules/operations/adapters/gorm`,
`./internal/modules/audit/adapters/gorm`, and `./internal/platform/database`)
must be run as separate invocations with a reset dedicated database between
packages; `./...` reuses one schema across packages and is not a valid XAMPP
integration boundary.
