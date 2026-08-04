# Predecessor Starter Review

รีวิว starter รุ่นก่อนหน้า 3 ตัว เพื่อกำหนดว่า `go-lang-starter` ต้อง **เพิ่ม**, **แก้**
หรือ **หลีกเลี่ยง** อะไรบ้าง เป้าหมายคือให้ Go เป็น starter ที่อัปเกรดมาจากทั้งสามตัว
ไม่ใช่เขียนใหม่โดยไม่เรียนรู้

- วันที่สำรวจ: 2026-07-29
- Source: `C:\xampp\htdocs\laravel-starter`, `C:\xampp\htdocs\laravel-starter-saas`,
  `C:\xampp\htdocs\next-js-starter`
- วิธี: อ่าน README/ROADMAP, โครงสร้าง directory, migrations/schema, permission layer,
  tenant isolation, module system, ขนาดไฟล์ และ test surface

---

## 1. Inventory

| | laravel-starter | laravel-starter-saas | next-js-starter |
|---|---|---|---|
| Stack | Laravel 12, Blade, Tailwind 4, Alpine | Laravel 12 + Stripe | Next.js 16, React 19, Prisma |
| ไฟล์โค้ด | 48 PHP | 106 PHP | 273 TS/TSX (25,264 บรรทัด) |
| Migrations | 10 | 39 | 31 Prisma models |
| ไฟล์ใหญ่สุด | 186 บรรทัด | 389 | 855 |
| Auth | Session + Sanctum | Session + Sanctum | JWT (HTTP-only cookie) |
| Authz | Spatie Permission (flat key) | Spatie Permission | RBAC/ABAC + wildcard |
| Multi-tenant | ไม่มี | มี (single-DB, global scope) | มี (manual filter) |
| Billing | ไม่มี | Stripe + manual payment | Stripe |
| i18n | TH/EN/JA/ZH + DB override | มี | มี (`locales/`, `messages/`) |
| MFA | ไม่มี (มีแต่เอกสารเทียบทางเลือก) | ไม่มี | TOTP + recovery codes |
| Module system | ไม่มี | `ModuleManifest` interface | folder convention |
| Test | 5 feature files | 11 feature + 5 unit | Jest + Playwright |
| CI | GitHub Actions | ไม่มี | GitHub Actions |

**ข้อสังเกตภาพรวม:** `laravel-starter` สะอาดที่สุดเพราะถูก *ตัด* ออกจากโปรเจกต์บัญชีเดิม
โดยตั้งใจ · `laravel-starter-saas` มี domain มากที่สุดแต่ schema สะสมหนี้ ·
`next-js-starter` มี capability มากที่สุดแต่มี god module และรูรั่วด้าน isolation

---

## 2. สิ่งที่ Go ออกแบบไว้ดีกว่าอยู่แล้ว — ยืนยัน อย่าเปลี่ยน

รายการนี้ยืนยันด้วยหลักฐานจาก predecessor ว่าการตัดสินใจใน `design.md` ถูกแล้ว

### 2.1 Permission key 4 ส่วน ดีกว่า wildcard

`next-js-starter/src/lib/permissions.ts` ใช้ 2 ส่วน (`user.read`) แล้วเปิด wildcard:

```ts
if (userPermissions.includes(`${module}.*`)) return true
if (userPermissions.includes('*')) return true
```

Wildcard ทำให้ **audit ไม่ได้ว่าใครมีสิทธิ์อะไรจริง** และการเพิ่ม permission ใหม่
ในโมดูลจะถูก grant อัตโนมัติให้ทุกคนที่ถือ `module.*` — เป็นช่องทาง privilege escalation
ที่มองไม่เห็น

Go ใช้ `<module>.<resource>.<action>.<scope>` แบบตรงตัว ไม่มี wildcard และมี `scope`
(`own`/`any`/`system`) ซึ่งทั้งสาม predecessor ไม่มีเลย → **ดีกว่าชัดเจน คงไว้**

### 2.2 ไม่มี direct user grant

`next-js-starter` มี model `UserPermission` (schema.prisma:124) = มอบสิทธิ์ตรงให้ user ได้
ทำให้ effective permission ของคนหนึ่งมาจาก 2 ทาง ตรวจสอบยาก และ revoke role ไม่ได้
เอาสิทธิ์คืนจริง

Go: *"User ได้ permissions ผ่าน roles เท่านั้น · ไม่มี direct user grant/deny"* → **คงไว้**

### 2.3 Opaque server-side session ดีกว่า JWT สำหรับ admin

`next-js-starter` ใช้ JWT → revoke ทันทีไม่ได้ ต้องรอหมดอายุ ซึ่งขัดกับความต้องการ
"ผู้ใช้ revoke session/device อื่นได้" และ "rotate หลัง privilege change"

Go ใช้ DB session + rotation ทุกขั้น → **คงไว้**

### 2.4 Module registry แบบ compile-in + checksum

- `laravel-starter-saas` ใช้ `config/modules.php` ระบุ `enabled` + manifest class
  → ยืดหยุ่นแต่ไม่มีอะไรตรวจว่า DB state ตรงกับโค้ด
- `next-js-starter` ไม่มี module system จริง เป็นแค่ convention ของ folder

Go มี checksum + startup validation + fail readiness เมื่อไม่ตรง → **ดีกว่าทั้งคู่ คงไว้**

### 2.5 เพดานขนาดไฟล์ + CI วัด

หลักฐานว่าจำเป็น (ดู §4.3) → **คงไว้**

---

## 3. ต้องเพิ่มใน Go — มีใน predecessor แต่ Go ยังไม่มี

### 3.1 🔴 Seed / demo data + default admin — ทั้ง 3 ตัวมี Go ไม่มี

ทุก starter พิมพ์ credential ให้เลย:

- laravel: `admin@example.com / password`
- next: `admin@acme.com / password123` (README) แต่ seeder จริงใช้ `owner@starter.dev`
  — **ไม่ตรงกัน** เป็นบั๊กเอกสารที่ Go ต้องเลี่ยงด้วยการทดสอบ onboarding ใน CI

Go ต้องมี: seed 1 account, 3 role ที่สิทธิ์ต่างกันจริง (ใช้ทดสอบ permission boundary),
user ตัวอย่าง, เนื้อหา 2 ภาษา และต้อง **รันใน CI** ไม่ใช่แค่เขียนใน README

### 3.2 🔴 Production readiness check — `laravel-starter` มี ของดีที่ควรลอก

`app/Services/ProductionReadinessService.php` ให้ report เป็นรายการ พร้อม severity
`critical`/`warning`:

| check | severity |
|---|---|
| APP_KEY ถูกตั้ง | critical |
| debug ปิด | critical |
| default admin password ถูกเปลี่ยน | critical |
| APP_URL เป็น https | warning |
| queue ไม่ใช่ `sync` | warning |
| session driver ไม่ใช่ `file` | warning |
| secure cookie เปิด | warning |
| mail sender ตั้งแล้ว | warning |

Go มี `/readyz` (ตรวจ dependency ว่ามีชีวิต) แต่ **ไม่มีอะไรตรวจว่า config ปลอดภัยพอ
สำหรับ production** → เพิ่ม `internal/modules/operations/` + หน้า Admin
"Production Readiness" (Milestone 2) ราคาถูกมากเมื่อเทียบกับคุณค่า

### 3.3 🔴 Manifest ต้องมี navigation + dashboard contribution

`laravel-starter-saas/app/Support/Modules/Contracts/ModuleManifest.php` มี 12 method
ที่สำคัญคือ:

```php
public function navigationItems(string $surface): array;
public function dashboardPartials(): array;
public function dashboardData(array $context): array;
```

Manifest ของ Go (MR1) ประกาศ `ID/tier/dependencies/capabilities/permissions/routes/
jobs/migrations/health` — **ไม่มี navigation และ dashboard**

ถ้าไม่เพิ่ม → module ใหม่จะเพิ่มเมนู sidebar ไม่ได้โดยไม่แก้ core = ทำลายเป้าหมาย
"เพิ่ม module โดยไม่แตะ core" และจะเกิด god file ที่ `admin/src/app/router/core-routes.ts`

> **บทเรียนติดลบด้วย:** `ModuleManifest` ของ Laravel รับ `Tenant $tenant` ตรงๆ
> ทำให้ contract ผูกกับ concrete model — Go ต้องใช้ interface/ID เท่านั้น

### 3.4 🟠 Developer tooling pages — `next-js-starter` มี ของดีที่ควรลอก

```text
/dev/ui           UI component explorer
/dev/permissions  ตาราง role × permission ทั้งระบบ
/dev/test-api     ยิง API ทดสอบจากในเว็บ
/dev/theme        ดู design token
```

`/dev/permissions` มีค่ามากเป็นพิเศษกับ Go เพราะระบบสิทธิ์ซับซ้อนกว่า (4 ส่วน + scope +
tier + active + delegable) การมองเห็น matrix ทั้งหมดในหน้าเดียวคือเครื่องมือ debug
ที่ดีที่สุด และเป็น QA artifact ของ Q14 escalation matrix ไปในตัว

เงื่อนไข: ต้องปิดใน production build

### 3.5 🟠 Email / notification service — ทั้ง 3 ตัวมี Go ยังไม่มี port

- laravel: `OperationalAlertService`, Notification model, database notifications
- next: `src/lib/email.ts` (Resend)

Go ระบุ SMTP เป็นแค่ "infrastructure capability" แต่ M2 มี Forgot/Reset Password
ที่ส่งเมลไม่ได้ = ใช้ไม่ได้ → ต้องมี port + **dev adapter** (log หรือ Mailpit ใน compose)

### 3.6 🟠 Backup service + command — `laravel-starter` มี

`app/Services/BackupService.php` (165 บรรทัด) + artisan command
Go มี §15.5 Backup/Recovery เป็นเอกสาร แต่ไม่มีโค้ด → ควรมีอย่างน้อย
`cmd/backup` ที่ dump + verify restore ได้ (Milestone 4)

### 3.7 🟡 Legal pages + landing

`laravel-starter/routes/web.php` มี `/privacy-policy`, `/terms-of-service`,
`/refund-policy` + `/` landing

Go `site` มี Home แต่ไม่มี legal pages ทั้งที่ทุกโปรเจกต์จริงต้องใช้ →
เพิ่มเป็น CMS page ตัวอย่างใน seed data (แก้ปัญหา §3.1 ไปพร้อมกัน)

### 3.8 🟡 API key authentication

`next-js-starter/src/lib/api-key.ts` + model `ApiKey`
Go มี `api_keys` เป็น optional module (M4) แล้ว → **มีในแผนแล้ว ไม่ต้องเพิ่ม**

### 3.9 🟡 สิ่งที่ next มีแล้ว Go มีในแผนอยู่แล้ว (ไม่ต้องทำอะไร)

`idempotency.ts` · `rate-limit.ts` · `logger.ts` · `openapi.ts` · `transaction.ts` ·
`totp.ts` · `queue.ts` · `storage.ts` · `sanitize.ts` · `sso.ts` · `feature-gate.ts` —
ทั้งหมดตรงกับ design ของ Go ที่มีอยู่แล้ว

### 3.10 ❌ สิ่งที่ **ไม่ควร** เอามา

- `role-hierarchy.ts` (next) — role สืบทอดกันทำให้ effective permission คำนวณยาก
  ขัดกับ default-deny + union ที่ Go เลือกไว้
- `UserPermission` direct grant (next) — ดู §2.2
- Wildcard permission (next) — ดู §2.1
- Entitlement/quota/trial (laravel-saas) — Go ประกาศเป็น non-goal ไว้แล้ว ถูกต้อง

---

## 4. ต้องหลีกเลี่ยง — ความผิดพลาดที่พบในของจริง

### 4.1 🔴 next-js: tenant isolation ถูก comment ทิ้ง = fail-open

`src/lib/prisma.ts` — auto tenant filter ถูกครอบด้วย `/* */` ทั้งบล็อก พร้อมคอมเมนต์
ว่าเสี่ยงพังใน Next.js 15 และ audit logging ก็ถูกปิดด้วย
(`AUDIT LOGGING (Temporarily disabled for debugging)`)

ผลคือ **ทุก query ต้องจำส่ง `tenantId` เอง** — เห็นได้จาก `modules/user/service.ts`
ที่ส่ง `tenantId` ผ่านเป็น parameter ทุกฟังก์ชัน ลืมที่เดียว = ข้อมูลข้าม tenant รั่ว
และไม่มี test ที่จับได้

เทียบกับ `laravel-starter-saas/app/Traits/BelongsToTenant.php` ที่ใช้ global scope
+ auto-set ตอน create = **fail-safe by default** ลืมไม่ได้เพราะไม่ต้องจำ

> **บทเรียนสำหรับ Go (สำคัญที่สุดในเอกสารนี้):**
> `design.md` เขียนว่า *"API ตรวจ account, ownership และ scope ทุก request"* — นั่นคือ
> **กฎ** ไม่ใช่ **กลไก** กฎที่ต้องอาศัยวินัยของคนเขียนจะถูกลืมเสมอ
> Go ต้องมีกลไกที่ลืมไม่ได้: account scope ผูกที่ repository layer หรือ
> GORM scope ที่บังคับ `account_id` และมี architecture test ที่ fail เมื่อมี query
> ที่ไม่ผ่าน scope นั้น

### 4.2 🔴 laravel-saas: schema สะสมหนี้จาก migration แบบปะ

จาก 39 migrations มี 15+ ตัวเป็นการปะทีหลัง ตาราง `plans` ถูกแก้ **4 ครั้งแยกกัน**:

```text
add_duration_months_to_plans_table
add_discount_fields_to_plans_table
add_price_to_plans_table
add_is_recommended_to_plans_table
```

`tenants` ถูกแก้ 4 ครั้ง (`add_subscription_fields`, `add_is_grace_period`,
`add_grace_period_expires_at`, ...) และมี
`change_subscriptions_status_to_string` = เปลี่ยน type ทีหลัง

สาเหตุ: ออกแบบ schema ก่อนเข้าใจ behavior จริง

> **บทเรียนสำหรับ Go:** ตอนนี้ Go กำลังทำ **18 migrations ให้เสร็จก่อนเขียน domain code
> สักบรรทัด** (`internal/modules/*/` มีแค่ `migrations/`) และ migration เป็น
> additive-only ห้าม down ใน production → ความเสี่ยงเดียวกันเป๊ะ แต่แก้ยากกว่า
> เพราะคูณ 3 dialect
>
> ทางลด: ทำ vertical slice บาง ๆ (users → sessions → login → หน้า Login) ให้ผ่านก่อน
> แล้วค่อยทำ 13 ตารางที่เหลือ

### 4.3 🟠 God module เกิดจริง — แต่ต้องวัดด้วยความรับผิดชอบ ไม่ใช่บรรทัด

รอบแรกผู้เขียนคัดด้วยจำนวนบรรทัดอย่างเดียว ซึ่ง **ผิด 2 ใน 8** เมื่อตรวจเนื้อในจริง
ตารางนี้คือผลหลังวัด state count, จำนวน endpoint ที่เรียก และจำนวน bounded context

| ไฟล์ | บรรทัด | สัญญาณที่วัดได้ | ผล |
|---|---|---|---|
| `next: admin/translations/page.tsx` | 855 | 22 `useState`, 7 endpoints, 4 เรื่อง (translation CRUD / i18n settings / สร้าง-ลบภาษา / auto-translate) | ✅ god |
| `next: modules/i18n/service.ts` | 675 | 21 public methods ใน object เดียว + เขียนไฟล์ static (`ensureLocaleMessageFile`) | ✅ god |
| `next: modules/auth/service.ts` | 657 | 14 functions ครอบ 6 bounded context: email verification, MFA, login/token, register, password reset, permission loading | ✅ god |
| `laravel-saas: Models/Tenant.php` | 261 | 23 methods = 8 relationships + 15 business methods (subscription expiry, plan limit, entitlement, settings KV) | ✅ fat model |
| `next: settings/page.tsx` | 620 | 11 `useState`, 6 endpoints, 3 เรื่อง | 🟡 borderline |
| `next: components/table/DataTable.tsx` | 403 | 1 export, 1 responsibility | ❌ **ไม่ใช่** — generic table ซับซ้อนตามธรรมชาติ |
| `laravel-saas: StripeWebhookController.php` | 389 | 11 methods, 6 เป็น `handleXxx` dispatcher ตาม event type | ❌ **ไม่ใช่** — cohesive dispatcher (เกินกฎ 7 actions แต่ไม่ใช่ god) |

`next-js-starter/ROADMAP.md` v0.6.0 ยอมรับเองว่า
*"Split security settings into `/settings/security` if the settings page continues to grow"*
= รู้ว่าโตเกินแล้วแต่เลื่อนไป 4 เวอร์ชัน

`laravel-starter` สะอาดที่สุด (สูงสุด 186) เพราะถูก **ตัดออกโดยตั้งใจ** ไม่ใช่เพราะ
โตมาแล้วดี

#### บทเรียนสำหรับ structural check ของ Go

การนับบรรทัดพลาดได้ **ทั้งสองทิศ** และทิศที่อันตรายกว่าคือ false negative:
component 190 บรรทัดที่มี 20 reactive state และยิง 5 endpoints จะผ่านเพดาน 200 สบาย ๆ
ทั้งที่เป็น god module เต็มตัว

Go มี 2 สัญญาณฝั่ง backend แล้ว (500 บรรทัด **หรือ** 15 public methods) แต่ฝั่ง
frontend มีสัญญาณเดียวคือ 200 บรรทัด → **ไม่พอ**

เพิ่มเข้า CI structural check:

| สัญญาณ | เพดานที่เสนอ | สถานะใน Go |
|---|---|---|
| reactive state ต่อ component (`ref`/`reactive`) | ~8 | ยังไม่มี |
| API endpoint ที่ component เดียวเรียก | ~3 | ยังไม่มี |
| public methods ต่อ service/class | 15 | มีแล้ว |
| บรรทัด | 500 / 200 | มีแล้ว |

สองสัญญาณบนจับ `translations/page.tsx` ได้ตั้งแต่ยังสั้น และไม่จับ `DataTable` ผิดตัว

หน้าที่มีหลักฐานว่าโตเกินในทุก predecessor และต้องกันไว้ก่อน: **Translation editor**,
**Settings/Security**, **Auth service**

### 4.4 🟠 next: authorize() ยิง DB ทุก request

`src/lib/authorize.ts` ทำ `prisma.user.findUnique` พร้อม nested include 3 ชั้น
(`roles → role → permissions → permission`) **ทุก request** ไม่มี cache

Go มี permission cache + version + invalidation อยู่แล้ว (Q11) → คงไว้ และให้
`/dev/permissions` (§3.4) แสดง cache version ด้วยเพื่อ debug

### 4.5 🟠 Onboarding ที่พังโดยไม่มีใครรู้

`next-js-starter/ROADMAP.md` v0.3.0 ตั้ง exit criteria ว่า
*"Fresh setup succeeds from README commands"* — แปลว่า **ตอนนี้ยังไม่สำเร็จ**
สาเหตุคือ Prisma migration baseline กับ dev database ที่สร้างก่อนมี migration history

และ README บอก `admin@acme.com` แต่ ROADMAP บอก seed คือ `owner@starter.dev`

> **บทเรียน:** onboarding ต้องเป็น **CI job** ที่ clone สะอาดแล้วรันจนถึง login สำเร็จ
> ไม่ใช่เอกสาร ถ้าไม่มี test มันจะพังเงียบ ๆ ทุกครั้ง

### 4.6 🟡 RULES.md ถูก copy ข้าม 3 repo (30.5K เท่ากันเป๊ะ)

ทั้งสาม repo มี `RULES.md` ขนาด 30.5K เหมือนกัน + `AGENTS.md` คนละเวอร์ชัน
→ drift แน่นอนเมื่อแก้ที่เดียว

Go ใช้ parent + submodule อยู่แล้ว → เก็บ rules ที่ parent ที่เดียว child อ้างอิงเอา

### 4.7 🟡 ไฟล์ขยะติดมาใน repo

`laravel-starter` มี `.env.exam` (2.2K) อยู่ข้าง `.env.example` (2.6K) และ **ถูก track
ใน git** (`git ls-files` เห็นทั้งสองไฟล์ เข้ามาตั้งแต่ `first commit`) น่าจะเป็นไฟล์ที่
พิมพ์ชื่อผิดแล้วลืมลบ

`next-js-starter` commit `playwright-report/`, `test-results/`, `.swc/` และมีไฟล์
`.env.production` (3.0K) อยู่ใน working directory

**ผลตรวจ secret — ไม่มีรั่ว:**

| ไฟล์ | tracked? | ผล |
|---|---|---|
| `next-js-starter/.env.production` | ❌ ไม่ถูก track (`.gitignore` มี `.env*` + `!.env.example`) | ปลอดภัย เป็น local-only |
| `laravel-starter/.env.exam` | ✅ ถูก track | `REDIS_PASSWORD`, `MAIL_PASSWORD`, `ADMIN_PASSWORD` มีค่าไม่ว่าง แต่ **ตรงกับ `.env.example` ทุกตัว = placeholder** ไม่ใช่ค่าจริง |

→ ไม่ต้อง rotate อะไร แค่ลบ `.env.exam` ทิ้งเพราะซ้ำซ้อนและชวนสับสน

Go มี `gitleaks dir` ใน plan อยู่แล้ว → ต้องรันกับ parent + ทุก child จริง และควรมีกฎ
ห้าม track ไฟล์ `.env*` ยกเว้น `.env.example` ให้ชัดตั้งแต่แรก

---

## 5. Action list สำหรับ `go-lang-starter`

### ทำทันที (ก่อน Codex เขียน migration ต่อ)

| # | งาน | ที่มา |
|---|---|---|
| A1 | นิยาม **กลไก** บังคับ account scope ที่ repository layer + architecture test ที่ fail เมื่อ bypass | §4.1 |
| A2 | เพิ่ม `navigationItems` + `dashboardContributions` เข้า module manifest spec (MR1) | §3.3 |
| A3 | ตัดสินใจ soft/hard delete ของ `users` และ timezone policy | ค้างจากรีวิวก่อนหน้า |

### Milestone 1

| # | งาน | ที่มา |
|---|---|---|
| B1 | `dev up` one-command bootstrap + seed data + **CI job ที่รัน clone→login จริง** | §3.1, §4.5 |
| B2 | Email port + dev adapter (log/Mailpit) | §3.5 |
| B3 | Vertical slice (users→sessions→login→หน้า Login) ก่อนทำ 13 ตารางที่เหลือ | §4.2 |
| B4 | `gitleaks` กับ parent + ทุก child | §4.7 |

### Milestone 2

| # | งาน | ที่มา |
|---|---|---|
| C1 | Production Readiness service + หน้า Admin (critical/warning) | §3.2 |
| C2 | `/dev/permissions` matrix viewer (ปิดใน production build) | §3.4 |
| C3 | ระวังเป็นพิเศษ: Translation editor, Settings/Security, Auth service — จุดที่ predecessor พังทุกตัว | §4.3 |
| C4 | **เพิ่ม structural check ฝั่ง frontend**: นับ reactive state (~8) และจำนวน endpoint ต่อ component (~3) ไม่ใช่แค่บรรทัด | §4.3 |

### Milestone 4

| # | งาน | ที่มา |
|---|---|---|
| D1 | Backup command + restore verification | §3.6 |
| D2 | Legal pages เป็น CMS seed content | §3.7 |

---

## 6. สิ่งที่ต้องแก้ใน predecessor ทั้งสามตัว

รายการนี้แยกจาก §5 — เป็นงานที่ต้องทำใน repo เดิม ไม่เกี่ยวกับ Go แต่ควรทำเพราะ
ยังใช้งานอยู่และบางข้อเป็นความเสี่ยงด้านความปลอดภัยจริง

### 6.1 `next-js-starter` — เร่งด่วนที่สุด

| # | ระดับ | ปัญหา | หลักฐาน | สิ่งที่ต้องทำ |
|---|---|---|---|---|
| N1 | 🔴 Must fix | Tenant isolation ถูก comment ทิ้งทั้งบล็อก = fail-open ทุก query ต้องจำส่ง `tenantId` เอง | `src/lib/prisma.ts` (บล็อก `AUTO TENANT FILTER` อยู่ใน `/* */`) | เปิดใช้ Prisma extension ใหม่โดยรับ tenant จาก AsyncLocalStorage แทน `headers()` + เพิ่ม test ที่พิสูจน์ว่า query ข้าม tenant ถูกบล็อก |
| N2 | 🔴 Must fix | Audit logging ถูกปิด — คอมเมนต์ระบุ *"Temporarily disabled for debugging"* | `src/lib/prisma.ts` PART 3 | เปิดกลับ หรือย้ายไป explicit call ใน service layer แล้วลบโค้ดที่ comment ทิ้ง |
| N3 | 🔴 Must fix | Wildcard permission `*` และ `module.*` → permission ใหม่ถูก grant อัตโนมัติ, audit ไม่ได้ | `src/lib/permissions.ts`, `src/lib/authorize.ts` | ยกเลิก wildcard ใช้ explicit grant + migration แปลง `module.*` เป็นรายการจริง |
| N4 | 🟠 Should fix | Direct user grant (`UserPermission`) ทำให้ revoke role ไม่คืนสิทธิ์จริง | `prisma/schema.prisma:124` | เลิกใช้ ย้ายเป็น role-only หรือทำให้ direct grant เป็น deny-only |
| N5 | 🟠 Should fix | `authorize()` ยิง DB nested include 3 ชั้นทุก request ไม่มี cache | `src/lib/authorize.ts` | cache effective permissions ต่อ session พร้อม version + invalidate เมื่อ role/grant เปลี่ยน |
| N6 | 🟠 Should fix | God module 3 ไฟล์ | §4.3 | แยก `auth/service.ts` เป็น 6 ไฟล์ตาม bounded context · แยก `i18n/service.ts` เป็น locale registry / settings / translation / auto-translate · แยก `translations/page.tsx` ตาม 4 responsibility |
| N7 | 🟠 Should fix | Fresh setup ไม่สำเร็จจาก README (Prisma migration baseline) | `ROADMAP.md` v0.3.0 exit criteria | ทำ baseline flow + CI job ที่ clone สะอาดแล้วรันจน login ได้ |
| N8 | 🟡 Consider | README บอก `admin@acme.com` แต่ seed จริงคือ `owner@starter.dev` | `README.md` vs `ROADMAP.md` | แก้ให้ตรงกัน และให้ seeder เป็น single source of truth |
| N9 | 🟡 Consider | JWT revoke ทันทีไม่ได้ ขัดกับ session/device management ที่วางไว้ใน v0.6.0 | `src/lib/jwt.ts`, ROADMAP v0.6.0 | เพิ่ม refresh-token revocation list หรือย้ายเป็น server-side session |

> ตรวจแล้ว: `playwright-report/`, `test-results/`, `.swc/` **ไม่ได้ถูก track ใน git**
> และ `.env.production` ก็ไม่ถูก track — เป็น local artifact เท่านั้น ไม่ต้องแก้

### 6.2 `laravel-starter-saas`

| # | ระดับ | ปัญหา | หลักฐาน | สิ่งที่ต้องทำ |
|---|---|---|---|---|
| S1 | 🔴 Must fix | Global scope ปิดเงียบใน console/queue context (`resolveCurrentTenantId` คืน `null` เมื่อไม่มี auth) → job/command ทำงานข้ามทุก tenant โดยไม่มีคำเตือน | `app/Traits/BelongsToTenant.php` + `ProcessSubscriptionExpiry`, `DowngradeExpiredTenantToFree`, `AuditPublicAttachments` | บังคับให้ job ต้องประกาศ tenant context อย่างชัดเจน (`forTenant()` หรือ `withoutTenantScope()` แบบ explicit) และให้ default เป็น fail ไม่ใช่ unscoped |
| S2 | 🟠 Should fix | ไม่มี CI เลย | ไม่มี `.github/` | เพิ่ม workflow: `composer test`, `npm run build`, `route:list`, `composer validate --strict` |
| S3 | 🟠 Should fix | Migration สะสมหนี้ 39 ตัว — `plans` ถูกปะ 4 ครั้ง, `tenants` 4 ครั้ง, มี `change_subscriptions_status_to_string` | `database/migrations/` | squash เป็น baseline migration ชุดใหม่สำหรับ v2 ของ starter (ไม่ใช่แก้ของ deploy แล้ว) |
| S4 | 🟠 Should fix | `Tenant.php` 23 methods — business logic ปนใน model | `app/Models/Tenant.php` | ย้าย subscription expiry / plan limit / entitlement ไป service ที่มีอยู่แล้ว (`TenantEntitlementService`, `PlanLimitService`) เหลือ relationships + accessor |
| ~~S5~~ | ❌ ถอน | ~~`StripeWebhookController` เกินกฎ 7 actions~~ — นับผิด: มี **public action เดียว** (`handle`) ที่เหลือเป็น private helper ตรงกับ §4.3 ที่สรุปว่าไม่ใช่ god module | `app/Http/Controllers/Webhook/` | ไม่ต้องแก้ |
| S8 | 🟠 Should fix | `getDaysUntilExpiry()` กลับเครื่องหมายซ้ำ — Carbon 3 คืนค่ามีเครื่องหมายมาแล้ว แต่โค้ดยัง `-$days` ทับ ทำให้แพ็กเกจที่หมดอายุ 5 วันแสดงเป็น "เหลืออีก 5 วัน" ใน `layouts/app.blade.php:109` | ยืนยันด้วย `diffInDays(past)` คืน `-5` | `abs()` ก่อนแล้วค่อยใส่เครื่องหมาย |
| S6 | 🟡 Consider | `$resolvedTenantId` ประกาศไว้แต่ไม่ถูกใช้ = dead code และไม่มี cache จริง → `auth()->user()` ถูกเรียกทุก query | `app/Traits/BelongsToTenant.php:36` | ลบทิ้ง หรือทำให้ cache ทำงานจริงต่อ request |
| S7 | 🟡 Consider | `ModuleManifest` รับ `Tenant $tenant` ตรง ๆ → contract ผูกกับ concrete model | `app/Support/Modules/Contracts/ModuleManifest.php` | เปลี่ยนเป็น tenant ID หรือ interface |

### 6.3 `laravel-starter`

สะอาดที่สุดในสามตัว รายการจึงสั้น

| # | ระดับ | ปัญหา | หลักฐาน | สิ่งที่ต้องทำ |
|---|---|---|---|---|
| L1 | 🟡 Consider | `.env.exam` ถูก track ใน git ตั้งแต่ `first commit` เป็นไฟล์ชื่อพิมพ์ผิดซ้ำกับ `.env.example` | `git ls-files` | ลบทิ้ง (ตรวจแล้วค่าใน `REDIS_PASSWORD`/`MAIL_PASSWORD`/`ADMIN_PASSWORD` ตรงกับ `.env.example` = placeholder ไม่ต้อง rotate) |
| L2 | 🟡 Consider | Test surface บาง — 5 feature file สำหรับทั้ง starter ไม่มี auth flow test ครบ | `tests/Feature/` | เพิ่ม test สำหรับ login/logout/reset password/permission boundary |
| L3 | 🟡 Consider | Permission key แบน (`user.manage`) ไม่มี scope → แยก own/any ไม่ได้ | `README.md` Starter Permissions | ถ้าจะใช้ต่อระยะยาว ควรเพิ่ม scope suffix แบบเดียวกับ Go |
| L4 | 🟢 Nice to have | ไม่มี MFA (มีแต่เอกสารเทียบทางเลือก) | `docs/TWO_FACTOR_AUTH_OPTIONS.md` | port TOTP flow จาก `next-js-starter` ซึ่งทำครบแล้ว |
| L5 | 🟢 Nice to have | ไม่มี session/device management | — | เพิ่มหน้า Sessions + revoke |

### 6.4 ข้ามทั้งสาม repo

| # | ปัญหา | สิ่งที่ต้องทำ |
|---|---|---|
| X1 | `RULES.md` ขนาด 30.5K เหมือนกันเป๊ะทั้งสาม repo + `AGENTS.md` คนละเวอร์ชัน → drift แน่นอน | เก็บที่เดียวแล้วอ้างอิง หรือ sync ด้วย script ที่ตรวจ checksum |
| X2 | ไม่มี repo ไหนมีกฎห้าม track `.env*` ยกเว้น `.env.example` อย่างชัดเจนทั้งสามตัว (laravel-starter หลุด `.env.exam` มาแล้ว) | เพิ่มกฎใน `.gitignore` + `gitleaks` ใน CI |
| X3 | ไม่มี repo ไหนมี CI job ที่ทดสอบ onboarding จาก clone สะอาด | เพิ่ม job: clone → setup → migrate → seed → login สำเร็จ |

---

## 7. สรุปหนึ่งบรรทัด

Go ออกแบบ **authorization และ module contract** ดีกว่าทั้งสามตัวชัดเจน แต่ยังขาด
**สิ่งที่ทำให้ starter ใช้งานได้จริง** (seed, onboarding ที่ทดสอบแล้ว, email,
readiness check, dev tooling) และกำลังเดินซ้ำรอยความผิดพลาดข้อเดียวที่แพงที่สุดของ
`laravel-starter-saas` คือ **ออกแบบ schema จนครบก่อนพิสูจน์ behavior**
