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

Three other shapes the same endpoint can return, all still `200` — **branch your UI on `tagStatus`, not on HTTP status**:
```json
{ "tagStatus": "AVAILABLE", "message": "This QR is not linked to a pet." }   // code exists but was never assigned, OR doesn't exist at all
{ "tagStatus": "SUSPENDED", "message": "This tag has been suspended." }
{ "tagStatus": "RETIRED",   "message": "This tag has been retired and is no longer in use." }
```
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

## Changelog

- **2026-08-24** — File created. Documented Flow 1 (Lost & Found), the first flow to be e2e-verified (Phase 6).
