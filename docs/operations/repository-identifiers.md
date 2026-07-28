# Repository and Release Identifiers

- สถานะ: ยืนยัน identifiers และ Gate 0 toolchain ครบแล้ว; local implementation
  commits อาจอยู่หน้า remote จนกว่าจะได้รับอนุญาตให้ push
- วันที่ตรวจสอบ: 2026-07-28
- Default branch convention: `main`

## Git repositories

```dotenv
PARENT_REMOTE_URL=https://github.com/korwlik23/go-lang-starter.git
API_REMOTE_URL=https://github.com/korwlik23/go-api-starter.git
ADMIN_REMOTE_URL=https://github.com/korwlik23/vue-vite-admin-starter.git
SITE_REMOTE_URL=https://github.com/korwlik23/astro-site-starter.git
DEFAULT_BRANCH=main
```

GitHub repository metadata ยืนยันว่า repository ทั้งสี่เป็น public และผู้ใช้ปัจจุบันมี
สิทธิ์ admin โดย parent remote ยังว่าง ส่วน child remotes ทั้งสามมี branch `main`:

```dotenv
PARENT_REMOTE_EMPTY=true
API_REMOTE_HAS_MAIN=true
ADMIN_REMOTE_HAS_MAIN=true
SITE_REMOTE_HAS_MAIN=true
```

Parent initial commits ถูกสร้างในเครื่องแล้วแต่ remote ยังว่างเพราะยังไม่ได้รับอนุญาต
ให้ push ส่วน child remotes ทั้งสามมี bootstrap `refs/heads/main` ที่ตรวจตรงกับ local
bootstrap commits ตอน Gate 0

Local-first bootstrap สร้าง independent repositories ใน `api`, `admin`, `site`
พร้อม clean `main`, exact `origin` และ commits ต่อไปนี้:

| Child | Local `HEAD` | Remote `main` | State |
|---|---|---|---|
| API | `70a80780d377a983fa05c40ebde4bf6c37f03db4` | `6e68ebdd4356b4dcb145ab6c69ec4abf8e2b2b31` | ahead 3; not pushed |
| Admin | `b71072a301a2444e787e7988f7f9628fdc1958b4` | `b71072a301a2444e787e7988f7f9628fdc1958b4` | synchronized |
| Site | `2c015d41c707ee46c3161f6231b4a38559495f75` | `2c015d41c707ee46c3161f6231b4a38559495f75` | synchronized |

Bootstrap commit ของทั้งสาม child ใช้ subject `chore: initialize repository` และมี
เฉพาะ `README.md` ผู้ใช้ push จาก PowerShell ปกติสำเร็จ และ GitHub Commit API ยืนยัน
exact bootstrap SHA ครบทุก repository หลังจากนั้น API เริ่ม Phase A ใน local commits
โดยยังไม่ push

## Go module

ชื่อ module ผูกกับ canonical API repository:

```dotenv
GO_MODULE_PATH=github.com/korwlik23/go-api-starter
```

## OCI registry and images

ใช้ GitHub Container Registry ภายใต้ GitHub owner เดียวกับ repositories:

```dotenv
OCI_REGISTRY_NAMESPACE=ghcr.io/korwlik23
API_IMAGE_REPOSITORY=ghcr.io/korwlik23/go-api-starter
ADMIN_IMAGE_REPOSITORY=ghcr.io/korwlik23/vue-vite-admin-starter
SITE_IMAGE_REPOSITORY=ghcr.io/korwlik23/astro-site-starter
```

ค่านี้เป็น canonical repository name สำหรับ release contract เท่านั้น ยังไม่มีการ
build, publish หรือเปลี่ยน visibility ของ container image

## Application origins

เฉพาะ Public Site ใช้ locale segment; Admin และ API แยก subdomain และไม่มี
locale segment:

```dotenv
PUBLIC_ORIGIN=https://tewarach-dev.me
ADMIN_ORIGIN=https://admin.tewarach-dev.me
API_ORIGIN=https://api.tewarach-dev.me
```

Public routes เริ่มที่ `/{locale}/...`; root `/` ทำ locale negotiation แล้ว redirect
ไป canonical localized URL

## InfraStack contract source

```dotenv
INFRA_STACK_DIR=D:\infra-stack
INFRA_STACK_REMOTE_URL=https://github.com/korwlik23/infra-stack.git
INFRA_STACK_COMMIT=ee4df171bbc00783d2f560e8a907d60937e61782
```

Revision นี้เป็นฐานที่ใช้ตรวจ deployment contract ระหว่างการออกแบบ ไม่ได้ pin
InfraStack ให้อยู่ revision นี้ตลอดไป ทุก implementation run ต้องตรวจ revision และ
tracked worktree state ซ้ำก่อนแก้ integration contract

## Gate status

| Gate 0 check | Result |
|---|---|
| Exact URLs and identifiers recorded | PASS |
| Parent remote reachable through GitHub integration and empty | PASS |
| API local repository/initial commit | PASS — `6e68ebdd4356b4dcb145ab6c69ec4abf8e2b2b31` |
| Admin local repository/initial commit | PASS — `b71072a301a2444e787e7988f7f9628fdc1958b4` |
| Site local repository/initial commit | PASS — `2c015d41c707ee46c3161f6231b4a38559495f75` |
| API child has remote `refs/heads/main` | PASS — ตรง bootstrap SHA; local implementation ahead 3 |
| Admin child has remote `refs/heads/main` | PASS — SHA ตรง local |
| Site child has remote `refs/heads/main` | PASS — SHA ตรง local |
| Image publish, DNS or deployment performed | NO |
