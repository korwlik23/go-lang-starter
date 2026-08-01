# go-lang-starter

Starter suite สำหรับพัฒนา CMS, Back Office และ public website โดยแยกแต่ละ runtime
เป็น repository อิสระ แต่ pin เวอร์ชันที่ทำงานร่วมกันผ่าน parent Git superproject นี้

> สถานะปัจจุบัน: เริ่ม implementation ระยะ repository foundation แล้ว
> ฟีเจอร์ application ยังอยู่ระหว่างพัฒนา

## Repositories

| Path | Repository | Responsibility |
|---|---|---|
| `api/` | [go-api-starter](https://github.com/korwlik23/go-api-starter) | Go + Gin API และ source of truth ของ OpenAPI |
| `admin/` | [vue-vite-admin-starter](https://github.com/korwlik23/vue-vite-admin-starter) | Vue + Vite สำหรับ Admin/Back Office |
| `site/` | [astro-site-starter](https://github.com/korwlik23/astro-site-starter) | Astro สำหรับ Landing, Docs และ Public Site |

Parent repository รับผิดชอบเฉพาะ:

- การ pin child repositories ด้วย Git submodule
- compatibility และ release contract ของทั้ง suite
- integration verification และเอกสารส่วนกลาง
- orchestration สำหรับ local development และการเชื่อมต่อ `D:\infra-stack`

Parent ไม่มี application runtime และ child repositories ต้องไม่ import source code
ข้าม repository โดยตรง

## Clone

Clone พร้อม submodules:

```powershell
git clone --recurse-submodules https://github.com/korwlik23/go-lang-starter.git
Set-Location go-lang-starter
git submodule update --init --recursive
```

หาก clone parent มาก่อนแล้ว ให้รันเฉพาะคำสั่ง `git submodule update` ด้านบน

## Database profiles

- `postgresql` — primary profile
- `mariadb-xampp` — first-class local profile สำหรับ MariaDB ที่มากับ XAMPP
- `mysql-oracle` — compatibility profile; ยังห้ามประกาศ supported
  จนกว่าจะผ่าน integration tests บน Oracle MySQL จริง

รายละเอียด runtime และเครื่องมือที่ตรวจแล้วอยู่ใน
[Development Prerequisites](docs/operations/development-prerequisites.md)

## Documentation

- [Design specification](docs/specs/2026-07-27-go-lang-starter-design.md)
- [Implementation plan](docs/specs/2026-07-27-go-lang-starter-implementation-plan.md)
- [Milestone 1 plan](docs/specs/2026-07-27-go-lang-starter-milestone-1-plan.md)
- [Repository identifiers](docs/operations/repository-identifiers.md)
- [InfraStack deployment](docs/operations/infra-stack.md)

## Release policy

แต่ละ child repository มี version และ deployment lifecycle ของตัวเอง ส่วน release
ของ parent จะบันทึก exact child commit, SemVer, immutable image digest, API contract
checksum และ InfraStack revision ที่ผ่าน compatibility verification ร่วมกัน

## Local quick start

เลือก PostgreSQL หรือ MariaDB profile แล้วทำตาม [Local development](docs/operations/local-development.md) ซึ่งครอบคลุม migration order, one-time permission-driven bootstrap, XAMPP และ troubleshooting
