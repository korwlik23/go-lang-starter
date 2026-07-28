# OpenAPI Contract

## Ownership

`api` repository เป็น source of truth ของ OpenAPI ทุก surface โครงสร้างต้นทางอยู่ใต้
`api/openapi/` และแยก operation/schema ตาม bounded context เจ้าของ domain นั้น
Admin และ Site ห้ามสร้าง schema คู่ขนานหรือ import runtime source จาก API repository

Contract artifacts ที่ API ต้อง bundle และ publish แบบ immutable มีสามชุด:

| Surface | Artifact | Consumer |
|---|---|---|
| Admin | `api/openapi/dist/admin.openapi.yaml` | Vue Admin |
| Public | `api/openapi/dist/public.openapi.yaml` | Public browser/client |
| Site server | `api/openapi/dist/site-server.openapi.yaml` | Astro server-only flows |

แต่ละ surface ใช้ explicit allowlist เพื่อป้องกัน admin mutation หลุดไป Public/Site
contract และป้องกัน server-only operation ถูกเรียกจาก browser

## Acquisition and checksums

Consumer ต้อง pin ข้อมูลต่อไปนี้พร้อมกัน:

- exact API repository URL
- full API commit SHA
- artifact path แบบ relative
- SHA-256 ของ exact artifact bytes

ห้าม fetch ด้วย branch อย่างเดียว และห้ามยอมรับ absolute path หรือ parent traversal
เมื่อ checksum ไม่ตรงต้องหยุดก่อน generate/build

Parent release manifest เก็บ version, path และ checksum ของทั้งสาม artifacts
ตัวตรวจสอบใช้ exact bytes; การ format YAML ใหม่จึงเปลี่ยน checksum แม้ semantics
ดูเหมือนเดิม

## Generated clients

Generated Go/TypeScript clients อยู่ใน repository ของ consumer และห้ามแก้ด้วยมือ
CI ต้อง:

1. ดึง artifact จาก exact commit หรือรับ verified local sibling artifact
2. ตรวจ checksum ก่อน generate
3. generate ด้วย toolchain ที่ pin แล้ว
4. generate ซ้ำและยืนยัน no-diff

View/component ห้าม import generated client โดยตรง ให้ผ่าน module API adapter เพื่อ
จำกัดผลกระทบจาก contract change

## Change policy

API contract ใช้ SemVer แยกจาก suite และ child applications:

- breaking request/response หรือ operation removal ต้องเพิ่ม major
- backward-compatible operation/schema addition เพิ่ม minor
- clarification/fix ที่ไม่เปลี่ยน behavior เพิ่ม patch

ก่อน merge ต้อง lint, bundle, surface-isolation test, generate และ consumer
compatibility test ผ่านจริง ห้ามอ้างความเข้ากันได้จาก source schema ที่ยังไม่ได้ bundle
