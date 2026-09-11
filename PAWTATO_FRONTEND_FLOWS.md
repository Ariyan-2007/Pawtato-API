# Pawtato Frontend API Flows

This file is the **behavior companion** to `PAWTATO_FRONTEND_BLUEPRINT.md` and `PAWTATO_ROADMAP.md`. The Blueprint is about *layout* (what a screen looks like, for the Dating module in full detail); this file is about **API behavior** — for every module, exactly which endpoints exist, what request body they expect, what response they return, and the order you call them in to build a real flow. Written for a frontend engineer with zero prior context on this backend.

This file was referenced by name since Phase 11 (the Blueprint's own header, and the Roadmap's Phase 11 log entry) but never actually existed until now — written in Phase 20, verified directly against the current controllers/DTOs/services, not reconstructed from the roadmap's prose.

## How to use this file

- Every example below is real: field names, validators, and response shapes are read directly from the actual `@Controller`/DTO/service code, not guessed.
- For the Dating module, this file gives you an endpoint map only — full screen-by-screen flow detail already lives in `PAWTATO_FRONTEND_BLUEPRINT.md`'s Dating Module section. Don't duplicate that reasoning here; go there for "what happens when the user taps X."
- Base path: every route below is relative to the API's global prefix (`API_PREFIX`, `api` by default) — e.g. `POST /auth/login` is really `POST /api/auth/login`.
- Auth: unless a section says "no authentication required," every route needs `Authorization: Bearer <accessToken>`.

## The response envelope

Every successful response (any 2xx) is wrapped by a global interceptor:

```json
{
  "success": true,
  "message": "Request successful",
  "data": { /* the actual payload — this is what every example below shows */ }
}
```

**Every JSON example in this file shows the `data` value only** — unwrap the envelope to get it. `message` is always the literal string `"Request successful"`; it does not vary by endpoint (do not build UI copy from it).

Every error response (any 4xx/5xx) has a different, consistent shape — not wrapped in the envelope above:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed" ,
  "error": "BadRequestException",
  "path": "/api/pets",
  "timestamp": "2026-08-30T12:00:00.000Z"
}
```

`message` is a `string` for most errors, but a `string[]` for `class-validator` DTO failures (one entry per failed field/rule) — handle both.

---

## 1. Auth

Base path: `/auth`. Register/login/verify-otp/refresh are all **not** guarded (no bearer token needed to call them); `GET /auth/me` requires a bearer token.

### 1.1 Register

`POST /auth/register` — throttled 5/min.

Request (`RegisterDto`):
```json
{
  "fullName": "Sarah Ahmed",
  "email": "sarah@example.com",
  "password": "StrongPass123"
}
```
Validation: `fullName` required, ≤150 chars. `email` valid email, ≤254 chars. `password` 8–128 chars, must contain at least one letter and one digit (no other complexity rule).

No access token is issued here. Response (201):
```json
{ "message": "Verification code sent to your email.", "email": "sarah@example.com", "status": "PENDING_VERIFICATION" }
```

Behavior notes:
- If the email already belongs to a **verified** account: `409 Conflict`.
- If the email already has a **pending** (unverified) account: no new account is created — a fresh OTP is (re-)sent instead, subject to the 60s resend cooldown, and the same `200`-shaped response comes back.
- The OTP is emailed via the branded Pawtato HTML template (not plain text) — see §9.4 for the shared template system.

### 1.2 Verify OTP

`POST /auth/verify-otp` — throttled 10/min. Completes both post-registration verification and the pending-account-login flow below.

Request (`VerifyOtpDto`):
```json
{ "email": "sarah@example.com", "otp": "123456" }
```
`otp` must be exactly 6 digits. OTP is valid 10 minutes, max 5 incorrect attempts before it's invalidated and a new one must be requested.

Response (200) — account is now `ACTIVE`, and you get a full session immediately:
```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "user": {
    "id": "64f...",
    "fullName": "Sarah Ahmed",
    "email": "sarah@example.com",
    "role": "USER",
    "status": "ACTIVE"
  }
}
```
`400` with a generic "Invalid or expired OTP." for: wrong code, expired code, unknown email, already-verified account, or too many attempts — deliberately indistinguishable so the endpoint can't be used to enumerate accounts.

### 1.3 Resend OTP

`POST /auth/resend-otp` — throttled 5/min. `{ "email": "..." }` → always returns the same generic `200` message regardless of whether the email exists or is already verified. Subject to the 60s per-account cooldown (`400` if still cooling down).

### 1.4 Login

`POST /auth/login` — not throttled specially (falls under the global 100/min limit).

Request (`LoginDto`): `{ "email": "sarah@example.com", "password": "StrongPass123" }`

Three distinct outcomes, same `200` status:

1. **Wrong credentials** → `401 Unauthorized`, `"Invalid email or password"`.
2. **Blocked account** (`isActive: false`, an admin action) → `401 Unauthorized`, `"This account has been blocked. Please contact support."`.
3. **Correct credentials, account still `PENDING_VERIFICATION`** → `200`, no token, a fresh OTP is sent:
   ```json
   { "verificationRequired": true, "message": "Your email is not verified yet. A verification code has been sent.", "email": "sarah@example.com", "status": "PENDING_VERIFICATION" }
   ```
   Route the user to the OTP screen — call `POST /auth/verify-otp` next.
4. **Correct credentials, account `ACTIVE`** → `200`, the same `{ accessToken, refreshToken, user }` shape as §1.2.

Branch on the *presence* of `accessToken` in the response, not on HTTP status — cases 3 and 4 are both `200`.

### 1.5 Refresh token — real single-use rotation (new this session)

`POST /auth/refresh` — throttled 20/min, no bearer token needed (the refresh token itself is the credential).

Request (`RefreshTokenDto`): `{ "refreshToken": "eyJhbGciOi..." }`

Response (200): identical shape to login/verify-otp — a **brand-new** `{ accessToken, refreshToken, user }` triple.

**How rotation actually works (read this before wiring silent-refresh logic):**
- The refresh token is a separate JWT, signed with its own secret (`jwt.refreshSecret`, distinct from the access token's `jwt.secret`) and carrying `type: "refresh"` in its payload — it can never be confused with or substituted for an access token.
- Real **single-use rotation** is enforced server-side via a `refreshTokenVersion` counter stored on the `User` document. The refresh token you send must carry the version currently on the user; a successful `/auth/refresh` call increments that counter *before* minting the next pair. This means:
  - **The refresh token you just used is immediately rejected if you try it again** — a second call with the same (now-stale) token gets `401`, even though the token hasn't expired yet.
  - Every previously-issued refresh token for that user (e.g. from another device, or a stale one left in storage) becomes invalid the moment any one of them is successfully rotated. There's no separate revocation-list table — the version counter alone does it.
  - Practical implication: **do not fan out multiple concurrent `/auth/refresh` calls with the same stored token** (e.g. two tabs racing on a 401). Only one will win; the other gets `401` and must fall back to a full re-login (or, better, coordinate refresh through one place, e.g. a mutex/singleton promise, or a `BroadcastChannel` between tabs).
  - The same liveness checks an access token gets are re-applied here too: a refresh token minted before the account was blocked, deactivated, or had its password changed will `401` even if it hasn't technically expired.
- Recommended client pattern: on any API call that comes back `401`, attempt exactly one `/auth/refresh` using the stored refresh token; on success, retry the original request with the new access token and overwrite both stored tokens; on failure, clear stored tokens and send the user to login.
- `login` and `verify-otp` also now return `refreshToken` alongside `accessToken` — this is additive, nothing existing was renamed or removed.

### 1.6 Forgot / reset password

`POST /auth/forgot-password` — throttled 5/min. `{ "email": "..." }` → always the same generic `200` message (`"If that email is registered, a password reset link has been sent."`), regardless of whether the email exists. If it does exist, an email is sent with a link to `FRONTEND_URL/reset?token=<token>` (branded template, 1-hour token expiry).

`POST /auth/reset-password` — throttled 5/min. Called from the page the reset-link lands on, reading `token` from the query string.

Request (`ResetPasswordDto`):
```json
{ "token": "<from the reset link query string>", "newPassword": "NewStrongPass123" }
```
`newPassword`: 8–128 chars, at least one letter and one digit. `400` on an invalid/expired token. On success, **every existing session is invalidated** (JWTs issued before the password change stop validating) and a "password changed" receipt email is sent — expect the user's other logged-in devices/tabs to start getting `401`s.

### 1.7 GET /auth/me

Bearer-token required. Returns the **decoded JWT payload**, not a fresh DB read — i.e. `{ sub, email, role, iat, exp }`. If you need the full current profile (avatar, phone, address, etc.), call `GET /users/profile` instead (see §1.8).

### 1.8 Users — own profile (`/users`)

- `GET /users/profile` — the caller's full profile document.
- `PATCH /users/profile` — body: any of `{ fullName?, phone?, address? }` (`UpdateProfileDto`, all optional, string, capped lengths).
- `POST /users/avatar` — multipart, field `file` (image, same size/type limits as pet photos — see §2). Response: `{ "message": "Avatar uploaded successfully", "avatar": "<url>" }`.
- `DELETE /users/avatar` — removes the avatar.

---

## 2. Pets

Base path: `/pets`, all routes bearer-guarded. A pet is accessible to its owner **and** to any authorized caretaker (§7) — most read/mutate routes check "owner or caretaker," a few (delete, photo management) are owner-only per the controller annotations below.

### 2.1 CRUD

- `GET /pets` — array of pets the caller **owns** (not caretaker pets — see §7.2 for those).
- `POST /pets` — create. Request (`CreatePetDto`):
  ```json
  {
    "name": "Milo",
    "species": "Cat",
    "gender": "MALE",
    "breed": "Persian",
    "color": "White",
    "birthDate": "2022-05-01",
    "weight": 4.2,
    "notableTrait": "Friendly but startles easily — approach calmly.",
    "isLost": false
  }
  ```
  **`gender` is required** (`MALE` | `FEMALE`) — platform-wide, not dating-specific in the schema, though it exists to support Breeding-mode's strictly-opposite-gender matching. Missing/invalid `gender` is a `400`. `name`/`species` required; everything else optional.
- `GET /pets/:id` — single pet (owner or caretaker).
- `PATCH /pets/:id` — partial update, same field set as create (`UpdatePetDto` = `PartialType(CreatePetDto)`).
- `DELETE /pets/:id` — owner-only; cascades (tags unassigned, caretaker grants removed, etc. — see the Admin section's cascade notes for the equivalent admin-triggered version).
- `GET /pets/statistics` — aggregate stats for the caller's own pets (registered before `:id` in the router so it isn't swallowed by the `:id` handler).

### 2.2 Photo

- `POST /pets/:id/photo` — multipart, field `file`. Image only (JPEG/PNG/WebP), size-capped. Response: `{ "message": "Photo uploaded successfully", "profileImage": "<url>" }`.
- `DELETE /pets/:id/photo` — removes it.

### 2.3 Report lost / found

`PATCH /pets/:id/report-lost` — callable by owner or caretaker (e.g. a pet-sitter reporting an escape); the **owner** is always the one notified regardless of who calls it.

Request (`ReportLostDto`):
```json
{
  "lastSeenLocation": "Dhanmondi, Dhaka",
  "lostDescription": "Last seen near Road 27, wearing a red collar.",
  "emergencyContact": "+8801XXXXXXXXX",
  "reward": 50,
  "lat": 23.7461,
  "lng": 90.3742
}
```
`lastSeenLocation`, `lostDescription`, `emergencyContact` required (free text — this is what's shown to a finder). `reward` optional number. `lat`/`lng` are **both optional** — supply them only if you have real coordinates; they power the nearby-search endpoint (§5.4). A pet reported lost with only a text location still appears in the plain lost-pets list (§5.3) but never in nearby search.

`PATCH /pets/:id/report-found` — no body. Clears lost state, notifies the owner "glad they're back safe."

### 2.4 Sub-resources scoped under a pet

These all live under `/pets/:petId/...` and share the same access rule (owner or caretaker), `404` if the pet doesn't exist or the caller has no access:

- `GET /pets/:petId/scans` — QR scan history (`ScanEvent[]`, newest first) — see §4.
- `GET /pets/:petId/found-reports` — found reports submitted against this pet's tag — see §5.
- `GET/POST /pets/:petId/medical-records`, `POST/DELETE .../:recordId/documents` — see §8.
- `GET/POST /pets/:petId/vaccinations`, `POST/DELETE .../:vaccinationId/documents` — see §8.
- `GET/POST /pets/:petId/caretakers`, `DELETE .../:caretakerId`, `DELETE .../me` — see §7.
- `POST/PATCH /pets/:petId/dating-profile`, `PATCH .../verify-health` — see §10 (Blueprint owns the narrative).

---

## 3. Tags / QR

Base path: `/tags`, bearer-guarded. A **Tag** is a first-class entity independent of `Pet` — it has its own lifecycle (`MANUFACTURED → AVAILABLE → ASSIGNED`, plus moderation states `SUSPENDED`/`RETIRED`) and is always addressed by its human-facing `publicCode` (printed on the sticker), never by its internal Mongo `_id`, for every assign/unassign/claim call.

```
TagStatus: MANUFACTURED | AVAILABLE | ASSIGNED | SUSPENDED | RETIRED
```

- `MANUFACTURED` — admin print-run inventory, no owner yet. Only reachable via `POST /tags/claim`.
- `AVAILABLE` — has an owner (self-service-created, or claimed), not linked to a pet.
- `ASSIGNED` — linked to a pet; this is the only state where a public scan resolves to a pet profile.
- `SUSPENDED` / `RETIRED` — admin moderation states.

### 3.1 Self-service create

`POST /tags` — any authenticated user. Request (`CreateTagDto`):
```json
{ "redirectBaseUrl": "https://pawtato.ariyan.app/qr/" }
```
`redirectBaseUrl` is **your frontend's** QR-landing route prefix (everything up to, not including, the code) — the backend appends the generated `publicCode` to build the full URL it encodes into the QR image (e.g. `https://pawtato.ariyan.app/qr/PT8F2K91`). The tag starts `AVAILABLE`, owned by the caller. Response is the full `Tag` document (`publicCode`, `linkUrl`, `qrImageUrl`, `status: "AVAILABLE"`, timestamps).

### 3.2 Assign / unassign

`POST /tags/assign` — body `{ "publicCode": "PT8F2K91", "petId": "<pet id>" }`. Both the tag and the target pet must belong to the caller (or caller is admin). `400` if the tag isn't `AVAILABLE`, or if the target pet already has an active tag (one tag per pet, enforced at the DB level too). `403` if the caller doesn't own the tag.

`POST /tags/unassign` — body `{ "publicCode": "PT8F2K91" }`. `400` if the tag isn't currently `ASSIGNED`.

### 3.3 Claim (admin-manufactured inventory)

`POST /tags/claim` — body `{ "publicCode": "PT8F2K91" }`. Moves a `MANUFACTURED`, unowned tag to `AVAILABLE` with the caller as owner, so it can then go through the normal assign flow. Self-service-created tags (§3.1) never need this. `400` if the tag isn't unclaimed manufactured inventory.

### 3.4 List / delete

- `GET /tags/mine` — every tag the caller owns, any status.
- `DELETE /tags/:id` — owner or admin. Permanently deletes the tag (and its QR image); if currently assigned, the link is cleared first — a scan afterward resolves to "not linked" rather than a stale pet.

### 3.5 Admin: bulk manufacture, inventory, moderation

- `POST /tags/bulk` (admin) — body (`BulkCreateTagsDto`): `{ "count": 50, "redirectBaseUrl": "https://pawtato.ariyan.app/qr/", "batchLabel": "2026-08 print run #3" }`. `count` 1–500. Creates `count` unowned `MANUFACTURED` tags (a real print run).
- `GET /tags` (admin) — paginated inventory: `?page=1&limit=10&status=AVAILABLE`. Response:
  ```json
  { "tags": [ /* Tag[] */ ], "pagination": { "total": 42, "page": 1, "limit": 10, "totalPages": 5 } }
  ```
- `GET /tags/:id` (admin) — single tag by Mongo id.
- `PATCH /tags/:id/suspend` (admin) — e.g. for reported abuse. `400` if already `RETIRED`.
- `PATCH /tags/:id/retire` (admin) — permanent; also clears `assignedPetId`.

---

## 4. Scans

`GET /pets/:petId/scans` (see §2.4) — every public resolution of this pet's tag produces a `ScanEvent`, recorded on **every** scan of an `ASSIGNED`, `SUSPENDED`, or `RETIRED` tag (only a code that was never issued at all produces no event, since there's no tag to reference). This is the real source of truth for scan history; `Pet.scanCount`/`lastScannedAt` (visible on the pet object) are cheap derived counters kept alongside it.

---

## 5. Public: Lost & Found

Base path: `/public`, **no authentication anywhere in this section**. This is what QR-code scans resolve to, and what a finder interacts with without ever creating an account. Throttled at the stricter `public` tier (20/min) for reads, `write` tier (5/min) for the found-report submission.

### 5.1 Pet profile lookup by tag code

`GET /public/tags/:publicCode` — what scanning the physical sticker resolves to. **Branch on the `tagStatus` field, not on HTTP status** — in practice this endpoint always returns `200`, even for a code that was never issued at all (see the first bullet below); it deliberately never leaks which codes are real via a 404-vs-200 difference. The only way to actually get a `404` here is the internal edge case where a tag record is `ASSIGNED` but its target `Pet` document has gone missing (a data-integrity issue, not a "bad code" case).

Five possible response shapes, keyed by `tagStatus`:

- **No tag record for this code at all**, or a tag that exists but isn't linked to a pet (`MANUFACTURED` unclaimed, `AVAILABLE` but never assigned):
  ```json
  { "tagStatus": "AVAILABLE", "message": "This QR is not linked to a pet." }
  ```
  (Note: an unissued code and an issued-but-unlinked code deliberately collapse to the same message — the frontend can't and shouldn't try to tell them apart.)
- **`RETIRED`**: `{ "tagStatus": "RETIRED", "message": "This tag has been retired and is no longer in use." }`
- **`SUSPENDED`**: `{ "tagStatus": "SUSPENDED", "message": "This tag has been suspended." }`
- **`ASSIGNED`** — the real case, full public-safe pet profile:
  ```json
  {
    "tagStatus": "ASSIGNED",
    "petStatus": "SAFE",
    "name": "Milo",
    "species": "Cat",
    "breed": "Persian",
    "gender": "MALE",
    "color": "White",
    "birthDate": "2022-05-01T00:00:00.000Z",
    "weight": 4.2,
    "notableTrait": "Friendly but startles easily — approach calmly.",
    "isLost": false,
    "profileImage": "https://.../pets/....jpg",
    "lastSeenLocation": null,
    "lostDate": null,
    "lostDescription": null,
    "reward": null,
    "emergencyContact": null
  }
  ```
  `petStatus` is an explicit `"MISSING" | "SAFE"` label alongside the raw `isLost` boolean — use it directly for UI copy rather than re-deriving it. **Never includes** the owner's name/email/password or any internal Mongo `_id` — this is the full public-safe field set, nothing more exists to fetch.

Every call here — including the "not linked" and moderation-state cases — increments the pet's `scanCount` (when a pet is actually resolved) and records a `ScanEvent`.

### 5.2 Found-report submission

`POST /public/tags/:publicCode/found-report` — multipart, no auth. Throttled 5/min.

Fields (`CreateFoundReportDto`, sent as multipart form fields, plus an optional file):
```
message           string, required   — "Found near Road 27, looks healthy and friendly."
deviceFingerprint string, required   — opaque client-generated id (e.g. a UUID persisted in
                                        localStorage) sent with every submission from this
                                        browser/device; used only for spam-rate-limiting, not
                                        tied to any account. Generate and persist one yourself.
approxLocation    string, optional
contactInfo       string, optional   — how the owner can reach the finder back
photo             file,   optional   — field name "photo", image only, size-capped
```
Response (201): `{ "message": "Thanks — the owner has been notified." }` — deliberately just a confirmation, never the raw report (which would otherwise leak internal pet/tag IDs to an anonymous caller). `400` if the tag isn't currently linked to a pet (you can't "find" a pet that isn't assigned to that tag) or if `message`/`deviceFingerprint` are missing. `404` if the code doesn't exist at all. `429` if this device is over its rate cap (overall, or same-tag cooldown).

The owner is notified via the branded email template plus in-app/push (see §9).

### 5.3 Lost-pets list

`GET /public/lost-pets` — no params. Every currently-lost pet, public-safe fields only:
```json
[
  {
    "publicCode": "PT8F2K91",
    "name": "Milo",
    "species": "Cat",
    "breed": "Persian",
    "profileImage": "https://.../pets/....jpg",
    "lastSeenLocation": "Dhanmondi, Dhaka",
    "reward": 50,
    "lostDate": "2026-08-20T10:00:00.000Z"
  }
]
```
`publicCode` is `null` if the pet has no currently-`ASSIGNED` tag (still possible to list, just not scannable right now) — handle that case in the UI (e.g. hide the "view profile" link).

### 5.4 Nearby lost-pets search

`GET /public/lost-pets/nearby?lat=23.7461&lng=90.3742&radiusKm=10` — `lat`/`lng` required, `radiusKm` optional (default 10, max 100). Only searches pets whose owner supplied `lat`/`lng` on report-lost (§2.3) — a pet reported with only a text location won't appear here even though it's in §5.3's plain list. Response: same shape as §5.3 plus a computed `distanceKm` (rounded to 1 decimal), sorted nearest-first.

---

## 6. Tag Ordering (Commerce / Stripe)

Base path: `/tag-orders`. This is how a user orders **physical** QR tag stickers to be printed and mailed.

```
TagOrderStatus: PENDING_PAYMENT → PAID → FULFILLED
                              ↘ CANCELLED (from either PENDING_PAYMENT or PAID)
```

### 6.1 Create an order → Stripe Checkout

`POST /tag-orders` (bearer-guarded). Request (`CreateTagOrderDto`):
```json
{
  "quantity": 5,
  "shippingAddress": {
    "fullName": "Ariyan Jahangir",
    "line1": "House 12, Road 5",
    "line2": "Apt 3B",
    "city": "Dhaka",
    "state": "Dhaka",
    "postalCode": "1205",
    "country": "Bangladesh"
  }
}
```
`quantity` 1–100. `shippingAddress` — only `line2` is optional, everything else required.

Response (201):
```json
{ "orderId": "64f...", "checkoutUrl": "https://checkout.stripe.com/c/pay/..." }
```
**Redirect the browser to `checkoutUrl`.** The order is created as `PENDING_PAYMENT` immediately, before payment — no tags exist yet. `503` if Stripe isn't configured on the server.

### 6.2 What happens after checkout (server-side — nothing for the frontend to call)

Stripe redirects the user back to whatever success/cancel URL your Checkout session config points at (frontend-owned, not part of this API). Independently, Stripe calls `POST /tag-orders/webhook` (signature-verified, not user-callable) on `checkout.session.completed`, which:
1. Flips the order `PENDING_PAYMENT → PAID`, stamps `paidAt`/`stripePaymentIntentId`.
2. Mints the paid quantity as real `MANUFACTURED` tag inventory (same shape as an admin bulk-manufacture batch — see §3.5) with a `batchLabel` like `order-<orderId>`.

**The frontend should poll or re-fetch `GET /tag-orders/:id` after returning from Checkout** to confirm the status actually flipped to `PAID` (webhook delivery isn't guaranteed to have landed the instant the user is redirected back) — don't assume payment succeeded just because the user is back on your success page.

An order only ever reaches `FULFILLED` via admin action (§11.5) once the physical tags actually ship.

### 6.3 Own orders

- `GET /tag-orders/mine` — the caller's own orders, newest first, full `TagOrder` documents.
- `GET /tag-orders/:id` — single order, owner or admin only (`403` otherwise).

---

## 7. Caretakers (shared pet access)

Base path: `/pets/:petId/caretakers` (owner-scoped actions) plus `/caretaking/pets` (the caretaker's own cross-pet view). **There is no invite/accept flow** — a caretaker grant is direct and immediate: the owner must already know the caretaker's registered account email, and access starts the instant the owner calls the add endpoint. Design your UI around "grant access now," not "send an invite."

Scope: a caretaker can view the pet and its medical/vaccination/scan/found-report history, and can report it lost/found. A caretaker **cannot**: edit the pet's own identity fields, manage its photo, delete it, manage other caretakers, manage its tags, or touch its dating profile — those stay owner-only.

### 7.1 Owner-side management

- `POST /pets/:petId/caretakers` (owner-only) — body: `{ "email": "caretaker@example.com" }`. `404` if no account exists with that email (the target must already be a registered user) or if the pet isn't the caller's. `400` if already a caretaker, or adding yourself.
- `GET /pets/:petId/caretakers` — visible to the owner **and** any existing caretaker (shared-access transparency: "who else has access" isn't hidden from the people sharing it). Returns each grant populated with `userId` (the caretaker) and `addedBy` (who granted it), both as `{ fullName, email }`.
- `DELETE /pets/:petId/caretakers/:caretakerId` (owner-only) — removes a specific caretaker.
- `DELETE /pets/:petId/caretakers/me` — any caretaker can self-revoke their own access, no owner action needed.

### 7.2 The caretaker's own view

`GET /caretaking/pets` — every pet the **caller** has been granted caretaker access to (distinct from `GET /pets`, which only ever lists pets the caller **owns**). This is how a caretaker discovers what they can act on. Each row is populated with the pet (`name, species, breed, profileImage, owner: { fullName, email }`).

---

## 8. Medical Records & Vaccinations (+ document attachments)

Both modules share an identical shape and pattern — CRUD scoped under a pet, plus an attachment sub-resource. Access rule: owner or authorized caretaker, same as every other pet-scoped resource; `404` if the caller has no access.

### 8.1 Medical records — `/pets/:petId/medical-records`

- `POST /` — body (`CreateMedicalRecordDto`):
  ```json
  {
    "title": "Annual checkup",
    "diagnosis": "Mild ear infection",
    "treatment": "Prescribed ear drops for 7 days",
    "veterinarian": "Dr. Rahman",
    "clinic": "City Vet Clinic",
    "visitDate": "2026-01-15",
    "notes": "Follow up in two weeks."
  }
  ```
  Only `title` is required; everything else optional.
- `GET /` — array of the pet's medical records, each including its `documents` array (see below).

### 8.2 Vaccinations — `/pets/:petId/vaccinations`

- `POST /` — body (`CreateVaccinationDto`):
  ```json
  {
    "vaccineName": "Rabies",
    "administeredDate": "2026-01-15",
    "nextDueDate": "2027-01-15",
    "veterinarian": "Dr. Rahman",
    "clinic": "City Vet Clinic",
    "notes": "No adverse reaction observed."
  }
  ```
  `vaccineName`, `administeredDate`, `nextDueDate` required; the rest optional. `nextDueDate` drives the daily reminder cron (email to the owner, branded template, when it comes due) — see §9.4's table.
- `GET /` — array of the pet's vaccination records, each with a `documents` array.

### 8.3 Document attachments (identical on both resources)

- `POST /pets/:petId/medical-records/:recordId/documents` (or `.../vaccinations/:vaccinationId/documents`) — multipart, field `file`. **JPEG/PNG/WebP or PDF, up to 10MB.** Response: the updated parent record (medical record or vaccination), with the new entry appended to its `documents` array:
  ```json
  {
    "_id": "...",
    "...": "...",
    "documents": [
      { "_id": "64f...", "url": "https://.../medical-documents/....pdf", "fileName": "lab-result.pdf", "mimeType": "application/pdf", "uploadedAt": "2026-08-30T12:00:00.000Z" }
    ]
  }
  ```
- `DELETE /pets/:petId/medical-records/:recordId/documents/:documentId` (or the vaccination equivalent) — removes one attachment, returns the updated parent record. `404` if the pet/record/document doesn't resolve, or the caller lacks access.

Documents can only ever be added/removed through these two endpoints — there's no way to set `documents` directly via the record's own create/update body.

---

## 9. Notifications

Base path: `/notifications`, bearer-guarded throughout.

### 9.1 List / read / delete

- `GET /notifications?page=1&limit=20&unreadOnly=true&type=dating.match-created` — paginated, newest first. `unreadOnly` and `type` (one of the `DOMAIN_EVENTS` string values — see §9.4) are both optional filters. Response:
  ```json
  { "notifications": [ /* Notification[] */ ], "pagination": { "total": 12, "page": 1, "limit": 20, "totalPages": 1 } }
  ```
  Each notification: `{ _id, user, pet, type, title, message, data, readAt, priority, expiresAt, createdAt, updatedAt }`. `readAt: null` means unread. `pet` is set only for pet-scoped event types.
- `PATCH /notifications/read-all` → `{ "updated": 7 }` (count of rows flipped to read).
- `PATCH /notifications/:id/read` → the updated notification. `404` if not found or not the caller's.
- `DELETE /notifications/:id` → `{ "message": "Notification deleted" }`, regardless of priority.
- `DELETE /notifications` — bulk delete, body `{ "ids": ["...", "..."] }` → `{ "deletedCount": 3 }`.

### 9.2 Native push (mobile) device tokens

`POST /notifications/device-tokens` — body `{ "token": "...", "platform": "IOS" | "ANDROID" | "WEB" }`. Idempotent on `token`. **Note:** no native FCM/APNs provider is wired up yet (no mobile app exists in this codebase) — rows created here are stored but not currently acted on by anything. Only relevant once a native app exists. For a real browser, use Web Push (§9.3) instead.

`DELETE /notifications/device-tokens/:token` — removes it.

### 9.3 Web Push subscribe/unsubscribe — full detail

This is the real, live push path for a browser client.

**Step 1 — get the VAPID public key:**
`GET /notifications/vapid-public-key` (bearer-guarded — only needed once already signed in) →
```json
{ "publicKey": "BN4Gv...base64url..." }
```
`publicKey` is `null` if push isn't configured on this server (no `VAPID_PUBLIC_KEY` env var set) — handle that by simply not offering push in the UI. Pass the string directly as `applicationServerKey` to `PushManager.subscribe()` — it's not a secret.

**Step 2 — subscribe and register:**
```js
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: publicKey, // from step 1
});
await fetch('/api/notifications/web-push-subscriptions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(subscription.toJSON()),
});
```
`POST /notifications/web-push-subscriptions` is **deliberately shaped to match `PushSubscription.toJSON()` exactly** — POST the browser's object with no transformation:
```json
{ "endpoint": "https://fcm.googleapis.com/fcm/send/...", "keys": { "p256dh": "...", "auth": "..." } }
```
`endpoint` must be a valid URL; `keys.p256dh`/`keys.auth` both required non-empty strings. Idempotent per `endpoint` (re-subscribing after a service-worker update just updates the owner, no duplicate row).

**Step 3 — unsubscribe:**
`DELETE /notifications/web-push-subscriptions?endpoint=<the subscription's endpoint URL>` — `endpoint` passed as a query param, required, must be a valid URL. `404` if not found or not the caller's.

This registration is what `PushChannel` actually sends encrypted messages to — it's the real, working push path today (unlike native tokens above).

### 9.4 Event → notification map

The authoritative source is `src/modules/notifications/templates/notification-templates.ts` (`renderNotification()`) — read it directly if you need to confirm exact wording. Summarized here for quick reference (`type` is the exact string you'd filter `GET /notifications?type=...` by):

| `type` (DOMAIN_EVENTS value) | Title | In-app | Email | Push | SMS |
|---|---|:-:|:-:|:-:|:-:|
| `pet.marked-lost` | Pet marked as lost | ✓ | ✓ | ✓ | – |
| `pet.marked-found` | Pet marked as found | ✓ | ✓ | ✓ | – |
| `tag.assigned` | QR tag assigned | ✓ | – | – | – |
| `tag.unassigned` | QR tag unassigned | ✓ | – | – | – |
| `qr.tag-scanned` | Pet's tag was scanned | ✓ | – | – | – |
| `found-report.created` | Someone may have found your pet! | ✓ | ✓ | ✓ | ✓ |
| `vaccination.reminder-due` | Vaccination reminder | ✓ | ✓ | – | – |
| `dating.match-created` | It's a match! | ✓ | – | ✓ | – |
| `admin.broadcast` | (admin-authored title) | ✓ | ✓ | ✓ | – |

Every row always produces an in-app `Notification` row; the ✓/– columns are whether `EmailChannel`/`PushChannel`/`SmsChannel` also fire for that event. `found-report.created` is the only event that reaches all four channels — a possible sighting of a lost pet is this platform's single most time-sensitive notification. Dating chat messages (`dating.message-sent`) and unmatches (`dating.match-unmatched`) are **not** in this table — they're handled by a dedicated Dating Chat Notifications system (unread counters, not this generic template), see §10.

**Every one of these emails renders through the same branded Pawtato HTML template system** the auth emails (verify-otp, forgot-password, password-reset) already use — there is no "plain unstyled email" path left anywhere in this API. If you're building an email preview or documenting content for design, treat every transactional email as using the branded template, full stop.

---

## 10. Dating

Full screen-level flow detail (Discover/Swipe, Matches, Chat, Identity Verification, NID exchange, gender/species matching rules, etc.) already lives in **`PAWTATO_FRONTEND_BLUEPRINT.md`'s Dating Module section** — go there for the "why" and the UI states. This section is only the API map, so this file stays a complete reference without duplicating that narrative.

| Method | Path | Purpose |
|---|---|---|
| POST | `/pets/:petId/dating-profile` | Create a pet's dating profile |
| PATCH | `/pets/:petId/dating-profile` | Update a pet's dating profile |
| PATCH | `/pets/:petId/dating-profile/verify-health` | Verify health records for BREEDING visibility |
| GET | `/dating/profiles/:petId` | Get a pet's full dating profile |
| GET | `/dating/discover` | Discover candidate pets to swipe on, by mode |
| POST | `/dating/swipe` | Swipe on a candidate; mutual LIKE returns a `match` |
| GET | `/dating/matches` | List the caller's active matches |
| GET | `/dating/matches/:matchId/messages` | List messages in a match |
| POST | `/dating/matches/:matchId/messages` | Send a message |
| POST | `/dating/matches/:matchId/read` | Mark a conversation read |
| POST | `/dating/matches/:matchId/unmatch` | Unmatch (either side) |
| POST | `/dating/matches/:matchId/delete` | Delete a (already-unmatched) conversation |
| POST | `/dating/matches/:matchId/share-nid` | Share the caller's NID within this match |
| GET | `/dating/matches/:matchId/nid` | Get the other side's shared NID, if any |
| POST | `/dating/report` | Report a profile, optionally with chat context |
| POST | `/dating/verification` | Submit/resubmit identity (NID) verification |
| GET | `/dating/verification/me` | Get the caller's own verification status |
| GET | `/dating/notifications/unread-summary` | Dating-chat unread counts (Blueprint's badge system) |
| GET | `/dating/notifications` | List dating-chat notifications |

---

## 11. Admin Dashboard

Base path: `/admin`, every route `JwtAuthGuard + RolesGuard + @Roles(ADMIN)` — a non-admin caller gets `403` on all of it.

### 11.1 `GET /admin/dashboard` — full response shape

This is the Phase 20 enrichment — every field below is real, read directly from `AdminService.dashboard()` and `DashboardStatsDto`:

```json
{
  "totalUsers": 1240,
  "totalPets": 1830,
  "lostPets": 12,
  "recoveredPets": 340,
  "totalVaccinations": 2100,
  "totalMedicalRecords": 980,

  "tags": {
    "total": 2000,
    "manufactured": 150,
    "available": 400,
    "assigned": 1380,
    "suspended": 5,
    "retired": 65
  },

  "dating": {
    "activeProfiles": 640,
    "totalMatches": 210,
    "activeMatches": 190
  },

  "caretakers": {
    "totalGrants": 88
  },

  "commerce": {
    "pendingPayment": 3,
    "paid": 14,
    "fulfilled": 120,
    "totalRevenueCents": 4520000,
    "currency": "usd"
  },

  "pendingModeration": {
    "foundReports": 4,
    "datingReports": 2,
    "identityVerifications": 9
  }
}
```

Notes an admin UI should get right:
- `tags.total` is the sum of every status bucket, not a separate count.
- `commerce.totalRevenueCents` is the sum of `totalAmountCents` across orders whose status is `PAID` **or** `FULFILLED` — a `CANCELLED` order (refunded or never charged) is excluded on purpose. Don't assume it only counts shipped orders.
- `pendingModeration` is deliberately the dashboard's headline number — it's "what needs an admin's attention right now," aggregating three separate queues (`FoundReport` status `PENDING`, dating report status `PENDING`, identity verification status `PENDING`) into one glance. Lead the dashboard UI with this, not with `totalUsers`.
- Every field here is additive versus the pre-Phase-20 shape — nothing existing was renamed or removed, so this is safe to build against without a breaking-change concern.

### 11.2 `GET /admin/analytics` — full response shape

```json
{
  "monthlyUsers": [10, 15, 22, 18, 30, 25, 40, 35, 28, 33, 41, 50],
  "monthlyPets": [5, 12, 14, 10, 20, 18, 25, 30, 22, 26, 29, 35],
  "monthlyQrScans": [100, 120, 90, 150, 200, 180, 220, 210, 190, 205, 230, 260],
  "speciesDistribution": [
    { "species": "Dog", "count": 900 },
    { "species": "Cat", "count": 850 },
    { "species": "Rabbit", "count": 80 }
  ],
  "lostVsRecovered": { "lost": 12, "recovered": 340 },
  "topScannedPets": [
    { "id": "64f...", "name": "Milo", "scanCount": 152 }
  ],

  "tagStatusBreakdown": [
    { "status": "MANUFACTURED", "count": 150 },
    { "status": "AVAILABLE", "count": 400 },
    { "status": "ASSIGNED", "count": 1380 },
    { "status": "SUSPENDED", "count": 5 },
    { "status": "RETIRED", "count": 65 }
  ],

  "datingFunnel": {
    "totalSwipes": 5200,
    "totalLikes": 1800,
    "totalMatches": 210,
    "matchRate": 0.1167
  },

  "identityVerification": {
    "pending": 9,
    "approved": 300,
    "rejected": 40,
    "approvalRate": 0.8824,
    "totalSubmissions": 349
  },

  "monthlyRevenue": [0, 0, 50000, 120000, 300000, 250000, 400000, 380000, 0, 0, 0, 0]
}
```

All twelve-element arrays (`monthlyUsers`, `monthlyPets`, `monthlyQrScans`, `monthlyRevenue`) are indexed by calendar month (index 0 = January), **this year only**, not a rolling 12 months. `monthlyRevenue` is in cents, same PAID+FULFILLED filter as the dashboard's `commerce.totalRevenueCents`.

`monthlyQrScans` is computed for real from `ScanEvent.createdAt` timestamps (`ScansService.monthlyScanCounts()`) — this replaced a Phase-1-era heuristic that dumped a pet's entire lifetime `scanCount` into whichever month it was *last* scanned, which the DTO had actually declared since the start but which the service silently never populated correctly. If you see old integration notes describing `monthlyQrScans` as unreliable, that's now fixed.

`datingFunnel.matchRate` and `identityVerification.approvalRate` are both `0` (not `NaN` or a misleading `0%`-looks-fine value) when the denominator is zero (no likes yet / nothing decided yet) — safe to render directly without a guard.

### 11.3 Broadcast announcement

`POST /admin/notifications/broadcast` — body (`BroadcastNotificationDto`):
```json
{ "title": "New: shared pet access is here", "message": "You can now grant a vet or family member access to a pet from its profile page.", "role": "USER" }
```
`title` ≤120 chars, `message` ≤1000 chars, both required. `role` optional — omit to reach **every currently ACTIVE, non-blocked account**; set it to restrict to one role (`USER` | `ADMIN` | `VET`).

Response: `{ "recipientCount": 842 }` — the number of accounts it was sent to.

Delivery goes through the **exact same notification pipeline** every other event in this API uses (§9.4's table, `admin.broadcast` row) — one in-app `Notification` + email + Web Push per recipient, not a separate broadcast mechanism. There's no per-recipient delivery-status endpoint; `recipientCount` at call time is the only confirmation you get.

### 11.4 Tag order fulfillment

- `GET /admin/tag-orders?page=1&limit=10&status=PAID` — paginated, same shape as §3.5's tag list pagination.
- `PATCH /admin/tag-orders/:id/ship` — body `{ "trackingNumber": "1Z999AA10123456784" }`. **Only a `PAID` order can be shipped** — `400` otherwise. Flips to `FULFILLED`, stamps `trackingNumber`/`fulfilledAt`.

### 11.5 Cancel a tag order — status-dependent behavior

`PATCH /admin/tag-orders/:id/cancel` — no body. **The behavior branches on the order's current status, and the UI should explain this to the admin before they click it:**

- **`PENDING_PAYMENT`** → cancelled outright. Nothing was ever charged, so there's nothing to refund.
- **`PAID`** → refunded in full through Stripe **first** (`StripeService.refundPayment()`), and the order is only flipped to `CANCELLED` **after** that refund succeeds. If the Stripe refund call fails, the order stays `PAID` and the endpoint errors — it deliberately never leaves an order marked `CANCELLED` while the customer's money is still gone. If the order is marked `PAID` but has no recorded `stripePaymentIntentId` (a data-integrity edge case), this is a `400` telling you to investigate manually rather than silently cancelling.
- **`FULFILLED`** or already **`CANCELLED`** → `400` immediately, no side effects. Tags have already shipped for a fulfilled order — undoing that is a manual, non-API process.

Recommended UI copy: change the cancel button's confirmation text based on `order.status` — "Cancel this order" for `PENDING_PAYMENT`, "Cancel and refund $X.XX" for `PAID`, and don't show a cancel action at all for `FULFILLED`/`CANCELLED` (the button should be disabled/hidden, not left to 400 on click).

### 11.6 Moderation queues (brief — full detail is in each DTO)

- **Found reports** — `GET /admin/found-reports?status=&deviceFingerprint=` (global, not pet-scoped — the abuse-review queue), `PATCH /admin/found-reports/:id/status` (body `{ status: "PENDING"|"REVIEWED"|"DISMISSED"|"ACTIONED" }`, stamps `reviewedBy`/`reviewedAt`; does **not** itself suspend the tag — pair with `PATCH /tags/:id/suspend` when warranted).
- **Dating reports** — `GET /admin/dating/reports`, `PATCH /admin/dating/reports/:id/status` (`PENDING`|`REVIEWED`|`ACTIONED`), `GET /admin/dating/reports/:id/messages` (on-demand conversation view, audit-logged every open), `PATCH /admin/dating/profiles/:petId/deactivate` (immediate, doesn't touch existing matches/messages).
- **Identity verification** — `GET /admin/dating/verifications`, `GET /admin/dating/verifications/:id/images` (short-lived signed URLs, on-demand + audit-logged, never included in the list response), `PATCH /admin/dating/verifications/:id/approve`, `PATCH /admin/dating/verifications/:id/reject` (body `{ reason: string }`, shown verbatim to the user).

### 11.7 User & pet management (unchanged, listed for completeness)

`GET /admin/users`, `GET /admin/users/:id`, `PATCH /admin/users/:id/block`, `PATCH /admin/users/:id/unblock`, `PATCH /admin/users/:id/verify` (manual OTP bypass), `PATCH /admin/users/:id/role` (body `{ role }`), `DELETE /admin/users/:id` (full cascade delete — pets, tags, medical/vaccination/scan/found-report history, dating data, caretaker grants both directions, notifications); `GET /admin/pets`, `GET /admin/pets/:id`, `PATCH /admin/pets/:id/recover`, `DELETE /admin/pets/:id` (single-pet cascade). None of this changed in Phase 20 — documented here only so this file is a complete map of `/admin`.

