# Release Manifest Contract

Release manifest เป็นหลักฐานว่า parent, child commits, images, contracts, database
profiles และ InfraStack revision ชุดใดผ่านการตรวจร่วมกัน ไม่ใช่ไฟล์ environment และ
ต้องไม่มี secrets

Schema อยู่ที่ `releases/manifest.schema.json` ส่วน
`integration/fixtures/releases/valid.yaml` เป็น test fixture เท่านั้น ไม่ใช่ release
ที่ deploy ได้จริง

## Required fields

| Field | Contract |
|---|---|
| `schemaVersion` | schema generation; ปัจจุบันเป็น `1` |
| `suite.version` / `suite.tag` | SemVer และ exact `suite-v<version>` |
| `components.api/admin/site` | path, repository, independent SemVer, exact `v<version>` tag, full commit SHA และ OCI digest ref |
| `contracts.openapi` | Admin/Public/Site-server version, relative path และ SHA-256 |
| `contracts.localizationCatalog` | catalog schema version, relative path และ SHA-256 |
| `infraStack` | repository, full commit SHA และ pinned `deployScript` path/checksum/mode |
| `databaseSupport` | profile, status และ evidence ของ matrix ที่รันจริง |

OCI image ต้องใช้รูป `registry/repository@sha256:<64-hex>` ห้าม mutable tag เช่น
`latest` Database profile รับเฉพาะ `postgresql`, `mariadb-xampp` และ
`mysql-oracle`; status `supported` ต้องมี version และ evidence ห้ามประกาศ engine
ที่ไม่มี integration evidence

## Path and checksum rules

- ทุก artifact path เป็น relative, portable และอยู่ใต้ verification root
- absolute path, backslash, empty/dot segment และ `..` parent traversal ถูกปฏิเสธ
- checksum ใช้ SHA-256 ของ exact bytes
- parent gitlink, checked-out child `HEAD` และ manifest commit ต้องเท่ากัน
- release mode ต้องพบ exact child tag ที่ commit นั้น
- suite/component tag ต้องตรงกับ SemVer ใน manifest

## Verification CLI

ตรวจ manifest ระหว่างพัฒนาโดยยังไม่บังคับ tag:

```powershell
pnpm release:verify -- integration/fixtures/releases/valid.yaml
```

ตรวจ manifest จริงหนึ่งไฟล์และบังคับ exact tags:

```powershell
pnpm release:verify -- releases/suite-v1.0.0.yaml --release
```

ตรวจหลายไฟล์ที่ระบุชัด:

```powershell
pnpm release:verify:all -- releases/suite-v1.0.0.yaml releases/suite-v1.1.0.yaml --release
```

CLI ไม่ค้นหรือเลือก manifest แทนผู้ใช้ เพื่อไม่ให้ release set เปลี่ยนเงียบ ๆ
ทุก failure คืน non-zero exit code และ stable error code โดยไม่พิมพ์ secret

## Deploy wrapper contract

`infraStack.deployScript` is a relative path to the InfraStack deploy script (normally
`scripts/deploy.sh`), not an application Compose file. The wrapper verifies the checkout
`HEAD`, clean worktree/index, Git mode `100755`, and SHA-256 before executing the pinned file.

Each target project must provide `.env` and `docker-compose.yml`. Runtime images must use
`APP_IMAGE_DIGEST_REF=registry/repository@sha256:<64 hex>`. API also requires
`MIGRATE_IMAGE` with the same digest and `DEPLOY_MIGRATE=0`; the wrapper runs `api-migrate`
separately before the service handoff.

The suite command is `scripts/deploy-infra-stack.sh` and accepts only:

```text
--infra-stack-dir <absolute checkout>
--release-manifest <path under releases/>
--api-project <safe compose project name>
--admin-project <safe compose project name>
--site-project <safe compose project name>
```

It fails closed when the manifest, target contract, registry digest, migration, health
endpoint, running image ID, or target-file hash is invalid. It does not edit files in the
checkout.

## Versioning

API, Admin และ Site ใช้ SemVer อิสระ ส่วน parent ใช้ suite SemVer เพื่อระบุชุดที่
ผ่าน compatibility verification ร่วมกัน การ bump suite ไม่ได้บังคับให้ child ทั้งสาม
bump พร้อมกัน แต่ manifest ต้อง pin exact version/commit/tag/image ของทุก child
