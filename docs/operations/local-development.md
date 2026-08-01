# Local development

Starter suite รันได้สอง database profiles โดยใช้ application images ชุดเดียวกัน:

- PostgreSQL: primary profile
- MariaDB: first-class MySQL-family profile และเป็นตัวแทน schema/runtime behavior ที่ใช้กับ XAMPP

ค่าทั้งหมดใน `compose.dev.yml` เป็น development-only dummy values ห้ามนำไปใช้ใน production

## Prerequisites

- Docker Desktop พร้อม Linux containers
- Docker Compose ที่รองรับ `service_completed_successfully`
- Git submodules อยู่ที่ commits ที่ parent repository pin ไว้

ตรวจ configuration โดยยังไม่สร้าง container:

```powershell
docker compose --profile postgres -f compose.dev.yml config --quiet
docker compose --profile mariadb -f compose.dev.yml config --quiet
```

## Start with PostgreSQL

```powershell
Set-Location D:\go-lang-starter
docker compose --profile postgres -f compose.dev.yml up --build -d
docker compose --profile postgres -f compose.dev.yml ps
```

## Start with MariaDB

ใช้ครั้งละหนึ่ง database profile เพราะ API ทั้งสอง profile ใช้ host port `8080` เดียวกัน:

```powershell
Set-Location D:\go-lang-starter
docker compose --profile mariadb -f compose.dev.yml up --build -d
docker compose --profile mariadb -f compose.dev.yml ps
```

Compose จะรอ database healthcheck, รัน `/app/migrate` ให้สำเร็จ แล้วจึงเริ่ม API

## One-time bootstrap

คัดลอกไฟล์ตัวอย่างที่ถูก Git ignore แล้วแก้ค่าด้วย password manager:

```powershell
Copy-Item .env.bootstrap.example .env.bootstrap
notepad .env.bootstrap
```

PostgreSQL:

```powershell
docker compose --profile postgres -f compose.dev.yml run --rm --env-from-file .env.bootstrap --entrypoint /app/bootstrap api-postgres
```

MariaDB:

```powershell
docker compose --profile mariadb -f compose.dev.yml run --rm --env-from-file .env.bootstrap --entrypoint /app/bootstrap api-mariadb
```

Bootstrap สร้าง account, user, membership และ role UUID สอง scope จาก permission catalog ปัจจุบัน ชื่อ role เป็น display-only และไม่ถูกใช้ authorize การรันซ้ำจะตรวจ exact projection และไม่สร้างข้อมูลซ้ำ

ลบ `.env.bootstrap` หลังใช้งานหรือเก็บไว้เฉพาะใน secret manager ที่เหมาะสม ห้าม commit ไฟล์นี้

## Local URLs

- Public Site: `http://127.0.0.1:4321`
- Vue Admin: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8080`
- Liveness: `http://127.0.0.1:8080/livez`
- Readiness: `http://127.0.0.1:8080/readyz`

## Stop

คำสั่งนี้หยุดและลบ containers/networks แต่เก็บ named database volume:

```powershell
docker compose --profile postgres -f compose.dev.yml down
docker compose --profile mariadb -f compose.dev.yml down
```

อย่าเพิ่ม `--volumes` เว้นแต่ตั้งใจลบข้อมูล local database และตรวจ target แล้ว

## XAMPP MariaDB/MySQL

ใช้ `api/.env.mariadb-xampp.example` เป็นฐาน ตั้ง `DB_HOST=host.docker.internal` เมื่อ API รันใน container หรือ `DB_HOST=127.0.0.1` เมื่อ API รันบน Windows โดยตรง ต้องใช้ database และ principal สำหรับ development/test โดยเฉพาะ ห้ามชี้ migration/test runner ไปยัง production database

ตรวจ profile จาก API repository:

```powershell
Set-Location D:\go-lang-starter\api
.\scripts\test-db.ps1 -Profile xampp -EnvFile .env.mariadb-xampp
```

Runner มี destructive guard และจะปฏิเสธชื่อ database ที่ไม่ใช่ test profile ตาม contract

## Troubleshooting

- `failed to connect to the docker API`: เปิด Docker Desktop และรอ Linux engine พร้อม
- API ไม่เริ่ม: ตรวจ `docker compose ... ps -a` และ log ของ `migrate-postgres` หรือ `migrate-mariadb`
- Admin ปิดตัวทันที: `PUBLIC_API_BASE_URL` ต้องเป็น HTTPS หรือ local HTTP URL ที่ไม่มี query, fragment หรือ credentials
- Site ตอบ error: ตรวจว่า service `api` healthy และ `SITE_API_BASE_URL=http://api:8080/api/v1`
