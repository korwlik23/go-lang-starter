# Development Prerequisites

- สถานะ: Gate 0 toolchain ผ่าน
- วันที่ตรวจสอบ: 2026-07-28
- Shell ที่ตรวจ: Windows PowerShell

## Supported runtime choices

ค่าที่เลือกอ้างอิงเอกสารทางการ ณ วันที่ตรวจ:

- Go ใช้สาย stable ปัจจุบัน `1.26`; เวอร์ชันติดตั้งเป้าหมายคือ `1.26.5`
  ตาม [Go release history](https://go.dev/doc/devel/release) ซึ่งระบุด้วยว่าแต่ละ
  major รองรับจนกว่าจะมี major ใหม่กว่าสองรุ่น
- Node.js ใช้ `24` LTS ไม่ใช้ `26` Current สำหรับ production tooling ตาม
  [Node.js release policy](https://nodejs.org/en/about/previous-releases)
- pnpm ใช้ major `11`; [pnpm compatibility table](https://pnpm.io/installation#compatibility)
  รองรับ Node.js 24 และแนะนำ Corepack บน Windows
- Docker Desktop ใช้ Linux containers ผ่าน WSL 2 ตาม
  [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/)

ก่อนสร้าง lockfile หรือ pin CI image ต้องตรวจ patch release ล่าสุดจากแหล่งทางการซ้ำ
อีกครั้ง เวอร์ชันในตารางถัดไปคือสิ่งที่รันได้จริงใน shell นี้ ไม่ใช่การเดาจาก policy

## Observed toolchain

| Tool | Command or path | Observed result | Gate |
|---|---|---|---|
| Git | `git --version` | `git version 2.53.0.windows.2` | PASS |
| Go | `go version` | `go1.26.5 windows/amd64` | PASS |
| Node.js | `node --version` | `v24.14.1` | PASS — supported LTS major |
| Corepack | `corepack --version` | `0.34.6` | PASS |
| pnpm | `pnpm --version` | `11.9.0` | PASS |
| Docker Client/Engine | `docker version` | Client/Server `29.6.2`, API `1.55`, context `desktop-linux` | PASS |
| Docker Compose | `docker compose version` | `v5.3.1` | PASS |
| WSL | `wsl --version`; `wsl --list --verbose` | `2.7.10.0`; `docker-desktop` running บน WSL 2 | PASS |
| Gitleaks | `gitleaks version` | `8.30.1` | PASS |
| actionlint | `actionlint -version` | `1.7.12` | PASS |
| ShellCheck | `shellcheck --version` | `0.11.0` | PASS |
| Bash | explicit `BASH_PATH` | `GNU bash 5.2.37(1)-release` | PASS |

Docker Desktop และ per-user CLI ที่พบ:

```dotenv
DOCKER_DESKTOP_PATH=C:\Users\kil\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe
DOCKER_PATH=C:\Users\kil\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe
```

Docker Desktop Resource Saver อาจหยุด VM หลัง idle แต่ `docker version` จาก Codex
session นี้ปลุก engine และยืนยัน Client/Server connectivity สำเร็จแล้ว

Go, Gitleaks, actionlint และ ShellCheck ติดตั้งจาก exact `winget` package IDs โดย
ตัวติดตั้งทุกตัวผ่าน package hash verification ก่อนบันทึกสถานะ PASS

## Bash resolution

PowerShell ปัจจุบันไม่ได้ resolve `bash` จาก `PATH` แต่ Git Bash ใช้งานได้ที่ absolute
path นี้ ทุก shell ใหม่ที่ใช้คำสั่งในแผนต้องตั้งค่า:

```powershell
$env:BASH_PATH = 'C:\Program Files\Git\bin\bash.exe'
& $env:BASH_PATH --version
```

Production Linux ต้อง resolve ใหม่บน host นั้น:

```bash
export BASH_PATH="$(command -v bash)"
"$BASH_PATH" --version
```

## Git ownership for Codex-created child repositories

Child directories ถูกสร้างโดย sandbox account แต่ผู้ใช้ทำงานด้วย Windows account
`kil` จึงเพิ่มเฉพาะ trusted paths ต่อไปนี้ใน global Git config:

```text
D:/go-lang-starter/api
D:/go-lang-starter/admin
D:/go-lang-starter/site
```

ตรวจด้วย `git config --global --get-all safe.directory` ห้ามตั้ง
`safe.directory=*` เพราะจะปิด ownership protection สำหรับทุก repository

## Quality tool sources

ติดตั้ง release binary จาก upstream แล้วตรวจ version command ก่อนเริ่มงานที่อาศัย
tool นั้น:

- [Gitleaks](https://github.com/gitleaks/gitleaks)
- [actionlint](https://github.com/rhysd/actionlint)
- [ShellCheck](https://www.shellcheck.net/)

Gitleaks ปัจจุบันใช้ `gitleaks dir` สำหรับ working-tree scan; คำสั่ง `detect` ถูก
deprecate ตั้งแต่รุ่นก่อนหน้า จึงต้องแก้ implementation plan ให้ใช้ command ปัจจุบัน
ก่อนเพิ่ม secret-scan tasks

## Database identities

| Profile | Identity verified on this machine | Current status |
|---|---|---|
| `postgresql` | `postgres:18.4-alpine3.24`; `postgres@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15`; runtime รายงาน PostgreSQL `18.4` | PASS |
| `mariadb-xampp` | `C:\xampp\mysql\bin\mysql.exe`, `10.4.32-MariaDB` | Client PASS; dedicated test database ยังไม่ได้ทดสอบ |
| `mysql-oracle` | ไม่มี Oracle MySQL runtime ที่ตรวจได้ | NOT TESTED; ห้ามประกาศ supported |

XAMPP profile นี้คือ `MariaDB/XAMPP` ไม่ใช่ Oracle MySQL การทดสอบ migration ต้องใช้
dedicated test database เท่านั้น ห้ามชี้ไปฐานข้อมูลใช้งานจริง

## Gate 0 verification commands

Codex รันชุดนี้แล้วและทุก runtime/quality command exit `0`:

```powershell
git --version
go version
node --version
corepack --version
pnpm --version
docker version
docker compose version
gitleaks version
actionlint -version
shellcheck --version
$env:BASH_PATH = 'C:\Program Files\Git\bin\bash.exe'
& $env:BASH_PATH --version
C:\xampp\mysql\bin\mysql.exe --version
```

Gate ผ่านเมื่อทุก quality/runtime command ที่ milestone ใช้ exit `0`, Docker แสดงทั้ง
Client/Server และ database test profiles มี isolated identity ชัดเจน

Working-tree secret scan ใช้ `gitleaks dir --redact D:\go-lang-starter` และผ่านด้วย
ผล `no leaks found` หลังเปลี่ยนรูปแบบ Git SHA ใน repository identifiers ไม่ให้ดูคล้าย
API credential
