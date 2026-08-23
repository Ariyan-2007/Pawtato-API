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

- **Active Phase:** Phase 5 — Media & Storage Abstraction (not started)
- **Phase 4 Status:** Complete
- **Last updated:** 2026-08-23

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

1. ~~**No independent QR Tag entity.**~~ **Fixed in Phase 2.** A first-class `Tag` model now exists with the full lifecycle, and `Pet.qrCode`/`Pet.publicId` have been removed in favor of it.
2. ~~**No Found-Report / Finder flow.**~~ **Fixed in Phase 3.** `POST /public/tags/:publicCode/found-report` now exists, no account required.
3. ~~**No scan-event audit trail.**~~ **Fixed in Phase 3.** A `ScanEvent` is now recorded on every public scan (`src/modules/scans/`), independent of `Pet.scanCount` (kept as a cheap derived counter).
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
| 2 | QR Tag Domain Correction | **Complete** (2026-08-22) |
| 3 | Lost & Found Flow Completion | **Complete** (2026-08-23) |
| 4 | Notifications & Domain Events | **Complete** (2026-08-23) |
| 5 | Media & Storage Abstraction | Not started |
| 6 | Testing & Quality Gate | Not started |
| 7 | Admin, Audit & Abuse Handling | Not started |
| 8 | Performance & Observability | Not started |
| 9 | Post-MVP Backlog (unscheduled) | Reference only |
| 10 | Pet Dating & Companion Matching | Not started |

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
- [x] Created a `Tag` schema/module (`src/modules/tags/`): `publicCode` (unique, indexed, server-generated via `nanoid`, never client-supplied), `serialNumber` (unique, indexed, client-optional/auto-generated), `status` enum `TagStatus` (`MANUFACTURED | AVAILABLE | ASSIGNED | SUSPENDED | RETIRED`, in `common/enums/tag-status.enum.ts`), `assignedPetId` (nullable ref to `Pet`), `qrImageUrl`, `createdAt`/`updatedAt` (via `timestamps: true`), `assignedAt`, `unassignedAt`.
- [x] Added tag endpoints on `TagsController` (`/tags`): `POST /tags` (admin, create — seeds directly as `AVAILABLE`; see assumption below), `GET /tags` (admin, paginated inventory with optional `status` filter), `GET /tags/mine` (authenticated, tags assigned to the caller's own pets), `GET /tags/:id` (admin), `POST /tags/assign` (authenticated, body `{ publicCode, petId }` — a real user only ever knows the code printed on the physical tag, never an internal Mongo ID, so assign/unassign are keyed on `publicCode` rather than `:id`), `POST /tags/unassign` (authenticated, body `{ publicCode }`, allowed for the owner of the currently-assigned pet or an admin), `PATCH /tags/:id/suspend` (admin), `PATCH /tags/:id/retire` (admin).
- [x] Enforced "at most one active tag per pet" two ways: an application-level check in `TagsService.assign()` (rejects with 400 if the pet already has an `ASSIGNED` tag), plus a DB-level partial unique index on `Tag.assignedPetId` (`partialFilterExpression: { assignedPetId: { $type: 'objectId' } }`) so the constraint holds even under concurrent requests, while still allowing unlimited unassigned (`null`) tags to coexist. "At most one active assignment per tag" is structurally guaranteed (a tag has exactly one `assignedPetId` field). **Assumption**: a pet has at most one tag at a time — reassignment means unassign-then-assign, not multiple simultaneous tags per pet (matches the spec's single-tag worked example; documented here per spec §28 rule 20).
- [x] Updated `QrService.generate()` to encode the tag's public resolution URL and, more importantly, moved *when* it's called: QR generation now happens once, at tag creation (`TagsService.create()`), not at pet creation. This is a real architectural fix, not just a rename — the physical sticker's QR image must stay valid forever across reassignment to different pets, since resolution is dynamic (tag → currently-assigned pet, looked up at scan time), so the image content must never depend on which pet is currently attached.
- [x] **Documented deviation from the task's literal URL**: the task specifies encoding `https://<APP_URL>/t/{publicCode}`. This repo is API-only (no frontend project present anywhere in the working tree), so `/t/{code}` would resolve to nothing. Kept the QR payload pointing directly at this API's own public resolution route — `${APP_URL}/api/public/tags/{publicCode}` — mirroring exactly how the pre-Phase-2 code already worked (it pointed at `/api/public/pets/{publicId}` directly, not a frontend route). `APP_URL` is already a single config value, so once a real frontend exists, pointing QR codes at it is a one-line config/URL-building change, not a rearchitecture.
- [x] Replaced the public lookup route: `GET /public/pets/:publicId` → `GET /public/tags/:publicCode`, resolving `Tag.publicCode → Tag.assignedPetId → Pet`. Handles three tag states explicitly instead of just 404ing: `RETIRED`/`SUSPENDED` return a clear status message, and an tag that exists but isn't currently `ASSIGNED` returns "not linked to a pet yet" rather than crashing or leaking anything — this matters because a real finder can absolutely scan a tag that was never assigned. The pet's internal Mongo `_id` is never present anywhere in the public response.
- [x] **Removed `Pet.publicId` and `Pet.qrCode` from the `Pet` schema entirely** rather than keeping them as unused legacy fields — `Tag.publicCode`/`Tag.qrImageUrl` fully replace their role, and per this project's own stated principle (avoid backwards-compat cruft for fields nothing reads), keeping them would just be dead weight. Removed the matching `nanoid`/`QrService` calls from `PetsService.create()` (pet creation no longer generates a QR code — assigning a physical tag is now a separate, later step, matching the real product flow in spec §2/§27). Cleaned up the two other places that referenced the now-gone `publicId` field: the admin pet search filter (search is now by name only — an admin can search tags separately via the new `GET /tags`) and `topScannedPets()`'s field selection.
- [x] **Fixed a regression the field removal would otherwise have caused**: `PublicService.getLostPets()` used to return each pet's `publicId` so a finder could click through to its profile. With that field gone, the public lost-pets listing needed a replacement identifier — it now does a batched lookup of each listed pet's currently-`ASSIGNED` tag and returns that tag's `publicCode` instead (and explicitly does not leak the pet's internal `_id`, which a naive `.lean()` spread would have included).
- [x] **Migration/backfill — clean break, not a migration script**: chose not to write a backfill for pets with a pre-existing `qrCode`. This project has no production users or live pet data yet (confirmed in the Phase 1 baseline audit — this is pre-launch), so any existing dev/test `Pet` documents with the old fields can simply be recreated against the new `Tag`-based flow; a migration script would be pure overhead for data that doesn't need preserving.
- [x] Added indexes: `Tag.publicCode` (unique + index), `Tag.serialNumber` (unique + index), and the partial unique index on `Tag.assignedPetId` described above (which also serves as the "queryable by assigned pet" index).
- [x] Verified the whole change set at the decorator level without needing a live database: `node -e "require('./dist/app.module.js')"` loads and evaluates every schema/controller/DTO decorator in the entire app (the same mechanism that crashed in Phase 1 on `Activity`/`User`) with zero errors — a stronger, network-independent check than the live-boot attempt Phase 1 couldn't complete in this sandbox. Live DB connection + Swagger UI render is still unverified here (no network egress in this sandbox at all — confirmed via a raw DNS/socket test) and remains an open item from Phase 1.

### Swagger Requirement
Applied: every `tags` endpoint has full `@ApiTags`/`@ApiOperation`/`@ApiResponse` coverage (including the "not available"/"not found" error cases), every new DTO (`CreateTagDto`, `AssignTagDto`, `UnassignTagDto`, `TagQueryDto`) is fully `@ApiProperty`-annotated, and the updated `public.controller.ts` route's Swagger description explicitly documents the three possible response shapes (assigned/unassigned/suspended-retired) so API consumers don't assume it's always a full pet profile.

### Definition of Done
- [x] Tags exist as first-class records with a real lifecycle, assignable/unassignable independent of pet deletion.
- [x] QR codes resolve via `publicCode`, never an internal ID (encoding an API URL rather than the literal `/t/{code}` frontend path — see documented assumption above).
- [x] Ownership and assignability are validated server-side on every tag mutation (`assign`/`unassign` both go through `PetsService.findOwnedPet`, which throws a uniform `NotFoundException` for both "doesn't exist" and "not yours," matching this codebase's established IDOR-prevention convention).

### Status
**Complete** (2026-08-22). `npm run lint`, `npm run build`, and `npm test` (22/22 suites, up from 20 — added `tags.controller.spec.ts`/`tags.service.spec.ts`) all pass clean. Two items carried forward, both inherited from Phase 1 and not new to this phase: live DB-connected boot and an actual look at `/api/docs` in a browser are still unverified in this sandbox (no network egress at all here, confirmed directly) — do both once against a real MongoDB before treating Phase 1 *or* 2 as fully closed in production.

---

## Phase 3 — Lost & Found Flow Completion

**Goal:** Complete the core "find a lost pet" loop from spec §6–§8: finder reports, scan history, and owner-facing visibility into both — without requiring the finder to register.

### Tasks
- [x] Added a `ScanEvent` schema/module (`src/modules/scans/`): `tag` (ref, indexed), `pet` (nullable ref, indexed — `null` when the scanned tag isn't currently linked to a pet), `approxLocation` (optional, not auto-populated — see assumption below), `userAgent` (captured from the request header), `createdAt` (indexed, via `timestamps: true`). Recorded on **every** public scan via `PublicService.getPetProfile()` — assigned, unassigned, suspended, and retired tags all produce a `ScanEvent`; only an outright nonexistent tag code (404, no tag doc to reference) does not. `Pet.scanCount`/`lastScannedAt` are kept as-is (cheap derived counters), per the task's own "keep the counter if useful" allowance — `ScanEvent` is the real source of truth for history/analytics.
- [x] **Assumption**: `approxLocation` is schema-ready but not populated by the automatic scan path — implementing real IP-geolocation would mean adding a new third-party dependency/service for a "nice to have" per spec §8, so it's left for a future phase if wanted. It's populated on `FoundReport` instead, where the finder voluntarily types a location — that's both simpler and more privacy-appropriate than IP-based inference.
- [x] Added a `FoundReport` schema/module (`src/modules/found-reports/`): `tag`/`pet` (refs, indexed), `message` (required), `approxLocation`/`contactInfo` (optional, finder-supplied), `photoUrl` (optional), `foundAt` (defaults to submission time). Public endpoint: `POST /public/tags/:publicCode/found-report`, multipart, no auth. Validates the tag resolves to a currently-`ASSIGNED` pet (400 if not — you can't "find" a pet that isn't linked to that tag) before accepting the report.
- [x] Added owner-facing, ownership-scoped listing endpoints, following the exact routing convention already established by `medical`/`vaccinations`: `GET /pets/:petId/scans` and `GET /pets/:petId/found-reports`.
- [x] Wired "found report submitted" → owner email notification via a direct `NotificationsService.sendEmail(...)` call (per this phase's own allowance; Phase 4 replaces this with a proper event bus). **Deliberately did not wire "pet marked lost" → owner notification in this phase**: `PetsModule` would need to import `NotificationsModule` to do it directly, but `NotificationsModule → VaccinationsModule → PetsModule` already exists (traced the actual import graph before writing any code), so that would be a real circular module dependency, not just a hypothetical one. Forcing it through now (`forwardRef()`) would be exactly the kind of coupling Phase 4's event bus exists to remove — deferred there instead of band-aiding it here. Found-report notification didn't hit this problem since `FoundReportsModule` is new and has no existing reverse edge to worry about.
- [x] Abuse protections on the found-report endpoint: a new, stricter `write` throttle tier (5 req/min, vs. the general `public` tier's 20/min) applied via `@Throttle`; photo upload capped at 5MB with a JPEG/PNG/WebP-only `fileFilter` (rejects anything else with a 400 before it touches disk).
- [x] Confirmed the public pet profile response (`PublicService.getPetProfile`) still excludes everything on the "must not expose" list — re-read the exact field list returned: no owner name/email/password, no internal Mongo IDs, no address. Unchanged from Phase 2, still correct.
- [x] **Found and fixed two bugs while building this, before they shipped**: (1) `FoundReportsService` originally returned the raw Mongoose `FoundReport` document straight to the public, unauthenticated finder — which carries the pet's and tag's internal Mongo `_id`s in the `pet`/`tag` fields, a direct violation of the same "never expose internal IDs publicly" principle enforced everywhere else. Fixed by having `PublicService.submitFoundReport()` return a plain `{ message }` confirmation instead of the raw doc. (2) The owner-notification email call was unguarded — if `MailerService.sendMail` throws (bad SMTP config, network blip), the exception would have propagated up and turned a *successfully saved* found report into a 500 response to the finder, who'd have no way to know their report actually went through. Wrapped the notification step in try/catch with a logged error; the report's success no longer depends on email delivery succeeding.

### A larger finding along the way: a severe pre-existing DI bug, plus a new permanent regression test for it
While reasoning through module import chains to safely wire notifications without a cycle, direct inspection of `users.module.ts` turned up something serious: `UsersService`'s constructor injects the `Pet` Mongoose model (`@InjectModel(Pet.name)`, used by `monthlyQrScans()`), but `UsersModule` never registers or imports it anywhere. This is not a Phase 3 regression — it predates Phase 1 and has been there since the baseline audit; it was simply never caught because every existing `*.spec.ts` mocks its dependencies directly (bypassing real Nest module wiring) and this sandbox has never had live DB/network access to catch it via an actual boot attempt.

Verified it conclusively without a live database: built a `Test.createTestingModule({ imports: [AppModule] })` compile with the Mongoose connection provider (`getConnectionToken()`) overridden with a minimal fake (`{ models: {}, model: (name) => ({...}) }`) — this exercises Nest's **real** dependency-injection graph resolution for the entire app, decorator wiring included, with zero network calls. Before the fix, this failed with exactly the error a real boot would produce: `Nest can't resolve dependencies of the UsersService (UserModel, ?). Please make sure that the argument "PetModel" ... is available in the UsersModule module.` Since `AuthModule` (and by extension nearly the whole authenticated API surface) depends on `UsersModule`, this would have crashed the app on every single real-world boot attempt, in any environment. Fixed by registering `Pet`'s schema locally in `UsersModule` (matching the pattern `PublicModule` already used for the same reason).

This verification technique is valuable enough to keep permanently rather than throw away: it now lives at `src/app.di-check.spec.ts`, runs as part of `npm test`/CI on every push, and will catch this entire class of bug (a provider injected but never registered/imported anywhere reachable) automatically in every future phase — including the two new modules this phase added. This substantially closes the "live boot unverified" gap carried forward from Phase 1/2: the full provider graph is now proven to resolve; only an actual live network/DB connection (still unavailable in this sandbox) remains unverified.

### Swagger Requirement
Applied: `ScansController`/`FoundReportsController` have full `@ApiTags`/`@ApiOperation`/`@ApiResponse` coverage; the public found-report endpoint's Swagger explicitly states "No authentication required" in its description and documents the `multipart/form-data` shape (`@ApiConsumes`/`@ApiBody`) including the optional photo field; `CreateFoundReportDto` is fully `@ApiProperty`-annotated.

### Definition of Done
- [x] A finder can scan → view profile → submit a found report, with zero account creation, and the owner can see it (via `GET /pets/:petId/found-reports` and, since Phase 3 wires it, an email).
- [x] Every scan produces a queryable `ScanEvent`; every report produces a queryable `FoundReport`.
- [x] Public write endpoints are rate-limited (`write` tier, 5/min) and validated (DTO validation + file type/size limits).

### Status
**Complete** (2026-08-23). `npm run lint`, `npm run build`, and `npm test` (27/27 suites, up from 22) all pass clean. The new `src/app.di-check.spec.ts` is now part of that count and part of CI going forward. Carried forward, unchanged from Phase 1/2: an actual live network/DB connection and a look at `/api/docs` in a browser remain unverified in this sandbox (no network egress at all here) — the DI-graph finding above means this is now a much smaller residual risk than it was, but it's still worth doing once before real deployment.

---

## Phase 4 — Notifications & Domain Events

**Goal:** Stop calling `NotificationsService.sendEmail(...)` directly from business logic scattered across modules; introduce a thin domain-event layer so new channels (push/SMS) and new triggers can be added without touching unrelated modules (spec §14, §25).

### Tasks
- [x] Introduced an internal event bus: `@nestjs/event-emitter` (`EventEmitterModule.forRoot()`, global by default — confirmed by reading the package's own module source rather than assuming, so no feature module needs to import anything to get `EventEmitter2`). Event names/payload contracts live in one dependency-free file, `src/common/events/domain-events.ts`, importable by any module without creating a module-to-module edge. Emits all six named events plus one not in the original list (see note below): `pet.marked-lost`, `pet.marked-found`, `tag.assigned`, `tag.unassigned`, `qr.tag-scanned`, `found-report.created`, `vaccination.reminder-due`.
- [x] Moved every direct `NotificationsService.sendEmail(...)` business-trigger call to an emitted event: `PetsService.reportLost/reportFound`, `TagsService.assign/unassign`, `ScansService.record` (only when the scan resolves to an assigned pet), `FoundReportsService.create`, and `VaccinationReminderJob`. Confirmed via `grep -rn "NotificationsService\|MailerService" src` (excluding the `notifications` module itself and spec files) that **zero** other modules reference either — the only thing that still imports `NotificationsModule` anywhere is `app.module.ts`'s top-level registration. `FoundReportsModule` no longer needs to import `NotificationsModule` at all as a result.
- [x] **Design choice, and where it deviates from the task's literal wording**: emitters build the *entire* payload themselves (`ownerId`, `ownerEmail`, `petName`, etc.) rather than the listener reaching back into `Pets`/`Users` to resolve it. This means `NotificationsModule`'s import list is unchanged from before this phase (`VaccinationsModule` + Mongoose + Mailer) — it still doesn't know `Pet` or `User` exist. The cost is a few call sites doing their own populate (e.g. `PetsService.emitOwnerEvent` populates `owner` on the pet doc it already has); the benefit is the module that's supposed to be the most decoupled piece of this phase actually is.
- [x] `NotificationChannel` interface (`send(userId, type, payload)`) + `EmailChannel` implementation (`src/modules/notifications/channels/`), registered behind a `NOTIFICATION_CHANNELS` multi-provider token that `DomainEventsListener` iterates — adding `PushChannel`/`SmsChannel` later is one new provider added to that array, no call-site changes. A shared `renderNotification(type, payload)` (`templates/notification-templates.ts`) is the single place event → human copy is written, used for both the in-app `Notification.title/message` and (when `sendEmail: true` for that type) the email subject/body — avoids maintaining two copies of the same wording. Only `pet.marked-lost`, `pet.marked-found`, `found-report.created`, and `vaccination.reminder-due` send email; `tag.assigned`/`tag.unassigned`/`qr.tag-scanned` are in-app-only by design (an email per QR scan would be spam, and a self-service tag assign/unassign already gets synchronous feedback in the API response).
- [x] Persisted a `Notification` schema (`user`, `type`, `title`, `message`, `data` (Mixed — the raw event payload, for a future dashboard to introspect), `readAt`), indexed on `{ user, createdAt }` and `{ user, readAt }`. `DomainEventsListener` persists one for **every** event before fanning out to channels, wrapped so a persistence failure never blocks email delivery or vice versa (each step independently try/caught and logged). Added `GET /notifications` (paginated, `unreadOnly` filter) and `PATCH /notifications/:id/read`, both ownership-scoped the same way every other "mine" endpoint in this codebase is.
- [x] **Scope note — one event beyond the original list**: added `vaccination.reminder-due`, not in the task's named six. The task's own wording ("move the vaccination-reminder job... to listen on these events") doesn't quite fit literally — the job's *trigger* is a daily cron sweep, not a domain event, and none of the six named events represent "a vaccination is due." Read the intent as "the vaccination job shouldn't be the odd one out still calling `sendEmail` directly," and satisfied that by giving it its own event of the same shape rather than leaving it as a special case — `VaccinationReminderJob` now only depends on the `Vaccination` model and `EventEmitter2`, no longer on `NotificationsService` at all.
- [x] **Scope boundary, deliberately not covered by this phase**: `PetsService.recoverPet()`/`deletePet()` (admin-initiated, bypass the owner-facing `reportFound`/`remove` paths) and `TagsService.retire()` (can force-retire an assigned tag without going through `unassign`) do not emit events. These are already covered by the existing admin `ActivityService` audit log (a different concern — "what did an admin do," not "notify the affected user"), and adding owner-facing notifications for admin overrides is exactly the kind of scope Phase 7 (Admin, Audit & Abuse Handling) exists to deliberately decide, not something to bolt on here.

### Swagger Requirement
Applied: `NotificationsController`'s `GET /notifications` and `PATCH /notifications/:id/read` have full `@ApiTags`/`@ApiOperation`/`@ApiResponse` coverage; `NotificationQueryDto` is fully `@ApiPropertyOptional`-annotated. The `main.ts` Swagger tag description for "Notifications" was updated to describe the actual current surface (in-app feed) rather than the old "email notification triggers" line, which stopped being accurate the moment this phase moved email out of being the only thing this module does.

### Definition of Done
- [x] No module directly imports `MailerService`/`NotificationsService.sendEmail` for business triggers — everything goes through the event layer (verified by grep, see above).
- [x] Adding a new channel doesn't require editing unrelated modules (new `NOTIFICATION_CHANNELS` provider entry only); adding a new trigger is emitting from wherever the state change already happens plus one `@OnEvent` handler in `DomainEventsListener` — no existing emitter needs to change.

### Status
**Complete** (2026-08-23). `npm run lint:check`, `npm run build`, and the full test suite (29/29 suites, up from 27 — added specs for `EmailChannel` and `DomainEventsListener`, plus updated every spec whose constructor gained `EventEmitter2` or lost `NotificationsService`) all pass clean. The DI-check test (`src/app.di-check.spec.ts`) compiled the entire real `AppModule` with this phase's changes in place and passed, which is meaningful here specifically: it's the thing that would have caught a `NOTIFICATION_CHANNELS` factory provider or an `@OnEvent` listener with an unresolvable dependency, exactly the class of bug this phase's plumbing could introduce.

**Superseded within the same day — see the very next Progress Log entry below**: this section originally reported the MongoDB Atlas hostname as unreachable (`ENOTFOUND`) and left live-DB boot as still-open. That test was wrong, not the environment — a plain DNS `lookup()` on an `mongodb+srv://` hostname always fails since SRV-style Atlas hostnames don't carry their own A record; the correct check (`resolveSrv`, then a real `mongoose.connect()`) succeeded. A full live boot was then verified end-to-end (`/api/health`, `/api/public/lost-pets` against the real DB, `/api/docs`) — see the Progress Log for the full account. Leaving the incorrect original wording struck through here rather than silently rewritten, since the roadmap's own convention is to record what was actually found in the moment, not retroactively clean it up.

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

## Phase 10 — Pet Dating & Companion Matching

**Provenance note:** unlike Phases 1–9, this phase is **not** derived from `PAWTATO_PROJECT_SPEC.md` — it doesn't mention pet dating/matching anywhere. It was requested directly by the user on 2026-08-22, alongside a companion PWA-first frontend blueprint (`PAWTATO_FRONTEND_BLUEPRINT.md`). Treat this phase as a real, intentional scope addition, not spec drift — but if a future session finds it conflicts with an updated spec, the spec wins and this phase gets revisited.

**Concept (as scoped with the user):** owners can opt any of their pets into a matching feature. Each pet's dating profile declares its own **purpose** — `PLAYDATE`, `BREEDING`, or `BOTH` — and discovery/matching respects that (a playdate-only pet is never surfaced to a breeding-only search, and vice versa, unless one side is `BOTH`). This is a swipe-to-match model (mutual like -> match -> lightweight chat), scoped for cats and dogs only, matching the rest of the platform.

**Goal:** Ship the matching feature as its own bounded module with minimal coupling to the rest of the app — it reads `Pet`/`User` (species, owner, location-adjacent fields) but nothing in the existing modules should need to know matching exists.

### Tasks

**Domain model** (new `src/modules/dating/` module)
- [ ] `PetDatingProfile` schema: `petId` (ref, unique — one profile per pet), `purpose` enum (`PLAYDATE | BREEDING | BOTH`), `bio` (short text), `temperamentTags` (string array, e.g. `playful`, `calm`, `good-with-kids`), `photos` (array of image URLs, separate from the pet's main `profileImage` so owners can curate a dating-specific gallery), `approxLocation` (coarse — city/area string, or lat/lng rounded to ~1km; never the owner's precise address, matching spec §17's location-minimization principle), `isActive` (boolean — owner can pause visibility without deleting the profile).
- [ ] For `BREEDING`/`BOTH` purpose: optional `healthVerified` flag that can only be set `true` by cross-referencing the pet's own `medical`/`vaccinations` records (reuse those modules — don't duplicate health data into the dating profile).
- [ ] `Swipe` schema: `fromPetId`, `toPetId`, `action` (`LIKE | PASS`), `createdAt`. Unique compound index on `(fromPetId, toPetId)` — a pet can't swipe the same pet twice.
- [ ] `Match` schema: `petAId`, `petBId` (store in a canonical/sorted order to make lookups trivial), `matchedAt`, `status` (`ACTIVE | UNMATCHED`).
- [ ] `Message` schema (lightweight, not a full chat system): `matchId`, `senderUserId`, `content`, `createdAt`, `readAt`.
- [ ] `DatingReport` schema: `reporterUserId`, `targetPetId`, `reason`, `status` (`PENDING | REVIEWED | ACTIONED`) — feeds into Phase 7's admin abuse-handling work rather than inventing a separate moderation system.

**API surface**
- [ ] `POST /pets/:petId/dating-profile` / `PATCH /pets/:petId/dating-profile` (owner only, via the same `findOwnedPet` ownership pattern used everywhere else) — create/update.
- [ ] `GET /dating/discover?petId=` (owner) — paginated candidate pets to swipe on: same species as the swiping pet, purpose-compatible, excludes the owner's own pets and anything already swiped, `isActive: true` only.
- [ ] `POST /dating/swipe` — body `{ fromPetId, toPetId, action }`; validates the caller owns `fromPetId`; if the target already `LIKE`d back, creates a `Match` and returns it in the response (so the client knows immediately, no polling needed).
- [ ] `GET /dating/matches` (owner) — all matches across the owner's pets.
- [ ] `GET /dating/matches/:matchId/messages`, `POST /dating/matches/:matchId/messages` — basic thread; validate caller owns one side of the match.
- [ ] `POST /dating/matches/:matchId/unmatch` — either side can unmatch.
- [ ] `POST /dating/report` — report a pet's dating profile; feeds the Phase 7 admin moderation queue.
- [ ] Admin (Phase 7 extension, not duplicated here): `GET /admin/dating/reports`, action endpoints to deactivate a reported profile.

**Safety & scope guards**
- [ ] Rate-limit `POST /dating/swipe` (reuse the Phase 1 throttler pattern) — this is the one endpoint in this module that's meaningfully abusable (mass-swiping/scraping).
- [ ] Never expose precise owner location or contact info through discovery or match payloads before a match exists; once matched, follow the same opt-in contact-reveal principle as the lost-pet finder flow (spec §17) rather than auto-exposing phone/email.
- [ ] Confirm species-only matching (no cross-species suggestions) and purpose-compatibility filtering are enforced server-side, not just in client UI.

### Swagger Requirement
Full `@ApiTags`/`@ApiOperation`/`@ApiResponse` coverage for every new `dating`-prefixed and `pets/:petId/dating-profile` route, with the purpose enum and match/report DTOs fully documented — this module is exactly as bound by the Phase 1 Swagger mandate as any other.

### Definition of Done
- A pet's dating visibility respects its declared purpose in both directions (never surfaced to, nor able to discover, an incompatible purpose).
- Mutual likes reliably produce exactly one `Match` (no duplicate matches from race conditions — cover this with a unique index, same pattern as the Phase 2 "one active tag per pet" constraint).
- No module outside `dating/` has a hard dependency on it; deleting the module would not break pets/auth/admin.

### Status
Not started. Sequencing note: this can be built any time after Phase 2 (needs `Pet`/`User` only) — it doesn't block or get blocked by Phases 3–9, so a future session can slot it in whenever the user prioritizes it, not strictly in numeric order.

---

## Progress Log

- **2026-08-22** — Roadmap created after a full baseline audit of the existing NestJS codebase against `PAWTATO_PROJECT_SPEC.md`. No phases started yet. Key gaps identified: no independent QR Tag entity, no found-report/scan-event tracking, missing production hardening (rate limiting, CORS, config validation, CI/Docker), dead legacy files, Swagger coverage incomplete.
- **2026-08-22** — Phase 1 (Production Readiness Revamp) completed. Cleaned up dead code, added Joi env validation, wired CORS/throttling/global exception filter/response interceptor, added structured logging with secret redaction, added Dockerfile + CI, and brought Swagger coverage to 100% of controllers/DTOs. Along the way, found and fixed several real pre-existing bugs beyond the original checklist: the app couldn't boot outside dev mode (Mongoose schema type-reflection crash on `Activity.metadata` and `User.role`), a cron job ran every 15s against a hardcoded fake email instead of daily against the real owner, JWT signing had a hardcoded fallback secret, the admin audit-log endpoint (`/api/activity`) had no auth guard at all, a routing bug shadowed `GET /pets/statistics` behind `GET /pets/:id`, and the test suite was 17/20 suites broken (fixed all — now 20/20 passing, lint and build both clean). Not verified in this sandbox (no Docker/MongoDB available): a full live boot + Swagger UI render against a real database — do this once before treating Phase 1 as fully closed in production. Also noted for later phases: the refresh-token flow (`RefreshTokenDto`, `REFRESH_SECRET`) is scaffolded but never implemented — belongs in Phase 3 or a dedicated auth-completion task, not silently assumed to work.
- **2026-08-22** — Phase 2 (QR Tag Domain Correction) completed. Added a first-class `Tag` model (`src/modules/tags/`) with a real lifecycle (`MANUFACTURED/AVAILABLE/ASSIGNED/SUSPENDED/RETIRED`), assign/unassign endpoints keyed on the tag's public code (not an internal ID, since that's all a real user ever has), and admin inventory endpoints. Removed `Pet.publicId`/`Pet.qrCode` entirely in favor of the Tag model; moved QR image generation from pet-creation time to tag-creation time (a real architectural fix — the physical sticker's image must stay valid across reassignment). Replaced the public lookup route (`/public/pets/:publicId` → `/public/tags/:publicCode`) and fixed a regression the field removal would otherwise have caused in the public lost-pets listing. Chose a clean break over a migration script (no production data exists yet) and documented why the QR payload points at this API directly rather than the spec's literal `/t/{code}` path (no frontend project exists in this repo yet). Verified the entire module graph's decorators load without error via `node -e "require('./dist/app.module.js')"` — a network-independent check. `npm run lint`/`build`/`test` all pass clean (22/22 suites). Still carried forward from Phase 1: live DB-connected boot and `/api/docs` in a browser remain unverified — this sandbox has no network egress at all.
- **2026-08-22** — Added Phase 10 (Pet Dating & Companion Matching) as a planned, not-yet-started phase, plus a companion PWA-first frontend blueprint (`PAWTATO_FRONTEND_BLUEPRINT.md`) — both requested directly by the user, not derived from the original spec. Scoped as: each pet's dating profile declares its own purpose (playdate, breeding, or both), swipe-to-match, lightweight in-app messaging, species-only matching, coarse location only pre-match. No implementation yet — planning only.
- **2026-08-23** — Phase 3 (Lost & Found Flow Completion) completed. Added `ScanEvent` (`src/modules/scans/`) and `FoundReport` (`src/modules/found-reports/`) as first-class, queryable records; the public found-report endpoint requires no account and notifies the owner by email. Fixed two bugs caught before shipping: the endpoint was about to leak the pet's/tag's internal Mongo IDs to the public finder via a raw document response (now returns a sanitized confirmation), and an email failure would have turned a successfully-saved report into a 500 for the finder (now caught and logged, doesn't affect the response). Deliberately deferred "pet marked lost → notify owner" to Phase 4 after tracing the actual module import graph and finding it would require a real circular dependency (`PetsModule → NotificationsModule → VaccinationsModule → PetsModule`) to do directly — exactly the coupling problem Phase 4's event bus exists to solve. Separately, found and fixed a severe pre-existing bug unrelated to this phase's own scope: `UsersModule` never registered the `Pet` Mongoose model that `UsersService` depends on, which would have crashed the app on every real boot (`AuthModule` depends on `UsersModule`). Built a new permanent, network-independent verification test (`src/app.di-check.spec.ts`) that compiles the entire real `AppModule` dependency graph against a faked Mongoose connection — proved the bug, then proved the fix, and now runs in CI on every push to catch this whole class of issue automatically going forward. `npm run lint`/`build`/`test` all pass clean (27/27 suites). Live network/DB connection and `/api/docs` in a browser remain the one open item, still unverified in this sandbox — lower residual risk now that the full DI graph is proven to resolve.
- **2026-08-23** — Ad-hoc hardening pass (not a numbered phase) requested directly by the user, covering four cross-cutting items outside any single phase's scope: **CI** — split `lint` (autofix, for local dev) from a new non-mutating `lint:check` (CI now runs this instead — the old CI step was silently autofixing in the runner rather than failing on fixable issues), added a `concurrency` group to cancel superseded runs, and added a second `docker-build` job (gated on tests passing) that builds the production Dockerfile on every push to catch image breakage before a deploy step ever sees it — no registry push, no credentials needed. **Dockerfile** — added a `HEALTHCHECK` against the real `/api/health` route (pure Node, no extra packages installed), and gave `docker-compose.yml`'s `mongodb` service a real healthcheck with `api` now waiting on `condition: service_healthy` instead of a bare `depends_on` (which only waits for container start, not DB readiness). Added `engines.node` to `package.json` to pin the version Docker/CI already assume. **Swagger** — `main.ts`'s `DocumentBuilder` was previously bare (title/description/version/bearer-auth only); added `.addServer(appUrl)` so "Try it out" targets the right host, `.addTag(...)` with a one-line description for all 13 existing `@ApiTags` groups (Authentication, Users, Pets, Tags, Public, Scans, Found Reports, Medical Records, Vaccinations, Notifications, Admin, Activity, Health) so `/api/docs` renders as organized sections instead of an unordered flat list, and `persistAuthorization: true` so a bearer token survives a docs-page refresh during manual testing. No endpoint/DTO annotations were missing — Phase 1–3's coverage held up under a fresh audit. **Documentation** — `README.md` was still the untouched `nest new` starter template (no mention of Pawtato at all); rewrote it with real project description, env var table, Docker/Compose instructions, Swagger location, test commands (including what `app.di-check.spec.ts` actually does and why it's different from every other spec file), and a CI/CD summary — plus links to this roadmap, the product spec, and the frontend blueprint. Verified via `npm run lint:check`, `npm run build`, and the full test suite (27/27 suites, unchanged) — all pass clean. Docker image build itself could not be verified locally (no `docker` binary in this sandbox); the new CI `docker-build` job is the first real verification of the updated Dockerfile and will run on the next push.
- **2026-08-23** — Phase 4 (Notifications & Domain Events) completed. Added `@nestjs/event-emitter` (global `EventEmitterModule.forRoot()`) and a dependency-free event-contracts file (`src/common/events/domain-events.ts`) so `Pets`/`Tags`/`Scans`/`FoundReports`/the vaccination cron job can all emit without importing `NotificationsModule`. Moved every direct `NotificationsService.sendEmail(...)` call out of business logic into emitted events (`pet.marked-lost`, `pet.marked-found`, `tag.assigned`, `tag.unassigned`, `qr.tag-scanned`, `found-report.created`, plus one addition beyond the original list, `vaccination.reminder-due`, added so the vaccination job wasn't left as the one remaining direct caller). A single `DomainEventsListener` persists an in-app `Notification` for every event (new `GET /notifications`, `PATCH /notifications/:id/read`) and fans out to a `NOTIFICATION_CHANNELS` provider array (currently just `EmailChannel`, which only 4 of the 7 event types actually trigger — tag/scan events are in-app-only to avoid email spam). Deliberately kept `NotificationsModule` from gaining any new dependency on `Pets`/`Users`: every emitter builds its own full payload (including resolving `ownerEmail`) before emitting, so the listener stays genuinely decoupled. Confirmed via grep that zero modules outside `notifications/` reference `NotificationsService`/`MailerService` anymore. `npm run lint:check`/`build`/`test` all pass clean (29/29 suites).
- **2026-08-23** — **Closed the long-standing "live boot unverified" item** carried forward since Phase 1 (the user asked directly whether the `.env` `MONGO_URI` could actually be used yet). Re-tested network reachability to the MongoDB Atlas cluster — the earlier "no network egress at all" conclusion (Phases 1–3) turned out to be a bad test, not a bad environment: a plain DNS `lookup()` on an `mongodb+srv://` hostname will always fail (SRV-style Atlas hostnames don't have their own A record), which is what every earlier check ran. Redone correctly with `resolveSrv`/a raw TCP connect/an actual `mongoose.connect()`, all three succeeded. Built `dist/` and booted the real `main.js` against the real `.env` (on port 5050 — 5000 was taken locally by macOS's AirPlay Receiver, unrelated to the app) — `GET /api/health` returned 200, `GET /api/public/lost-pets` executed a real query against the live Atlas database and returned successfully (empty array, no lost pets yet), and `GET /api/docs` returned 200. This is the first time in this project's roadmap that Swagger UI and a full DB-connected boot have actually been confirmed, closing an item every phase since Phase 1 had listed as open — the Phase 4 log entry above was written and closed *before* this check, so it still states the old "unresolved" conclusion; this entry supersedes it. Deliberately did not perform any write test (register/create-pet) against this cluster — no reason to leave test data in what's presumably meant to become real data, and read-only checks already prove the connection, auth, and query path end-to-end. Process was shut down immediately after; nothing was left running. **Standing recommendation unchanged and now higher-priority**: the credentials in `.env` (MongoDB Atlas + Zoho SMTP) are the same ones pasted into chat earlier in this project and are confirmed live and reachable — rotate both before any real deployment, since they've been sitting in plaintext chat history this whole time.
