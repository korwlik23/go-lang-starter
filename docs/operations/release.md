# Release Operations

เอกสารนี้เป็น runbook สำหรับสร้างและตรวจ suite release หลัง child artifacts มีอยู่จริง
การ push, tag, publish image หรือ deploy เป็น external mutation และต้องได้รับอนุญาต
แยกจากการเตรียม local commits

## Preconditions

- parent และ child worktrees สะอาด
- child tests/build/security checks ผ่าน
- child `CHANGELOG.md` และ SemVer ถูก review
- OpenAPI/catalog artifacts ถูก generate แบบ no-diff
- images ถูก build และมี immutable OCI digest
- database support matrix มี evidence จริง
- exact InfraStack commit และ `scripts/deploy.sh` checksum ถูกตรวจ
- `pnpm install --frozen-lockfile` และ `pnpm test:release` ผ่าน

## Release sequence

1. ออก child versions แยกกันและสร้าง annotated `v<version>` tags หลังได้รับอนุญาต
2. publish child images แล้วบันทึก immutable digest refs
3. pin parent submodules ไป exact child commits ที่ tag แล้ว
4. สร้าง `releases/suite-v<version>.yaml` จากหลักฐานจริง
5. รัน schema, checksum, gitlink/HEAD และ exact-tag verification
6. review diff ของ manifest และ gitlinks
7. commit manifest แล้วสร้าง annotated `suite-v<version>` tag หลังได้รับอนุญาต
8. deploy ด้วย exact manifest และเก็บผล health/database compatibility เป็น evidence

คำสั่งตรวจหลัก:

```powershell
pnpm install --frozen-lockfile
pnpm test:release
pnpm release:verify -- releases/suite-v1.0.0.yaml --release
git submodule status --recursive
```

ห้ามใช้ `git submodule update --remote` ระหว่าง release เพราะจะเลื่อน child commit
ตาม branch โดยไม่ผ่าน manifest review ให้ใช้เฉพาะ:

```powershell
git submodule sync --recursive
git submodule update --init --recursive
```

หลัง checkout ต้องไม่มี prefix `-`, `+` หรือ `U` ใน `git submodule status`.

## CI behavior

`.github/workflows/contracts.yml` checkout แบบ recursive, fetch full parent/child tag
history, frozen install, รัน release tests และตรวจ integration fixture ทุกครั้ง
หากมี `releases/suite-v*.yaml` workflow จะตรวจทุกไฟล์ใน release mode ด้วย

ผล hosted CI ยังไม่ถือว่าผ่านจน workflow ถูก push และ GitHub Actions run สำเร็จ

## Rollback

Rollback ใช้ parent suite tag/manifest รุ่นก่อนที่ผ่านการตรวจแล้ว:

1. เลือก exact prior `suite-v<version>` และตรวจ signature/review record
2. checkout parent tag แล้ว sync/update submodules แบบไม่ใช้ `--remote`
3. deploy immutable image digests จาก manifest เดิม
4. ตรวจ API readiness, Admin/Site health และ running image parity
5. ตรวจ data compatibility; ห้ามรัน destructive database down migration อัตโนมัติ

หาก schema ใหม่ไม่ backward-compatible ต้องใช้ forward-fix/expand-contract plan ที่
อนุมัติไว้ ไม่ rollback database จากการคาดเดา

## Failure handling

- checksum, gitlink, `HEAD`, tag หรือ InfraStack revision ไม่ตรง: หยุด release
- child tag/image ยังไม่มี: ห้ามสร้าง real suite manifest เพื่อเลี่ยง placeholder
- database profile ไม่มี evidence: ใช้ `not-tested` หรือ `not-supported`
- hosted CI ไม่ผ่าน: ห้าม tag/publish/deploy ต่อ
- rollback manifest หาไม่ครบ: หยุดและกู้ release evidence ก่อนเปลี่ยน workload
