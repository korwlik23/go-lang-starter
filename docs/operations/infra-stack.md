# InfraStack deployment contract

Starter นี้เตรียม project templates สำหรับ InfraStack revision
`ee4df171bbc00783d2f560e8a907d60937e61782` โดยไม่แก้ไฟล์ใน
`D:\infra-stack` อัตโนมัติ:

- `ops/infra-stack/api`
- `ops/infra-stack/admin`
- `ops/infra-stack/site`

คัดลอกแต่ละ directory ไปไว้ใต้ `D:\infra-stack\projects\<project-name>` แล้วคัดลอก
`.env.example` เป็น `.env` ภายใน project นั้น ห้าม commit `.env`

## ค่า image และ deploy

| Variable | แหล่งที่มา |
|---|---|
| `APP_IMAGE` | release tag ที่ workflow publish ไป GHCR เช่น `ghcr.io/korwlik23/go-api-starter:0.1.0` |
| `APP_IMAGE_DIGEST_REF` | digest ref จากผล push ของ GHCR ต้องอยู่รูป `repository@sha256:<64 hex>` |
| `MIGRATE_IMAGE` | API digest เดียวกับ `APP_IMAGE_DIGEST_REF`; migration และ runtime ต้องมาจาก source release เดียวกัน |
| `ROLLOUT_SERVICE` | กำหนดไว้ตายตัวตาม template: `api`, `admin` หรือ `site` |
| `DEPLOY_MIGRATE` | ต้องเป็น `0`; wrapper ระดับ suite เป็นผู้เรียก `api-migrate` ก่อน deploy |
| `DEPLOY_HEALTH_URL` | URL HTTPS จาก DNS จริง: API ลงท้าย `/readyz`; Admin/Site ลงท้าย `/healthz` |

อย่าใช้ tag อย่างเดียวเป็น runtime image เพราะ tag เปลี่ยนปลายทางได้
`APP_IMAGE` มีไว้ให้ InfraStack/release tooling แสดงรุ่น ส่วน Compose รัน
`APP_IMAGE_DIGEST_REF`

## Domain และ proxy

| Variable | ค่า production นี้ | แหล่งที่มา |
|---|---|---|
| `PUBLIC_ORIGIN`, `PUBLIC_SITE_URL`, Site `APP_DOMAIN` | `https://tewarach-dev.me` / `tewarach-dev.me` | DNS zone ของ public site |
| `ADMIN_ORIGIN`, Admin `APP_DOMAIN` | `https://admin.tewarach-dev.me` / `admin.tewarach-dev.me` | DNS record ที่ชี้ Traefik |
| `API_ORIGIN`, API `APP_DOMAIN` | `https://api.tewarach-dev.me` / `api.tewarach-dev.me` | DNS record ที่ชี้ Traefik |
| `TRUSTED_PROXY_CIDRS` | CIDR ของ external Docker network `proxy` เท่านั้น | ตรวจด้วย `docker network inspect proxy`; ห้ามใช้ `0.0.0.0/0` หรือ `::/0` |

Traefik ต้องมี external network `proxy`, certificate resolver `letsencrypt` และ
middleware `security-headers@file` ตาม InfraStack ส่วน API กับฐานข้อมูลใช้ external
network `backend`

## Database

`DB_DRIVER=postgres` เป็นค่า production หลัก ใช้ `DB_FLAVOR=mariadb` ร่วมกับ
`DB_DRIVER=mysql` เมื่อ deploy MariaDB ส่วน Oracle MySQL ใช้ `DB_DRIVER=mysql` และ
ปล่อย `DB_FLAVOR` ว่าง

ค่าต่อไปนี้มาจาก database service/project:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_SSLMODE`
- `DB_RUNTIME_USER`/`DB_RUNTIME_PASSWORD`: principal สำหรับ API runtime
- `DB_MIGRATION_USER`/`DB_MIGRATION_PASSWORD`: principal สำหรับ schema migration

สอง principal ต้องไม่ใช่บัญชีเดียวกัน Migration credentials ถูกส่งให้เฉพาะ
`api-migrate` และไม่ถูกส่งเข้า service `api` ก่อนเปลี่ยน database engine ให้ backup
และทดสอบ migration/restore กับข้อมูลจำลองก่อนทุกครั้ง

MariaDB จาก XAMPP เหมาะกับ local development มากกว่า production container network
ถ้าจะเชื่อมจาก container บน Windows ให้ใช้ `host.docker.internal`, เปิดรับเฉพาะ
source ที่จำเป็น และสร้าง application principal แยกจาก `root`

## Security keys

สร้างค่าต่อไปนี้จาก password manager หรือ secret manager และใช้ random bytes
อย่างน้อย 32 bytes ต่อค่า ห้ามนำตัวอย่างใน `.env.example` ไปใช้จริง:

- `SESSION_TOKEN_PEPPER`
- `CSRF_TOKEN_PEPPER`
- `AUTH_ATTEMPT_FINGERPRINT_KEY`
- TOTP encryption keyring
- recovery token, delivery และ recovery-code keyrings

Keyring ใช้รูป `version:base64-key` เช่น `v1:<base64>` และเก็บ key รุ่นเก่าไว้ระหว่าง
ช่วง rotate จนข้อมูล/token ที่อ้างถึงรุ่นนั้นหมดอายุ

## Locale

`INITIAL_LOCALES` เป็น comma-separated BCP 47 tags ที่ต้องการ provision ตอน migrate
เช่น `th,en,ja` และ `DEFAULT_LOCALE` ต้องเป็นหนึ่งในรายการนั้น หลัง bootstrap แล้ว
system operator ที่มี permission จัดการ locale สามารถเพิ่มภาษา เปลี่ยนภาษาที่ user
เลือกได้ และแก้คำแปลจาก Back Office โดยไม่แก้ code

## Deployment order

1. ตรวจว่า InfraStack checkout อยู่ revision ที่ release manifest pin และ worktree clean
2. ตรวจ digest parity ของ API/Admin/Site
3. รัน `api-migrate` ด้วย migration principal
4. deploy `api` และรอ `/readyz`
5. deploy `admin` และรอ `/healthz`
6. deploy `site` และรอ `/healthz`
7. ตรวจ `/th/`, `/en/`, login และ effective permissions

หาก migration, readiness, health หรือ digest check ใดล้ม ต้องหยุดก่อน deploy service
ถัดไป ห้ามแก้ `.env` หรือ Compose ระหว่าง rollout เพื่อข้าม preflight
