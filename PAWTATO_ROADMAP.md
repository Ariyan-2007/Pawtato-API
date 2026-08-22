# Pawtato API — Production Roadmap & Progress Blueprint

This file is the **execution source of truth** for taking Pawtato from its current state to a production-grade platform. `PAWTATO_PROJECT_SPEC.md` is the *product* source of truth (what to build); this file is the *delivery* source of truth (in what order, what's done, what's left).

## How to use this file (read this first, every session)

- **Do not re-read the whole file every time.** Read `Current Status` below, then jump straight to the section for the active phase. Earlier completed phases are historical record — skip them unless debugging something they built.
- Each phase is self-contained: Goal, Tasks, Swagger Requirement, Definition of Done, Status.
- Tasks use checkboxes. Tick them as completed (`- [x]`). Do not delete tasks — if scope changes, strike through and note why.
- When a phase is finished, update `Current Status`, flip its row in the Phase Index, and append one line to `Progress Log`. Keep the log entry short (1–3 lines) — it's a changelog, not a report.
- **Swagger is not optional in any phase.** Every phase below ends with an explicit Swagger Requirement. A phase is not "done" if endpoints it touched aren't documented.
- If a phase's scope turns out too large for one session, stop at a clean sub-task boundary, tick what's done, and leave the rest unchecked — the next session picks up exactly there.

---

## Current Status

- **Active Phase:** Phase 2 — QR Tag Domain Correction (not started)
- **Phase 1 Status:** Complete
- **Last updated:** 2026-08-22

---

## 0. Baseline Audit (snapshot taken 2026-08-22)

Recorded once so future sessions don't need to re-derive it by re-reading the whole codebase.

### Stack (actual, not the spec's illustrative example)

- **Runtime/Framework:** NestJS 11 (TypeScript), Express platform
- **Database:** MongoDB via Mongoose (`@nestjs/mongoose`)
- **Auth:** JWT (`@nestjs/jwt`, `passport-jwt`), bcrypt password hashing, refresh token support present
- **Docs:** `@nestjs/swagger` already installed and partially wired
- **Other deps already present:** `helmet`, `class-validator`/`class-transformer`, `nest-winston` + `winston` (installed, not yet configured), `joi` (installed, **not wired**), `qrcode`, `nanoid`, `@nestjs-modules/mailer` + `nodemailer`, `@nestjs/schedule`, `@nestjs/serve-static`
- Note: the spec's `Pawtato.Api / Application / Domain / Infrastructure` (.NET-style) layout is illustrative only. The actual project uses NestJS's module-per-feature convention (`src/modules/<feature>`), which is an acceptable equivalent layering (Controller≈API, Service≈Application, Schema≈Domain, Mongoose model≈Infrastructure). The roadmap works within this convention rather than forcing a .NET folder structure onto it.

### Implemented modules (`src/modules/*`)

`auth`, `users`, `pets`, `public`, `qr`, `medical`, `vaccinations`, `notifications` (+ a vaccination-reminder cron job), `admin`, `activity` (admin audit log), `health`, `database`.

Working end-to-end today: register/login (JWT + refresh), pet CRUD with ownership scoping, mark pet lost (fields on `Pet`), a public pet-profile lookup by `publicId` that increments a scan counter, a public lost-pets list, QR PNG generation, medical records, vaccinations with reminder job, admin dashboard stats/user/pet management with role changes, an admin action audit log.

### Key gaps vs `PAWTATO_PROJECT_SPEC.md` (drives Phases 1–3)

1. **No independent QR Tag entity.** Spec §4 calls this out as an *"important architectural rule"*: a tag must exist independently of a pet, with its own lifecycle (Manufactured → Available → Assigned → Suspended/Retired) and a stable public code used for resolution. Today `qrCode`/`publicId` are just fields on the `Pet` schema and `QrService.generate()` is a stateless PNG generator with no `Tag` collection, no assign/unassign, no inventory. → **Phase 2**.
2. **No Found-Report / Finder flow.** Spec §6 and §26 (MVP "must have") require a finder to submit a report without an account. No such endpoint or schema exists today; only a lost-status field lives on `Pet`. → **Phase 3**.
3. **No scan-event audit trail.** Spec §8 wants scan events as first-class records (for analytics/abuse detection). Today a scan only increments `Pet.scanCount`/`lastScannedAt` as a side effect of a GET request — no queryable history. → **Phase 3**.
4. **No rate limiting.** Spec §16/§17 explicitly requires rate limiting on public endpoints, assuming automated abuse. No `@nestjs/throttler` (or equivalent) is installed or configured anywhere. → **Phase 1**.
5. **No CORS configuration, no global exception filter, no global response interceptor actually wired.** `ResponseInterceptor` exists in `src/common/interceptors/` but is never registered (`app.useGlobalInterceptors` is never called in `main.ts`) — the standardized `{ success, message, data }` envelope is currently dead code, not the real API shape. → **Phase 1**.
6. **`Joi` is a dependency but unused.** `ConfigModule.forRoot` has no `validationSchema`, so a missing `.env` var (e.g. `JWT_SECRET`) fails silently/late instead of at boot. → **Phase 1**.
7. **Dead/duplicate files at `src/` root**, orphaned from before the module refactor, all 0 bytes and unreferenced: `pets.controller.ts`, `pets.module.ts`, `pets.service.ts`, `schemas/pet.schema.ts`, `dto/create-pet.dto.ts`, `dto/update-pet.dto.ts`. → **Phase 1 cleanup**.
8. **`main.ts` has a duplicated `ValidationPipe` registration** (registered twice back-to-back) and a hardcoded `http://localhost:5000` URL baked into `qr.service.ts`'s generated QR payload, which will point to the wrong host in any non-local environment. → **Phase 1**.
9. **No Dockerfile for the app itself** (only `docker-compose.yml` for a local MongoDB container), **no CI pipeline** (`.github/` is empty). → **Phase 1**.
10. **Notifications are email-only**, not abstracted behind a channel interface as spec §14 recommends for future Push/SMS. → **Phase 4**.
11. **File storage is local disk** (`/uploads`, served via `ServeStaticModule`), not behind a storage-provider abstraction as spec §18 recommends. → **Phase 5**.
12. **Swagger is partially applied** — some controllers use `@ApiTags`/`@ApiOperation` (e.g. `public.controller.ts`), coverage across all controllers/DTOs/response shapes/error responses is inconsistent. → **Phase 1 sets the standard; every later phase maintains it.**

---

## Phase Index

| # | Phase | Status |
|---|-------|--------|
| 1 | Production Readiness Revamp | **Complete** (2026-08-22) |
| 2 | QR Tag Domain Correction | Not started |
| 3 | Lost & Found Flow Completion | Not started |
| 4 | Notifications & Domain Events | Not started |
| 5 | Media & Storage Abstraction | Not started |
| 6 | Testing & Quality Gate | Not started |
| 7 | Admin, Audit & Abuse Handling | Not started |
| 8 | Performance & Observability | Not started |
| 9 | Post-MVP Backlog (unscheduled) | Reference only |

---

## Phase 1 — Production Readiness Revamp

**Goal:** Make the *existing* feature set safe, correct, and deployable, before adding any new domain features. Nothing here changes product behavior — it removes footguns, dead code, and missing operational plumbing.

### 1.1 Cleanup
- [x] Deleted the dead root-level files (confirmed zero references first): `src/pets.controller.ts`, `src/pets.module.ts`, `src/pets.service.ts`, `src/schemas/pet.schema.ts`, `src/dto/create-pet.dto.ts`, `src/dto/update-pet.dto.ts`.
- [x] Also deleted two more dead files found during the Swagger pass: `medical/dto/update-medical-record.dto.ts` and `vaccinations/dto/update-vaccination.dto.ts` — both unreferenced (no update endpoints exist for those resources).
- [x] Also deleted `UsersService.updateRefreshToken()` — dead method, called from nowhere, referencing a `refreshToken` field that doesn't even exist on the `User` schema (a broken, abandoned attempt at refresh-token support).
- [x] Fixed `src/main.ts`: removed the duplicated `ValidationPipe` registration.
- [x] Ran `npm run lint -- --fix` and `npm run format` across the repo; fixed every remaining lint error by hand (see 1.3 note on pre-existing `any`-typed Mongoose filters). `npm run lint` and `npm run build` both exit clean.

### 1.2 Config & Secrets
- [x] Added a Joi `validationSchema` (`src/config/env.validation.ts`) to `ConfigModule.forRoot` in `app.module.ts`, covering `NODE_ENV`, `PORT`, `API_PREFIX`, `APP_URL`, `CORS_ORIGINS`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES`, `REFRESH_SECRET`, `REFRESH_EXPIRES`, and (optional) `MAIL_*`. Boot now fails fast with a clear error if required vars are missing.
- [x] Added `app.url` and `app.corsOrigins` to `configuration.ts`; replaced the hardcoded `http://localhost:5000` in `qr.service.ts` with `ConfigService`-driven `app.url`.
- [x] Also found and fixed: `auth.module.ts`'s `JwtModule.register(...)` and `jwt.strategy.ts` both had their own hardcoded `'development_secret'` fallback instead of using config — both now use `ConfigService.getOrThrow(...)`, so a missing `JWT_SECRET` fails at boot instead of silently signing tokens with a well-known default in prod.
- [x] Also found and fixed: `notifications.module.ts`'s `MailerModule.forRoot(...)` read `MAIL_*` straight from `process.env`, bypassing the config/validation layer entirely. Moved to `MailerModule.forRootAsync` + `ConfigService`, added a `mail` namespace to `configuration.ts`.
- [x] Expanded `.env.example` to document every variable actually read by the app, with comments and sane defaults.

### 1.3 Cross-Cutting API Behavior
- [x] Wired `ResponseInterceptor` globally in `main.ts`; also gave it a proper generic type (it was typed as `any` before).
- [x] Added a global exception filter (`src/common/filters/http-exception.filter.ts`) producing a consistent `{ success: false, statusCode, message, error, path, timestamp }` shape; 5xx errors are logged server-side, stack traces are never sent to the client.
- [x] Added `app.enableCors(...)`, origin list driven by `CORS_ORIGINS` env var (empty list = CORS off, never a wildcard).
- [x] Installed `@nestjs/throttler`; global default limit (100 req/min) via `APP_GUARD`, with a stricter named `public` limit (20 req/min) applied to both `public.controller.ts` routes via `@Throttle`.
- [x] Hardened `RolesGuard` to return `false` (not crash) when no `user` is on the request, and to use the `ROLES_KEY` constant instead of a duplicated magic string.
- [x] **Found and fixed a real authorization bug**: `ActivityController` (`GET /api/activity`, the admin audit log) had `@ApiBearerAuth` but no `@UseGuards`/`@Roles` — it was completely unprotected. Added `JwtAuthGuard, RolesGuard` + `@Roles(UserRole.ADMIN)`, matching `AdminController`'s pattern.
- [x] **Found and fixed a routing bug**: in `pets.controller.ts`, `@Get('statistics')` was declared after `@Get(':id')`, so `GET /api/pets/statistics` was being swallowed by the `:id` handler (`petId = 'statistics'`) and never reached `getStatistics`. Reordered so the static route is registered first.
- [x] Note for Phase 3: `RefreshTokenDto` and `REFRESH_SECRET`/`REFRESH_EXPIRES` exist but no `/auth/refresh` endpoint or refresh-issuing logic exists anywhere — the refresh flow was scaffolded but never implemented. Left as-is for Phase 1 (implementing it is new product behavior, out of this phase's stated scope) — flagged here so it isn't mistaken for "already working."

### 1.4 Logging & Observability Baseline
- [x] Wired `nest-winston` as the app logger in `main.ts` (`src/config/logger.config.ts`) — structured JSON in production, pretty console in development.
- [x] Added a redaction formatter that masks `password`, `newPassword`, `currentPassword`, `accessToken`, `refreshToken`, `token`, `authorization`, `secret` keys in any logged object.
- [x] **Found and fixed a real bug while auditing logging**: `jwt.strategy.ts` had `console.log('✅ JWT Payload:', payload)` on every single authenticated request, printing every user's JWT payload to stdout. Removed (along with a matching `console.log('✅ JwtStrategy initialized')`).

### 1.5 Infra & CI
- [x] Added a multi-stage `Dockerfile` (build → slim `node:22-alpine` runtime, non-root user) and `.dockerignore`.
- [x] Extended `docker-compose.yml` with an `api` service behind a `full` profile, so `docker-compose up` still starts MongoDB-only by default (unchanged behavior) and `docker-compose --profile full up` runs both.
- [x] Added `.github/workflows/ci.yml`: install → lint → build → test on push/PR to `main` and `Ariyan-Dev`.
- [x] **Found and fixed a real production bug while wiring CI**: the app could not boot at all outside of `ts-node`/dev mode. `@nestjs/mongoose`'s stricter type-reflection in the installed version throws `CannotDetermineTypeError` for any `@Prop()` whose TS type it can't unambiguously map to a Mongoose type. Two schema fields hit this: `Activity.metadata: Record<string, any>` (no `type` given) and `User.role: UserRole` (a TS enum, no `type` given). Verified by actually building and running `dist/main.js`, which crashed immediately on `Activity` before this fix. Fixed both by adding explicit `type: MongooseSchema.Types.Mixed` / `type: String` to their `@Prop()` options — confirmed via a second boot attempt that module loading now completes past that point. (Full live-DB boot end-to-end wasn't verifiable in this sandbox — no Docker/local MongoDB available here — so verify once against a real MongoDB before shipping.)
- [x] **Found and fixed a second production bug in the same audit**: `VaccinationReminderJob`'s cron was set to `*/15 * * * * *` (every 15 seconds) with a comment "Change to `@Cron('0 9 * * *')` when finished testing" — a debug setting left in place. It also emailed every reminder to a hardcoded `demo@pawtato.com` instead of the pet's actual owner. Fixed the schedule to daily 09:00, and now resolves the real owner email via `pet.owner` population (skips with a logged warning if no owner email is found).
- [x] **Test suite was almost entirely non-functional at baseline** (17 of 20 suites failing) for reasons unrelated to product code: (a) Jest's default transform doesn't handle the ESM-only `nanoid` package — fixed via a `transformIgnorePatterns` override; (b) every single scaffolded `*.spec.ts` file was a `nest generate` stub providing zero mocked constructor dependencies, so DI resolution failed on nearly every service/controller test. Fixed all 17 by adding proper mock providers (`useValue: {}` / `getModelToken(...)` for Mongoose models). `npm test` now passes 20/20. Note: these are still shallow "should be defined" tests with no real assertions — deepening them into genuine business-rule tests is Phase 6's job, not redone here.

### 1.6 Swagger Baseline (see also the mandate below)
- [x] Added `@ApiTags`, `@ApiOperation`, `@ApiResponse` (success **and** relevant error cases) to every controller method across every module (`auth`, `pets`, `users`, `admin`, `medical`, `vaccinations`, `activity`, `health`, `public`, `notifications`).
- [x] Added `@ApiProperty`/`@ApiPropertyOptional` with examples to every request DTO that lacked them (register/login, pets, report-lost, update-profile, medical record, vaccination, admin query/change-role DTOs), plus `@ApiProperty` on the two admin dashboard/analytics response DTOs, now referenced via `@ApiResponse({ type: ... })`.
- [x] Confirmed `@ApiBearerAuth('JWT-auth')` is present on every controller/route that requires authentication (and explicitly *absent*, with a note in the operation description, on the public routes that don't).
- [ ] "Confirm `/api/docs` renders cleanly end-to-end" — **not fully verified**: this sandbox has no Docker/local MongoDB, and the app's `MongooseModule.forRootAsync` blocks `NestFactory.create()` until a DB connection succeeds, so a live boot-and-check-Swagger-UI pass wasn't possible here. `npm run build` compiles all decorators/DTOs without error, which is a strong signal, but do one live check against a real MongoDB before considering this fully closed.

### Swagger Requirement (applies to every phase, restated here in full — later phases just reference this line)
> Every endpoint added or modified in this phase **must** carry accurate `@ApiTags`/`@ApiOperation`/`@ApiResponse` decorators and fully-annotated DTOs before the phase is marked done. A phase that changes the API surface without updating `/api/docs` accordingly is incomplete.

### Definition of Done
- [x] App boots and fails loudly on missing/invalid env config (Joi validation, no more silent hardcoded-secret fallbacks).
- [x] `/api/docs` decorator coverage is complete; live-UI render **not** verified in this sandbox (no MongoDB available) — verify once against a real DB before shipping.
- [x] No dead files, no duplicated pipe registration, no hardcoded localhost URLs.
- [x] CI runs lint + build + test on every push, and all three currently pass clean (0 lint errors, 0 build errors, 20/20 test suites).
- [x] Public endpoints are rate-limited; CORS is explicit; errors return a consistent shape.

### Status
**Complete** (2026-08-22). Scope grew beyond the original checklist because auditing surfaced several real, pre-existing production-blocking bugs (see findings above) that fell squarely under "make the existing feature set safe, correct, deployable" — most notably: the app could not boot outside dev mode at all (Mongoose schema typing crash), a cron job spammed every 15s to a hardcoded fake email address, JWT signing silently fell back to a well-known default secret, the admin audit log endpoint had no auth guard, and the test suite was 85% non-functional. All fixed and verified via lint + build + full test run. One item carried forward: live Swagger UI / full DB-connected boot could not be verified in this sandbox — do that once against a real MongoDB before considering Phase 1 fully closed in practice.

---

## Phase 2 — QR Tag Domain Correction

**Goal:** Bring the QR system in line with spec §4/§9 — a `Tag` independent from `Pet`, with an explicit lifecycle and assignment history, resolved via a stable public code (not an internal ID).

### Tasks
- [ ] Create a `Tag` schema/module: `publicCode` (unique, indexed), `serialNumber` (unique), `status` enum (`Manufactured | Available | Assigned | Suspended | Retired`), `assignedPetId` (nullable ref), `createdAt`, `assignedAt`, `unassignedAt`.
- [ ] Add tag endpoints: list/create (admin-seeded inventory), `assign` (owner assigns an available tag to their own pet — validate ownership + tag assignability), `unassign`, `suspend`/`retire` (admin).
- [ ] Enforce "at most one active assignment per tag" and "at most one active tag per pet" (or explicitly support multiple tags per pet if desired — decide and document the assumption per spec §28 rule 20).
- [ ] Update `QrService` to encode `https://<APP_URL>/t/{publicCode}` instead of an internal pet `publicId`; keep image generation logic, but make it resolve through the `Tag`, not directly through `Pet`.
- [ ] Update the public lookup route to resolve `Tag.publicCode → Pet`, not `Pet.publicId` directly (keep `Pet.publicId` internal, or deprecate it in favor of the tag). Do not expose the pet's internal Mongo `_id` anywhere in this path.
- [ ] Migrate/backfill: for pets that already have a `qrCode`, create a corresponding `Tag` document so existing QR images keep working (or document why a clean break is acceptable for pre-launch data).
- [ ] Add indexes: `Tag.publicCode`, `Tag.serialNumber`, `Tag.assignedPetId`.

### Swagger Requirement
Apply the Phase 1 Swagger Requirement to every new `tags` endpoint and to the updated `public` routes, including the new `Tag` DTOs and status enum in the schema docs.

### Definition of Done
- Tags exist as first-class records with a real lifecycle, assignable/unassignable independent of pet deletion.
- QR codes resolve via `publicCode`, never an internal ID.
- Ownership and assignability are validated server-side on every tag mutation.

### Status
Not started.

---

## Phase 3 — Lost & Found Flow Completion

**Goal:** Complete the core "find a lost pet" loop from spec §6–§8: finder reports, scan history, and owner-facing visibility into both — without requiring the finder to register.

### Tasks
- [ ] Add a `ScanEvent` schema (`tagId`, `petId` at scan time, `timestamp`, coarse location if provided, user-agent) and record one on every public scan, replacing the current `Pet.scanCount` side-effect-on-GET approach (keep the counter as a derived/cached value if useful, but the event log is the source of truth).
- [ ] Add a `FoundReport` schema (`tagId`/`petId`, message, approximate location, optional contact info, optional photo, `foundAt`, `createdAt`) and a public `POST /public/tags/{publicCode}/found-report` endpoint requiring no account.
- [ ] Add owner-facing endpoints to list found reports and scan history for their own pets (ownership-scoped).
- [ ] Wire "pet marked lost" / "found report submitted" to trigger a notification to the owner (can be a direct call to `NotificationsService` in this phase; Phase 4 abstracts it further).
- [ ] Add abuse protections on the public found-report endpoint specifically (throttling from Phase 1, plus basic payload size/content limits for the optional photo).
- [ ] Confirm the public pet profile response still excludes anything on the "must not expose" list in spec §5/§16 (owner phone unless opted in, addresses, medical notes, internal IDs).

### Swagger Requirement
Document `ScanEvent` and `FoundReport` DTOs fully; document the public found-report endpoint's lack of auth requirement explicitly (`@ApiOperation({ summary: '...', description: 'No authentication required.' })`) so API consumers don't assume it needs a token.

### Definition of Done
- A finder can scan → view profile → submit a found report, with zero account creation, and the owner can see it.
- Every scan produces a queryable event; every report produces a queryable record.
- Public write endpoints are rate-limited and validated.

### Status
Not started.

---

## Phase 4 — Notifications & Domain Events

**Goal:** Stop calling `NotificationsService.sendEmail(...)` directly from business logic scattered across modules; introduce a thin domain-event layer so new channels (push/SMS) and new triggers can be added without touching unrelated modules (spec §14, §25).

### Tasks
- [ ] Introduce an internal event bus (Nest's `EventEmitter2` via `@nestjs/event-emitter`, or a simple typed pub/sub) and emit events: `PetMarkedLost`, `PetMarkedFound`, `TagAssigned`, `TagUnassigned`, `QrTagScanned`, `FoundReportCreated`.
- [ ] Move the vaccination-reminder job and any lost/found email triggers to listen on these events rather than being called imperatively from service methods.
- [ ] Define a `NotificationChannel` interface (`send(userId, type, payload)`) with an `EmailChannel` implementation; keep the door open for `PushChannel`/`SmsChannel` later without changing call sites.
- [ ] Persist an in-app `Notification` record per triggered event (so a future "Notifications" dashboard panel per spec §23 has data to show), separate from whether an email actually sent.

### Swagger Requirement
Document any new `GET /notifications` (list own notifications) / mark-read endpoints with full DTOs and auth requirements.

### Definition of Done
- No module directly imports `MailerService`/`NotificationsService.sendEmail` for business triggers — everything goes through the event layer.
- Adding a new channel or a new trigger doesn't require editing unrelated modules.

### Status
Not started.

---

## Phase 5 — Media & Storage Abstraction

**Goal:** Decouple pet photos and QR images from local disk so the app can run in a stateless/horizontally-scaled deployment (spec §18).

### Tasks
- [ ] Define a `StorageProvider` interface (`upload`, `getUrl`, `delete`) and a `LocalDiskStorageProvider` implementing current behavior.
- [ ] Add an S3-compatible provider (works for AWS S3, DigitalOcean Spaces, Cloudflare R2, MinIO) selected via config, with `LocalDiskStorageProvider` remaining the dev-mode default.
- [ ] Route pet photo uploads and generated QR images through the storage abstraction instead of `fs`/`ServeStaticModule` directly.
- [ ] Add basic upload validation already implied by spec §16 (file type allow-list, size limit) if not already enforced by the existing `multer` config — verify and tighten.

### Swagger Requirement
Document upload endpoints' `multipart/form-data` request shape and file constraints (`@ApiConsumes('multipart/form-data')`, `@ApiBody` with schema).

### Definition of Done
- Switching storage provider is a config change, not a code change.
- Local dev still works with zero external dependencies.

### Status
Not started.

---

## Phase 6 — Testing & Quality Gate

**Goal:** Every module currently has a `.spec.ts` file, but coverage depth for spec-critical *business rules* (ownership, tag uniqueness, lost/found transitions, public-data exposure limits) needs a deliberate pass, per spec §26 ("unit tests for core business rules") and §28 rule 13.

### Tasks
- [ ] Audit existing `*.spec.ts` files for real assertions vs. scaffolded boilerplate; fill gaps.
- [ ] Add targeted tests for: pet ownership enforcement (user A cannot touch user B's pet/tag by ID), tag assignment uniqueness, lost→found status transitions, public profile field exposure (assert forbidden fields are absent), rate-limit behavior on public endpoints.
- [ ] Add e2e tests (`test/`) covering the full spec §27/§30 end-to-end scenario: register → create pet → assign tag → public scan → found report → owner notified → mark found.
- [ ] Wire `test:cov` into CI (from Phase 1) with a minimum coverage threshold on `src/modules/**` business logic (services), not necessarily on DTOs/schemas.

### Swagger Requirement
No new endpoints expected in this phase; if any test gap reveals a missing/incorrect documented behavior, fix the Swagger annotation alongside the test.

### Definition of Done
- The full spec §30 "Definition of Success" flow is covered by an automated e2e test and passes in CI.
- Ownership/authorization bypass attempts are explicitly tested and fail as expected.

### Status
Not started.

---

## Phase 7 — Admin, Audit & Abuse Handling

**Goal:** Extend the existing admin/activity foundation to match spec §24: tag inventory management, abuse-report handling, and audit coverage beyond admin-only actions.

### Tasks
- [ ] Add admin tag-inventory endpoints: bulk-create tags (manufacturing batch), search/filter by status, force-suspend/retire.
- [ ] Add an abuse/report-handling surface for finder reports flagged as spam or malicious (ties into `FoundReport` from Phase 3).
- [ ] Extend `ActivityService.log(...)` calls to cover sensitive non-admin actions too where useful for audit (e.g. tag assignment/unassignment, lost-status changes) per spec §16 "audit logging for sensitive operations" — decide scope deliberately, don't log everything.

### Swagger Requirement
Full documentation for new admin endpoints, marked clearly as requiring the admin role (`@ApiBearerAuth` + a note on required role in the operation description).

### Definition of Done
- Admins can manage the full tag lifecycle without direct DB access.
- Sensitive non-admin actions are auditable.

### Status
Not started.

---

## Phase 8 — Performance & Observability

**Goal:** Prepare for real traffic: verify indexes, add health/metrics visibility beyond the existing basic health check, and confirm the public scan path performs under load.

### Tasks
- [ ] Audit and confirm all indexes from spec §20 exist: `User.email` (already unique-indexed), `Pet.ownerId`, `Tag.publicCode`, `Tag.serialNumber`, `Tag.assignedPetId`, `ScanEvent.tagId`, `ScanEvent.createdAt`, lost-status query path.
- [ ] Expand `health` module to report DB connectivity and key dependency status (mail provider, storage provider), not just app-up.
- [ ] Basic load-test the public scan/profile endpoint path (the highest-traffic, no-auth surface) and confirm rate limiting/behavior under burst load.
- [ ] Review Mongo query patterns introduced in earlier phases for N+1-style `.populate()` chains under load (the `activity.findAll()` pattern is a starting point to check).

### Swagger Requirement
Document the expanded `/health` response shape.

### Definition of Done
- Every query path used by a public or high-frequency endpoint is backed by an index.
- Health check reflects real dependency status, not just process liveness.

### Status
Not started.

---

## Phase 9 — Post-MVP Backlog (unscheduled, reference only)

Not phased yet — pull items from here into a new numbered phase when the team is ready, rather than inventing new scope ad hoc. Straight from spec §15/§26 "Future":

- Multiple authorized caretakers / shared pet access
- Push notifications, SMS channel implementations (slots into the Phase 4 channel interface)
- Expanded medical records beyond the current `medical`/`vaccinations` modules (documents, certificates)
- Nearby lost-pet discovery / community features (shelters, vets, pet-friendly businesses)
- QR tag ordering/commerce flow
- Mobile apps

---

## Progress Log

- **2026-08-22** — Roadmap created after a full baseline audit of the existing NestJS codebase against `PAWTATO_PROJECT_SPEC.md`. No phases started yet. Key gaps identified: no independent QR Tag entity, no found-report/scan-event tracking, missing production hardening (rate limiting, CORS, config validation, CI/Docker), dead legacy files, Swagger coverage incomplete.
- **2026-08-22** — Phase 1 (Production Readiness Revamp) completed. Cleaned up dead code, added Joi env validation, wired CORS/throttling/global exception filter/response interceptor, added structured logging with secret redaction, added Dockerfile + CI, and brought Swagger coverage to 100% of controllers/DTOs. Along the way, found and fixed several real pre-existing bugs beyond the original checklist: the app couldn't boot outside dev mode (Mongoose schema type-reflection crash on `Activity.metadata` and `User.role`), a cron job ran every 15s against a hardcoded fake email instead of daily against the real owner, JWT signing had a hardcoded fallback secret, the admin audit-log endpoint (`/api/activity`) had no auth guard at all, a routing bug shadowed `GET /pets/statistics` behind `GET /pets/:id`, and the test suite was 17/20 suites broken (fixed all — now 20/20 passing, lint and build both clean). Not verified in this sandbox (no Docker/MongoDB available): a full live boot + Swagger UI render against a real database — do this once before treating Phase 1 as fully closed in production. Also noted for later phases: the refresh-token flow (`RefreshTokenDto`, `REFRESH_SECRET`) is scaffolded but never implemented — belongs in Phase 3 or a dedicated auth-completion task, not silently assumed to work.
