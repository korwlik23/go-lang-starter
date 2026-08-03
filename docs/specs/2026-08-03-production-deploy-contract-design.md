# Production Deploy Contract Design

สถานะ: approved design input สำหรับ implementation ใน starter repository
วันที่: 2026-08-03

## Problem and goal

Starter มี InfraStack templates, release manifest และ health endpoints แล้ว แต่ยังไม่มี
wrapper ที่บังคับให้ deployment ตรวจ revision, target contract, immutable image digest,
migration order และ running-release health ก่อนเปลี่ยน service จริง งานนี้จะเพิ่ม
contract-first deployment tooling โดยไม่แก้ `D:\infra-stack` อัตโนมัติและไม่ expose secrets
ใน log

เป้าหมายคือทำให้คำสั่ง deploy:

1. รับ input แบบ explicit และ reject path/project ที่ไม่ปลอดภัย
2. ตรวจ InfraStack checkout ให้ตรงกับ release manifest และ clean ก่อนรันคำสั่งใด ๆ
3. ตรวจ target `.env`/Compose ให้เป็น registry-only, digest-pinned และ hardened
4. ตรวจ image digest parity ก่อน migration/deploy
5. รัน migration แยกก่อน แล้ว deploy ตามลำดับ API → Admin → Site
6. ตรวจ health endpoint และ running image ID หลังแต่ละ handoff
7. ส่งต่อ failure และยืนยันว่า target files ไม่ถูกแก้ทั้งกรณีสำเร็จและล้มเหลว

## Non-goals and safety boundary

- ไม่แก้ไข, checkout, commit, pull, push หรือสร้างไฟล์ใน `D:\infra-stack` โดย wrapper
- ไม่สร้างหรือหมุน production secrets ให้เอง
- ไม่ deploy จริงในระหว่าง local verification
- ไม่เปลี่ยน database schema หรือ application behavior
- ไม่ประกาศว่า VPS production ผ่าน จนกว่าจะมี environment evidence จริง

## Approaches considered

### Manual runbook only

ทำเร็วและไม่มี code orchestration แต่ไม่สามารถบังคับ revision/digest parity, failure
propagation หรือ no-mutation ได้สม่ำเสมอ จึงไม่พอสำหรับ production boundary

### Contract-first wrapper (selected)

แยก pure validators จาก shell orchestration, ทดสอบด้วย disposable fixture และ fail closed
ก่อน workload-changing command วิธีนี้เพิ่มไฟล์มากกว่า runbook แต่ตรวจซ้ำได้, review ได้ และ
รองรับ rollback/incident evidence โดยไม่ผูกกับเครื่อง VPS ใดเครื่องหนึ่ง

### Direct mutation of `D:\infra-stack`

อาจ deploy ได้เร็ว แต่ทำลาย boundary ระหว่าง starter กับ user-owned infrastructure และเสี่ยง
เปลี่ยน production files โดยไม่มี review จึงไม่เลือก

## Architecture and file responsibilities

### Orchestration

- `scripts/deploy-infra-stack.sh` — รับ flags, เรียก validators ตามลำดับ, รัน migration,
  เรียก target `scripts/deploy.sh` ทีละ service, poll health และคืน non-zero เมื่อขั้นตอนใดล้มเหลว

### Pure validation helpers

- `scripts/deploy/parse-inputs.mjs` — ตรวจ required flags ทั้งห้า, absolute/canonical path,
  safe project names และ manifest path ที่อยู่ใต้ parent `releases/`
- `scripts/deploy/validate-infra-checkout.mjs` — ตรวจ checkout `HEAD` ตรง manifest pin,
  tracked worktree/index clean, deploy script เป็น regular executable mode `100755` และ
  bytes ตรงกับ pinned blob
- `scripts/deploy/validate-target-contract.mjs` — อ่าน target `.env` และ rendered Compose JSON;
  ตรวจ exact `DEPLOY_MIGRATE=0`, credential-free HTTPS health URL, service/network names,
  digest refs, no build/host ports/container name, numeric user, read-only, tmpfs,
  `cap_drop: ALL`, `no-new-privileges` และ resource limits
- `scripts/deploy/verify-image-parity.mjs` — resolve component release tag จาก manifest,
  require target digest ref และ migration digest ให้ตรงกัน, pull exact immutable refs และ
  ตรวจ `RepoDigests`
- `scripts/deploy/verify-running-release.mjs` — ตรวจ HTTP health ด้วย bounded deadline,
  ตรวจ service container image IDs ให้ตรง local immutable image IDs และคืน failure เมื่อ
  service ไม่พร้อม
- `scripts/deploy/hash-target-files.mjs` — คำนวณ SHA-256 ของ target `.env`/Compose ก่อนและ
  หลัง deployment เพื่อพิสูจน์ no-mutation

### Contract tests and documentation

- `integration/tests/deploy-contract.test.ts` — fixture-based RED/GREEN coverage สำหรับ
  input/path containment, revision pin, target contract, digest mismatch, migration order,
  failure propagation และ no-mutation
- `docs/operations/infra-stack.md` — อธิบาย wrapper command, preflight, deployment order,
  rollback boundary, required secrets และหลักฐานที่ยังต้องเก็บจาก VPS

## Deployment flow

```text
parse inputs
  -> verify InfraStack revision and deploy script
  -> validate API/Admin/Site target contracts
  -> verify and pull immutable image digests
  -> hash target files
  -> run API api-migrate once
  -> deploy API and verify /readyz + image ID
  -> deploy Admin and verify /healthz + image ID
  -> deploy Site and verify /healthz + image ID
  -> compare target hashes and finish
```

No service handoff runs after a failed preflight, digest check, migration, health check or
image parity check. Secrets are passed through environment files/Compose only and never echoed.

## Error handling and rollback

- Validators fail before any Docker workload-changing command.
- Migration failure stops deployment and preserves the previous running release.
- Service deploy or health timeout returns non-zero and does not advance to the next service.
- The wrapper does not auto-rollback or mutate target files; rollback remains the target
  infrastructure's explicit previous-digest operation.
- Hash mismatch after execution is a hard failure requiring operator review.

## Verification strategy

- Follow RED → GREEN → REFACTOR for each validator behavior.
- Run `bash -n` and ShellCheck for the wrapper.
- Run fixture contract tests without touching the real `D:\infra-stack`.
- Render all three InfraStack templates with safe fixture values.
- Run existing release, structure and local health suites after implementation.
- Production readiness remains unverified until a real registry/VPS run supplies evidence.

## Approved scope record

ผู้ใช้อนุมัติแนวทาง Production-first และ design contract-first wrapper เมื่อ 2026-08-03
โดยยืนยัน boundary ว่าไม่แก้ `D:\infra-stack` อัตโนมัติ
