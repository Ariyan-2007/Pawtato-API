# Pawtato Frontend Integration Flows

This file is a **living, incremental** companion to `PAWTATO_ROADMAP.md`, written for whoever builds the frontend. It is not a UI spec (see `PAWTATO_FRONTEND_BLUEPRINT.md` for that) — it is a **flow-by-flow API integration guide**: exact endpoints, request/response shapes, auth requirements, and sequencing, for user journeys that are backend-complete and proven end-to-end (covered by a real e2e test against real HTTP + a real database, not just unit-mocked).

## How to use this file

- **Only flows that are e2e-verified get a section here.** A flow lands in this file the moment its roadmap phase closes with an automated e2e test proving it end-to-end — not when the endpoints merely exist. Check `PAWTATO_ROADMAP.md`'s Phase Index for what's done vs. in progress.
- Each flow section is self-contained: sequence diagram (as a numbered list), then one subsection per HTTP call with method, path, auth, request body, success response, and the error cases worth handling in the UI.
- Response bodies below show the `data` field's shape only — every response is wrapped in the envelope described in **Conventions** below; don't repeat that wrapping in your own reading of each example.
- When a new flow closes out in the roadmap, append a new `## Flow N — ...` section here. Don't rewrite or delete earlier flows unless the underlying API actually changed — this file is a changelog-shaped reference, same spirit as the roadmap's own Progress Log.
- If a flow's backend contract changes after this file documents it (a field renamed, a status code changed), update that flow's section in place and note the change in **Changelog** at the bottom — don't leave stale examples.

---

## Conventions (apply to every flow in this file)

**Base URL / prefix:** every route below is relative to `{APP_URL}/api` — e.g. `POST /auth/register` means `POST {APP_URL}/api/auth/register`.

**Auth:** routes marked 🔒 require `Authorization: Bearer <accessToken>`. Routes marked 🌐 are public — no account, no token, ever. A 🔒 route called without a valid token returns `401`.

**Success envelope** — every non-error response is wrapped identically:
```json
{
  "success": true,
  "message": "Request successful",
  "data": { /* the shape shown in each section below */ }
}
```

**Error envelope** — every error response (validation, auth, not-found, rate-limit, server error) has this shape, regardless of status code:
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Pet not found",
  "error": "NotFoundException",
  "path": "/api/pets/64f...",
  "timestamp": "2026-08-24T12:00:00.000Z"
}
```
`message` is a `string` for most errors, or a `string[]` for `class-validator` field-validation failures on a `400`.

**Pagination shape** — every paginated list endpoint returns:
```json
{
  "items": [ /* ... */ ],
  "pagination": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
}
```
(the array field itself is named per-resource — `notifications`, `tags`, `pets`, etc. — see each endpoint.)

**Ownership errors are always `404`, never `403`.** If you request a resource that exists but belongs to another user, the API returns the same `404 Pet not found` (or equivalent) as if it didn't exist at all — this is deliberate (an authorization failure must never confirm a resource's existence to someone who doesn't own it). Don't build UI that distinguishes "not found" from "not yours."

**Rate limiting:** public (🌐) routes are throttled; a burst returns `429` with the standard error envelope. Build a generic "please slow down and try again" handler for `429` rather than a route-specific one.

---

## Flow Index

| # | Flow | Status | Roadmap phase |
|---|------|--------|----------------|
| 1 | Lost & Found (register → tag a pet → public scan → found report → resolve) | **Integration-ready** | Phase 6 (e2e-verified 2026-08-24) |
| 2 | Admin Tag Inventory & Abuse Review (manufacture tags → claim → moderate found reports → audit log) | **Integration-ready** | Phase 7 (e2e-verified 2026-08-24) |
| 3 | Pet Dating & Companion Matching (dating profile → discover → swipe → match → chat → report → admin moderation) | **Integration-ready** | Phase 10 (e2e-verified 2026-08-25) |

---

## Flow 1 — Lost & Found

**What this covers:** the full loop from spec §27/§30 — an owner creates an account, registers a pet, and links a physical QR tag to it; a stranger who finds the pet scans the tag with no account of their own, sees a safe public profile, and can leave a found-report; the owner gets notified in-app and resolves it. Proven end-to-end by `test/lost-and-found-flow.e2e-spec.ts` (real HTTP, real database, real rate limiter) — see the Phase 6 entry in `PAWTATO_ROADMAP.md` for what was verified and two bugs that were found and fixed while building that test.

**Sequence:**
1. Owner registers → account is `PENDING_VERIFICATION`, no token yet.
2. Owner verifies the OTP emailed to them → account becomes `ACTIVE`, an access token is issued.
3. Owner creates a pet.
4. Owner creates a QR tag and assigns it to the pet.
5. *(Anywhere from here on)* anyone who scans the tag's QR code sees the pet's public profile — no login.
6. Owner reports the pet lost.
7. The pet now appears in the public "lost pets" list, and its scanned profile shows `MISSING`.
8. A finder submits a found-report against the tag — no account needed.
9. The owner receives an in-app notification (`GET /notifications`) that the pet was found.
10. Owner marks the pet found → it drops out of the public lost list and the profile shows `SAFE` again.

### 1. Register 🌐
`POST /auth/register`

```json
// request
{ "fullName": "Sarah Ahmed", "email": "sarah@example.com", "password": "StrongPass123" }
```
```json
// 201 response data
{ "message": "Verification code sent to your email.", "email": "sarah@example.com", "status": "PENDING_VERIFICATION" }
```
- `400` — validation failed (password needs ≥8 chars, one letter + one number).
- `409` — email already belongs to a **verified** account. (A pending/unverified duplicate silently resends the code instead of erroring — same `201` response.)
- No `accessToken` here. Route the UI to an OTP-entry screen, not to a logged-in state.

### 2. Verify OTP 🌐
`POST /auth/verify-otp`

```json
// request
{ "email": "sarah@example.com", "otp": "123456" }
```
```json
// 200 response data
{
  "accessToken": "eyJhbGciOi...",
  "user": { "id": "64f...", "fullName": "Sarah Ahmed", "email": "sarah@example.com", "role": "USER", "status": "ACTIVE" }
}
```
- `400` — wrong/expired code, or too many failed attempts (`Too many incorrect attempts...` — forces a resend). Same generic message for "wrong code" and "no such pending account," by design (anti-enumeration) — don't try to tell them apart in the UI copy.
- The code is 6 digits, valid 10 minutes. `POST /auth/resend-otp` (`{ email }`) issues a new one, subject to a 60s cooldown (also returns a generic message either way, so don't infer account existence from its response).
- Store `accessToken` (e.g. in memory + a refresh strategy of your choosing — note the backend does **not** yet have a working `/auth/refresh` endpoint; see Known Gaps below). Send it as `Authorization: Bearer <accessToken>` on every 🔒 call from here on.

### 3. Create a pet 🔒
`POST /pets`

```json
// request — only name + species are required
{ "name": "Milo", "species": "Cat", "breed": "Persian" }
```
```json
// 201 response data
{ "_id": "64f...", "owner": "64e...", "name": "Milo", "species": "Cat", "breed": "Persian", "isLost": false, "scanCount": 0, "profileImage": "", "createdAt": "...", "updatedAt": "..." }
```
- `400` — validation failed.
- Optional fields worth a form: `gender`, `color`, `birthDate` (ISO date string), `weight` (kg), `notableTrait` (≤200 chars — shown on the *public* scan profile, e.g. "Friendly but startles easily").
- Photo isn't part of this call — see `POST /pets/{id}/photo` (multipart, separate endpoint) once the pet exists.

### 4. Create + assign a QR tag 🔒
Two calls. `POST /tags` generates the tag (unlinked); `POST /tags/assign` links it to a specific pet.

`POST /tags`
```json
// request
{ "redirectBaseUrl": "https://your-frontend.app/qr/" }
```
```json
// 201 response data
{ "_id": "64f...", "publicCode": "PT8F2K91", "ownerId": "64e...", "linkUrl": "https://your-frontend.app/qr/PT8F2K91", "status": "AVAILABLE", "qrImageUrl": "/uploads/qrcodes/PT8F2K91.png", "assignedPetId": null }
```
`redirectBaseUrl` is **your frontend's own QR-landing route** — the backend appends the generated code to it and encodes that full URL into the QR image itself. `qrImageUrl` is the rendered PNG you'd show/print; `publicCode` is what your frontend's `/qr/:code` route should read and call `GET /public/tags/:publicCode` with (see Step 5).

`POST /tags/assign`
```json
// request
{ "publicCode": "PT8F2K91", "petId": "64f..." }
```
```json
// 201 response data — same Tag shape as above, with status/assignedPetId updated
{ "...": "...", "status": "ASSIGNED", "assignedPetId": "64f..." }
```
- `400` — the tag isn't `AVAILABLE` (already assigned/suspended/retired), **or** the target pet already has an active tag (a pet can only have one at a time — unassign first via `POST /tags/unassign` with `{ "publicCode": "..." }`).
- `403` — the tag exists but belongs to a different owner. `404` — tag or pet not found.
- `GET /tags/mine` 🔒 lists every tag the caller owns regardless of status — use it to build a tag-inventory screen.

### 5. Public scan 🌐
`GET /public/tags/:publicCode` — **this is the route your frontend's QR-landing page (`redirectBaseUrl` + code) must call.** No auth, ever.

```json
// 200 response data — pet currently linked and ASSIGNED
{
  "tagStatus": "ASSIGNED",
  "petStatus": "SAFE",
  "name": "Milo", "species": "Cat", "breed": "Persian", "gender": "", "color": "",
  "birthDate": null, "weight": null, "notableTrait": null,
  "isLost": false, "profileImage": "",
  "lastSeenLocation": null, "lostDate": null, "lostDescription": null, "reward": null,
  "emergencyContact": null
}
```
This response **never** contains the pet's or owner's internal id, or any owner-identifying field (`_id`, `owner`, email, etc.) — verified by a dedicated regression test. Safe to render directly to an anonymous finder.

Four other shapes the same endpoint can return, all still `200` — **branch your UI on `tagStatus`, not on HTTP status**:
```json
{ "tagStatus": "AVAILABLE", "message": "This QR is not linked to a pet." }   // code exists but was never assigned, OR doesn't exist at all
{ "tagStatus": "MANUFACTURED", "message": "This QR is not linked to a pet." }   // admin-manufactured inventory (Flow 2), not yet claimed by anyone — see Flow 2 step 2
{ "tagStatus": "SUSPENDED", "message": "This tag has been suspended." }
{ "tagStatus": "RETIRED",   "message": "This tag has been retired and is no longer in use." }
```
(`MANUFACTURED` added in Phase 7 — see Flow 2.)
`petStatus` is only present when `tagStatus === "ASSIGNED"`; it's `"MISSING"` or `"SAFE"`, driven directly by `isLost` — use it for copy/urgency styling rather than re-deriving it from `isLost` yourself. Rate-limited (`public` tier) — handle `429`.

`GET /public/lost-pets` 🌐 — no params, returns every currently-lost pet:
```json
{ "publicCode": "PT8F2K91", "name": "Milo", "species": "Cat", "breed": "Persian", "profileImage": "", "lastSeenLocation": "Dhanmondi, Dhaka", "reward": 50, "lostDate": "2026-08-24T..." }
```
`publicCode` is `null` on an entry if the pet is lost but (edge case) its tag isn't currently assigned — guard for that before building a scan-link from it.

### 6. Report lost 🔒
`PATCH /pets/{id}/report-lost`

```json
// request — all three required, reward optional
{ "lastSeenLocation": "Dhanmondi, Dhaka", "lostDescription": "Last seen near Road 27, wearing a red collar.", "emergencyContact": "+8801XXXXXXXXX", "reward": 50 }
```
```json
// 200 response data — full updated Pet, isLost now true, lostDate stamped
{ "...": "...", "isLost": true, "lostDate": "2026-08-24T...", "lastSeenLocation": "Dhanmondi, Dhaka" }
```
`404` if the pet id doesn't exist *or* isn't the caller's (see Conventions). `PATCH /pets/{id}/report-found` (no body) reverses this — clears `lostDate`/`lastSeenLocation`/`lostDescription`/`reward` and sets `isLost: false`.

### 7 & 8. Anonymous found-report 🌐
`POST /public/tags/:publicCode/found-report` — **multipart/form-data**, not JSON (it accepts an optional photo).

Fields: `message` (required), `deviceFingerprint` (required — a client-generated, localStorage-persisted opaque id, used only for spam rate-limiting, never tied to an account), `approxLocation` (optional), `contactInfo` (optional, lets the owner reach the finder back), `photo` (optional file, ≤5MB, jpeg/png/webp).

```json
// 201 response data — deliberately minimal; never echoes back an internal id
{ "message": "Thanks — the owner has been notified." }
```
- `400` — validation failed, or the tag isn't currently linked to a pet.
- `404` — no such tag code.
- `429` — this specific device already reported this tag in the last 10 minutes, or has hit its hourly cap across all tags. Show a friendly "you already reported this" rather than a generic rate-limit message when you can distinguish it (the `message` field text differs between the two cases — check it if you want separate copy).

### 9. Owner notification feed 🔒
`GET /notifications?page=1&limit=20&unreadOnly=false`

```json
// 200 response data
{
  "notifications": [
    {
      "_id": "64f...", "user": "64e...", "pet": "64f...",
      "type": "found-report.created",
      "title": "Milo was found!", "message": "Someone reported finding Milo.",
      "data": { "petId": "64f...", "petName": "Milo", "foundReportId": "64f...", "message": "..." },
      "readAt": null, "priority": "critical", "expiresAt": null,
      "createdAt": "2026-08-24T..."
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```
The full set of `type` values you'll see: `pet.marked-lost`, `pet.marked-found`, `tag.assigned`, `tag.unassigned`, `qr.tag-scanned`, `found-report.created`, `vaccination.reminder-due`. Only `pet.marked-lost`, `pet.marked-found`, `found-report.created`, and `vaccination.reminder-due` also send an email — the rest are in-app-only, so don't build a "resend as email" affordance for tag/scan notifications.

`priority` (`transient` | `standard` | `stale_missing` | `critical`) drives how long a notification survives server-side before auto-cleanup, not something the frontend needs to act on directly — but `critical` is a reasonable signal for a red/urgent badge, since it means "this pet is still missing and something just happened."

**Timing note:** notifications are created asynchronously (a fire-and-forget domain event, not part of the triggering request/response cycle). If you poll right after step 8 in an automated test or a "did it work" UI check, allow for a short delay — don't assume it's there the instant the found-report call returns.

`PATCH /notifications/{id}/read` 🔒 and `PATCH /notifications/read-all` 🔒 mark as read; `DELETE /notifications/{id}` 🔒 and `DELETE /notifications` 🔒 (body `{ "ids": [...] }`) delete regardless of priority.

### 10. Mark found 🔒
`PATCH /pets/{id}/report-found` — see step 6 for the reverse direction. No body. `200`, returns the pet with `isLost: false`.

### Known gaps to design around (as of Phase 6)
- **No working refresh-token flow yet.** `RefreshTokenDto` and the relevant secrets exist in config, but no `/auth/refresh` endpoint is implemented. Don't build a silent-refresh flow against it yet — treat the access token as the only credential, sized for its actual expiry (`JWT_EXPIRES`, currently a config value, ask backend for the current value), and re-prompt login when it expires.
- **No admin tag-inventory bulk endpoints yet** (Phase 7) — the tag creation flow above is strictly self-service/one-at-a-time.
- **QR image content vs. your route:** `qrImageUrl` from `POST /tags` is a rendered PNG of `linkUrl`, which is *your* `redirectBaseUrl` + the code — the backend never redirects a scan itself. Your frontend's route at that path is what calls `GET /public/tags/:publicCode`; there's no server-side redirect to configure.

---

## Flow 2 — Admin Tag Inventory & Abuse Review

**What this covers:** the admin/operator side of spec §24 — manufacturing a batch of physical QR tags before anyone owns them, a user claiming a manufactured tag into their own name, reviewing finder reports flagged as spam/malicious, and every one of those actions (plus the tag-lifecycle actions from Flow 1) showing up in an audit log. Proven end-to-end by `test/admin-audit-flow.e2e-spec.ts` (real HTTP, real database) — see the Phase 7 entry in `PAWTATO_ROADMAP.md`.

**Every route in this flow is 🔒, and every route except claim additionally requires the caller's JWT to carry `role: "ADMIN"`** — a non-admin token gets `403`, not `404` (unlike the ownership-IDOR convention in Flow 1, this is a real role check, so it's fine for the UI to distinguish "you're not an admin" from "not found").

**Becoming an admin isn't self-service.** There is no signup flow that grants `ADMIN` — an existing account's `role` field has to be changed directly (either by another admin via `PATCH /admin/users/{id}/role`, or, for the very first admin, direct DB access). If you're building an admin panel, assume its users already have `ADMIN` tokens by the time they reach it; don't build a "become an admin" screen against this API.

**Sequence:**
1. An operator (already `ADMIN`) manufactures a batch of unowned tags — the physical print run exists before any customer owns one.
2. A user claims one of those tags into their own name using its printed code — no different from how they'd receive a physical sticker in the mail.
3. From here on, the tag behaves exactly like a self-service-created tag from Flow 1 — assign it to a pet, it gets scanned, a finder reports it.
4. An admin reviews the found-report moderation queue and marks a report `REVIEWED`, `DISMISSED`, or `ACTIONED`.
5. Independently, an admin can force-suspend or retire *any* tag (not just ones tied to a report) — e.g. a tag reported as fraudulent that never went through the found-report flow at all.
6. An admin can block/unblock a user, change their role, or delete their account (a full cascade — see step 6 below) or an individual pet.
7. Everything above is now visible in `GET /activity`, filterable by who did it and what they did.

### 1. Bulk-manufacture tags 🔒 (admin only)
`POST /tags/bulk`

```json
// request
{ "count": 50, "redirectBaseUrl": "https://your-frontend.app/qr/", "batchLabel": "2026-08 print run #3" }
```
```json
// 201 response data — array of Tag, every one starting MANUFACTURED with no owner
[
  { "_id": "64f...", "publicCode": "PT9K2A44", "ownerId": null, "status": "MANUFACTURED", "batchLabel": "2026-08 print run #3", "qrImageUrl": "/uploads/qrcodes/PT9K2A44.png", "linkUrl": "https://your-frontend.app/qr/PT9K2A44" }
]
```
`count` is capped at 500 per call. `redirectBaseUrl` works exactly like Flow 1's `POST /tags` — the backend builds each tag's `linkUrl` from it plus a generated code and renders the QR PNG at creation time, before anyone owns the tag. `batchLabel` is optional and purely for the admin's own print-run bookkeeping — never shown to an end user. `403` for a non-admin caller.

### 2. Claim a manufactured tag 🔒
`POST /tags/claim`

```json
// request
{ "publicCode": "PT9K2A44" }
```
```json
// 201 response data — same Tag shape, now owned and AVAILABLE
{ "...": "...", "status": "AVAILABLE", "ownerId": "64e..." }
```
Any authenticated user can call this — it's the counterpart to Flow 1's self-service `POST /tags`, for a tag that started as admin-manufactured inventory instead. `400` if the code doesn't currently point at unclaimed `MANUFACTURED` inventory (already claimed, or was self-service-created and therefore never had this state at all). Once claimed, the tag is indistinguishable from a self-service one — assign it via the same `POST /tags/assign` from Flow 1.

**Scan-time note:** a `MANUFACTURED`, not-yet-claimed tag can still be scanned publicly — see the updated Flow 1 step 5 (`GET /public/tags/:publicCode`), which now documents five possible `tagStatus` values instead of four.

### 3. Review the found-report moderation queue 🔒 (admin only)
`GET /admin/found-reports?page=1&limit=10&status=PENDING`

```json
// 200 response data
{
  "foundReports": [
    {
      "_id": "64f...", "tag": "64f...", "pet": { "_id": "64f...", "name": "Milo", "species": "Cat" },
      "message": "Spam link: definitely-not-a-scam.example", "deviceFingerprint": "abc123...",
      "status": "PENDING", "reviewedBy": null, "reviewedAt": null,
      "approxLocation": null, "contactInfo": null, "photoUrl": null,
      "foundAt": "2026-08-24T...", "createdAt": "2026-08-24T..."
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 10, "totalPages": 1 }
}
```
Every finder-submitted report ever recorded, across every owner — unlike Flow 1's `GET /pets/{petId}/found-reports` (scoped to one owner's pet), this is the global moderation view. `status` and `deviceFingerprint` are both optional filters; the latter is the useful one for spotting abuse — pull every report from one device across every tag it's touched, using the same fingerprint value the Phase 3 spam rate-limiter already keys on.

### 4. Update a found report's moderation status 🔒 (admin only)
`PATCH /admin/found-reports/{id}/status`

```json
// request
{ "status": "DISMISSED" }
```
```json
// 200 response data — the updated FoundReport, reviewedBy/reviewedAt now stamped
{ "...": "...", "status": "DISMISSED", "reviewedBy": "64e...", "reviewedAt": "2026-08-24T..." }
```
`REVIEWED` = looked at, legitimate. `DISMISSED` = spam/not credible, no further action. `ACTIONED` = spam/malicious and something was done about it. **This call never itself suspends the associated tag** — if a report warrants that, pair it explicitly with step 5 below. `404` for an unknown report id.

### 5. Force-suspend / retire a tag 🔒 (admin only)
`PATCH /tags/{id}/suspend` and `PATCH /tags/{id}/retire` — unchanged from Flow 1/Phase 2 (no request body, returns the updated `Tag`), included here because it's the other half of abuse handling: usable on *any* tag, whether or not a found-report ever triggered it. A suspended/retired tag's public scan response changes to `{ "tagStatus": "SUSPENDED", ... }` / `"RETIRED"` immediately.

### 6. User & pet moderation 🔒 (admin only)
`PATCH /admin/users/{id}/block`, `PATCH /admin/users/{id}/unblock`, `PATCH /admin/users/{id}/role` — pre-existing from the Phase 1 baseline, included here because Phase 7 is what made them start writing to the audit log. A blocked user's **existing access token stops working immediately** (`401`, not just a future-login block) — `JwtStrategy` checks `isActive` on every request, not just at login.

**`DELETE /admin/users/{id}` is a real, irreversible cascade delete — build a strong confirmation dialog around it, not a routine "delete row" affordance.** Deleting a user now deletes *everything connected to them*, not just the account: every pet they own, every tag they own (assigned to one of those pets or not), every medical record/vaccination/scan/found-report tied to those pets/tags, every in-app notification addressed to them, and every stored file along the way (their avatar, their pets' photos, their tags' QR images, the found-reports' photos). None of that is soft-deleted or recoverable — there is no "undo," no trash/archive state, and no confirmation step server-side; the frontend confirmation dialog *is* the safety net. Response shape is unchanged (`{ "message": "User deleted successfully" }`), but it now `404`s for an unknown id (previously it silently "succeeded" even for a nonexistent user — don't rely on old integration code that assumed a bare `200` always meant something was actually deleted).

```json
// 200 response data
{ "message": "User deleted successfully" }
```
- `404` — no user with that id (new as of this fix — previously always `200`).
- `403` — caller isn't an admin.
- The resulting `admin.user.deleted` audit-log entry's `metadata` now carries `{ "deletedPetCount": <n>, "deletedTagCount": <n> }` — useful if you want to show "this also removed N pets and N tags" in an admin-side confirmation toast after the fact.

**`DELETE /admin/pets/{id}` cascades the same way, scoped to just that one pet** — its assigned tag (and QR image), its medical records, vaccinations, scan history, found reports, and its own photo file are all deleted, without touching the owner's other pets/tags. Same response shape (`{ "message": "Pet deleted successfully" }`), same new `404` for an unknown id, and the `admin.pet.deleted` audit entry's `metadata` carries `{ "deletedTagCount": <n> }`.

**What's *not* touched by either cascade** (worth knowing if your admin UI cross-references the audit log): existing `Activity` entries where the deleted user/pet is the actor or target are kept, not purged — the audit trail is meant to outlive the account/pet it describes, so `GET /activity` can still show history for an id that no longer resolves to anything via `GET /admin/users/{id}` or `GET /admin/pets/{id}`. Handle that gracefully (e.g. render `"[deleted user]"` rather than erroring) if you build a detail link from an audit-log row.

**Known gap:** an *owner's own* self-service `DELETE /pets/{id}` (Flow 1) does **not** get this same cascade — it only deletes the pet document and its photo file; the pet's tag, medical records, vaccinations, scans, and found reports are currently left behind. Don't assume parity between the two delete endpoints in your UI copy (e.g. don't tell a regular user "this will also remove its tag" — it won't, yet).

### 7. Audit log 🔒 (admin only)
`GET /activity?page=1&limit=20&actor=64e...&action=tag.suspended`

```json
// 200 response data
{
  "activities": [
    {
      "_id": "64f...", "actor": { "_id": "64e...", "fullName": "Ops Admin", "email": "admin@example.com" },
      "action": "tag.suspended", "target": "64f...", "metadata": { "publicCode": "PT9K2A44" },
      "createdAt": "2026-08-24T..."
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```
Covers both admin-panel actions (`admin.user.blocked`, `admin.user.unblocked`, `admin.user.role-changed`, `admin.user.deleted`, `admin.pet.recovered`, `admin.pet.deleted`, `tag.suspended`, `tag.retired`, `tag.bulk-created`, `found-report.status-changed`) and sensitive self-service actions performed by any user (`tag.assigned`, `tag.unassigned`, `tag.deleted`, `tag.claimed`, `pet.marked-lost`, `pet.marked-found`) — `actor` is whoever performed the action, not necessarily an admin. Both `actor` (a user id) and `action` (an exact string, see the list above) are optional filters. `target` is the affected resource's id as a plain string (a `Tag`/`Pet`/`User` id depending on `action`) — not populated into an object, unlike `actor`.

---

## Flow 3 — Pet Dating & Companion Matching

**What this covers:** an owner opts one of their pets into a swipe-to-match feature (Tinder-style, not part of the original product spec — see the Phase 10 provenance note in `PAWTATO_ROADMAP.md`). A pet's profile declares a **purpose** (`PLAYDATE`, `BREEDING`, or `BOTH`); discovery and swiping only ever surface/permit purpose-compatible, same-species pets. A mutual `LIKE` creates a `Match` immediately (no polling), matched owners get a lightweight in-app chat, either side can unmatch, and anyone can report a profile — feeding the same admin moderation pattern Flow 2 established for found reports. Proven end-to-end by `test/pet-dating-flow.e2e-spec.ts` (real HTTP, real database) — see the Phase 10 entry in `PAWTATO_ROADMAP.md`.

**Only cats and dogs can opt in.** `Pet.species` is a free-text field everywhere else in the API (no enum), but this module rejects `POST /pets/{petId}/dating-profile` with `400` for anything that isn't `cat`/`dog` (case-insensitive). Don't offer the "create a dating profile" action in your UI for other species.

**Sequence:**
1. Owner creates a dating profile for a pet (must already exist as a `Pet`) — declares `purpose` and optional bio/photos/location.
2. *(BREEDING/BOTH only, optional)* Owner requests health verification — the backend checks the pet already has real medical + vaccination records before flipping the badge on; it's never just a checkbox the owner controls.
3. Owner calls discover with one of their own pets to get a page of compatible candidates.
4. Owner swipes `LIKE` or `PASS` on a candidate. A `LIKE` that the other side already reciprocated creates a `Match` in the same response.
5. Both owners see the match in their matches list and can exchange messages.
6. Either owner can unmatch at any time, ending the thread.
7. Anyone can report a pet's dating profile; an admin reviews the queue and can deactivate the reported profile independently of the report's status (same "two separate actions, not auto-cascaded" pattern as Flow 2's found-report review + tag-suspend).

### 1. Create / update a dating profile 🔒
`POST /pets/{petId}/dating-profile` and `PATCH /pets/{petId}/dating-profile` — owner-only, same `404` ownership convention as every other `pets/{id}/...` sub-resource in Flow 1.

```json
// POST request
{ "purpose": "PLAYDATE", "bio": "Loves chasing string.", "temperamentTags": ["playful", "good-with-kids"], "approxLocation": "Dhanmondi, Dhaka" }
```
```json
// 201 response data
{
  "_id": "64f...", "petId": "64f...", "purpose": "PLAYDATE",
  "bio": "Loves chasing string.", "temperamentTags": ["playful", "good-with-kids"],
  "photos": [], "approxLocation": "Dhanmondi, Dhaka",
  "isActive": true, "healthVerified": false,
  "createdAt": "2026-08-25T...", "updatedAt": "2026-08-25T..."
}
```
- `400` — validation failed, the pet's species isn't cat/dog, or this pet already has a profile (one profile per pet — use `PATCH` after the first `POST`).
- `404` — pet not found or not owned by the caller.
- `photos` takes plain URLs, not a file upload — reuse the same upload endpoint you already call for pet photos (`POST /pets/{id}/photo`) or avatars, then paste the resulting URL in here. This module has no dedicated photo-upload route of its own.
- `PATCH` accepts any subset of the same fields, plus `isActive` (pause/resume visibility without deleting the profile or its match history).

### 2. Verify health records (BREEDING/BOTH only) 🔒
`PATCH /pets/{petId}/dating-profile/verify-health` — no body.

```json
// 200 response data — same profile shape, healthVerified now true
{ "...": "...", "healthVerified": true }
```
- `400` — the profile is `PLAYDATE`-only (verification doesn't apply), or the pet is missing a medical record and/or a vaccination record. Add at least one of each first (`POST /pets/{petId}/medical-records`, `POST /pets/{petId}/vaccinations` — see Flow 1's sibling endpoints) before calling this.
- There is no way to set `healthVerified` directly through create/update — it only ever becomes `true` via this endpoint, and only once the backend has re-checked the records itself. Don't build a client-side toggle for it.

### 3. Discover candidates 🔒
`GET /dating/discover?petId=64f...&page=1&limit=10`

```json
// 200 response data
{
  "profiles": [
    {
      "_id": "64f...",
      "petId": { "_id": "64f...", "name": "Milo", "species": "Cat", "breed": "Persian", "profileImage": "" },
      "purpose": "PLAYDATE", "bio": "Enjoys sunny windowsills.",
      "temperamentTags": ["calm"], "photos": [], "isActive": true, "healthVerified": false
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 10, "totalPages": 1 }
}
```
- `400` — the swiping pet (`petId`) has no dating profile yet, or its profile is currently paused (`isActive: false`) — create/activate one first.
- Server-enforced, not just a UI filter: same species as `petId`'s pet, purpose-compatible (`BOTH` matches anything; otherwise the two `purpose` values must be equal), excludes the caller's own pets, excludes anything `petId` has already swiped (in either direction — a pet can never be swiped on twice), and only pets whose own profile is `isActive: true`.
- `petId` inside each candidate is *populated* (an object, not a bare id) with only `name`/`species`/`breed`/`profileImage` — never the candidate's owner, contact info, or exact location. Nothing about who owns a candidate is knowable before a match exists.

### 4. Swipe 🔒
`POST /dating/swipe`

```json
// request
{ "fromPetId": "64f...", "toPetId": "64f...", "action": "LIKE" }
```
```json
// 201 response data — no reciprocal like yet
{ "swipe": { "_id": "64f...", "fromPetId": "64f...", "toPetId": "64f...", "action": "LIKE", "createdAt": "..." }, "match": null }
```
```json
// 201 response data — the other pet had already LIKEd fromPetId: a Match exists immediately
{ "swipe": { "...": "..." }, "match": { "_id": "64f...", "petAId": "64f...", "petBId": "64f...", "matchedAt": "2026-08-25T...", "status": "ACTIVE" } }
```
- `400` — `fromPetId`/`toPetId` are the same pet, this pet already swiped `toPetId` before (swipes are one-time — there's no re-swiping the same pet even after an unmatch), species don't match, purposes are incompatible, or either profile is inactive/missing.
- `404` — `toPetId` doesn't exist.
- **This is the one endpoint in this module with its own throttle tier** (`swipe`, 60 requests/min per caller — more permissive than the `write` tier used elsewhere, since swiping is a fast, repeated real-user interaction, not a one-off write). Handle `429` the same generic way as every other rate-limited route.
- `petAId`/`petBId` on a `Match` are stored in a fixed (canonical) order and are **not** guaranteed to put the caller's own pet first — don't assume `petAId` is "mine"; check both against the pet ids you own.
- Concurrency is handled server-side: if both sides' `LIKE` requests race, you'll still only ever get back one, shared `Match` document — never a duplicate.

### 5. List matches 🔒
`GET /dating/matches` — no pagination (bounded by how many pets/matches one account realistically has).

```json
// 200 response data — a bare array, not the {items, pagination} shape
[
  {
    "_id": "64f...",
    "petAId": { "_id": "64f...", "name": "Milo", "species": "Cat", "breed": "Persian", "profileImage": "" },
    "petBId": { "_id": "64f...", "name": "Bella", "species": "Cat", "breed": "", "profileImage": "" },
    "matchedAt": "2026-08-25T...", "status": "ACTIVE"
  }
]
```
Only `status: "ACTIVE"` matches are returned — an unmatched pair simply stops appearing here (there's no "past matches" archive view yet). Across all of the caller's own pets, not just one.

### 6. Messages 🔒
`GET /dating/matches/{matchId}/messages`, `POST /dating/matches/{matchId}/messages`

```json
// POST request
{ "content": "Hi! Milo would love a playdate this weekend." }
```
```json
// 200 (GET) / 201 (POST) response data
[
  { "_id": "64f...", "matchId": "64f...", "senderUserId": "64e...", "content": "Hi! Milo would love a playdate this weekend.", "readAt": null, "createdAt": "2026-08-25T..." }
]
```
- `404` — unknown match id, **or** the caller owns neither side of it — same IDOR-safe convention as Flow 1 (never a distinguishing `403`).
- `400` (POST only) — this match has already ended (`status: "UNMATCHED"`); no new messages can be sent, though existing ones remain readable via GET.
- GET returns the full thread oldest-first, no pagination — this is intentionally lightweight, not a full chat system (no read receipts UI beyond the stored `readAt`, no typing indicators, no attachments).

### 7. Unmatch 🔒
`POST /dating/matches/{matchId}/unmatch` — no body.

```json
// 201 response data
{ "message": "Unmatched successfully" }
```
`404` under the same IDOR-safe rule as messages. Either side can do this unilaterally — there's no confirmation/cooldown/re-match flow; once unmatched, that specific pet pair can never match again (swipes are one-time, see step 4).

### 8. Report a profile 🔒
`POST /dating/report`

```json
// request
{ "targetPetId": "64f...", "reason": "Profile photos are of a different animal." }
```
```json
// 201 response data
{ "message": "Report submitted. Our team will review it." }
```
`404` — the target pet doesn't exist, or it has no dating profile to report. Any authenticated user can report any pet's profile, not just ones they've matched or interacted with.

### 9. Admin moderation 🔒 (admin only)
`GET /admin/dating/reports?page=1&limit=10&status=PENDING`
```json
// 200 response data
{
  "reports": [
    {
      "_id": "64f...", "reporterUserId": "64e...",
      "targetPetId": { "_id": "64f...", "name": "Milo", "species": "Cat" },
      "reason": "Profile photos are of a different animal.",
      "status": "PENDING", "reviewedBy": null, "reviewedAt": null,
      "createdAt": "2026-08-25T..."
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 10, "totalPages": 1 }
}
```

`PATCH /admin/dating/reports/{id}/status` — body `{ "status": "REVIEWED" | "ACTIONED" }` (no `DISMISSED` state here, unlike Flow 2's found reports — a dating report is either looked-at-and-fine (`REVIEWED`) or acted on (`ACTIONED`)). Stamps `reviewedBy`/`reviewedAt`; `404` for an unknown report id. **Does not itself deactivate the reported profile** — pair with the next endpoint when warranted.

`PATCH /admin/dating/profiles/{petId}/deactivate` — no body. Sets `isActive: false` on that pet's profile; it drops out of `discover()` immediately. `404` if the pet has no dating profile. Existing matches/messages involving that profile are left completely untouched — deactivating doesn't unmatch anyone.

### Known gaps to design around (as of Phase 10)
- **No "past matches" or unmatch history view** — an unmatched pair simply disappears from `GET /dating/matches`; there's no archive endpoint if you want to show "previously matched" in the UI.
- **No push/email notification for a new match or message** — this module is in-app-only end to end (unlike Flow 1's `pet.marked-lost`/`found-report.created`, nothing here triggers `NotificationsService`). If you want a badge/alert for "new match" or "new message," you'll need to poll `GET /dating/matches` / the messages endpoint yourself for now.
- **No read-receipt UI affordance** — `Message.readAt` exists on the schema but nothing currently sets it (no `PATCH .../messages/{id}/read` route). Treat it as reserved for a future phase.

---

## Changelog

- **2026-08-24** — File created. Documented Flow 1 (Lost & Found), the first flow to be e2e-verified (Phase 6).
- **2026-08-24** — Documented Flow 2 (Admin Tag Inventory & Abuse Review), e2e-verified in Phase 7. Also updated Flow 1 step 5 (`GET /public/tags/:publicCode`) in place: Phase 7 added a fifth possible `tagStatus` value, `MANUFACTURED`, for admin-manufactured inventory no one has claimed yet (see Flow 2 step 2).
- **2026-08-25** — Updated Flow 2 step 6 in place (ad-hoc backend fix, not a new roadmap phase): `DELETE /admin/users/{id}` now cascades — deleting a user also deletes every pet/tag they own and everything tied to those (medical records, vaccinations, scans, found reports, notifications), plus every stored file (avatar, photos, QR images). `DELETE /admin/pets/{id}` got the same cascade scoped to one pet. Both now `404` for an unknown id, where they previously always returned `200` even for a nonexistent one — a breaking behavior change for any integration that relied on the old silent-success response. Response shape (`{ "message": "..." }`) is unchanged; the corresponding `admin.user.deleted`/`admin.pet.deleted` audit-log entries gained `deletedPetCount`/`deletedTagCount` metadata. e2e-verified by `test/admin-user-deletion-cascade.e2e-spec.ts`. Also flagged a known gap: the owner's own self-service `DELETE /pets/{id}` (Flow 1) still doesn't cascade the same way — only its photo file is cleaned up.
- **2026-08-25** — Documented Flow 3 (Pet Dating & Companion Matching), e2e-verified in Phase 10 the same day the phase was built. Covers dating-profile create/update, the health-verification action, purpose/species-filtered discovery, swipe-to-match (with its own more permissive `swipe` throttle tier), matches, lightweight in-app messaging, unmatching, abuse reporting, and the admin moderation surface (`GET /admin/dating/reports`, status updates, profile deactivation). Called out that the admin-delete-user/pet cascade documented in the entry above now also covers every dating collection this flow introduces (profiles, swipes, matches, messages, reports) — deleting a user or pet cleans up their dating data too, not just pets/tags. Flagged three known gaps: no past-matches archive, no push/email notification for new matches or messages (in-app only), and `Message.readAt` exists on the schema but nothing sets it yet.
