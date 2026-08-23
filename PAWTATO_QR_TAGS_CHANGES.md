# QR / Tags Rework: Self-Service Tags — Frontend Guide

This document is for the frontend team. It replaces the old mental model of QR tags as a physical, admin-manufactured inventory that a user "claims" by typing a pre-printed code. That model is gone. This is the authoritative reference for the QR/Tags feature going forward — where `PAWTATO_FRONTEND_BLUEPRINT.md` (§2.4 "Tags") still describes the old admin-inventory flow, this document supersedes it.

> **2026-08-24 update:** fixed a bug where creating a second tag returned a 500, and hardened the create/list path against the same class of issue recurring. See [Bug fix: second tag creation failing with 500](#bug-fix-second-tag-creation-failing-with-500) below if you hit this earlier — nothing changes on the frontend's side, this was purely a backend index issue.
>
> **2026-08-24 update 2:** the public scan page's data was thin, there was no way to flag a safety trait or clearly see missing/safe status, and found-report submissions had no spam protection. See [Public scan page: richer pet data](#public-scan-page-richer-pet-data), [Mark Missing / Mark Safe](#mark-missing--mark-safe-already-live), [Found reports list view](#found-reports-list-view), and [Found-report spam protection: deviceFingerprint is now required](#found-report-spam-protection-devicefingerprint-is-now-required) below.

## The new concept, in one paragraph

A user creates a QR **tag** entity themselves, at any time, for any of their pets (or before they've even decided which pet). Creating one generates a random code and a QR image, and the QR encodes a link to **a page the frontend owns** — not a raw backend API URL. The user then **links** (assigns) that tag to a specific pet, can **unlink** (unassign) it at any time, and can **delete** the tag entirely, permanently killing the QR code. When a stranger scans the physical sticker, they land on the frontend page, which calls a public backend endpoint with the code to fetch live pet info — lost/not-lost status, name, breed, etc. — or a "not linked" message if the code doesn't currently resolve to anything.

## Why this changed

The previous model assumed Pawtato pre-manufactures physical tags in bulk (admin-only `POST /tags`, a `MANUFACTURED → AVAILABLE` inventory state, a `serialNumber` field) and a user just claims one of those by typing the code printed on it. That's not the product anymore — tags are now created on-demand by users themselves, and the backend no longer tracks pre-printed inventory at all. The QR image's embedded link also used to point directly at this API's raw JSON endpoint (`{APP_URL}/api/public/tags/:code}`), which would have shown a stranger a bare JSON blob instead of a page — that's now fixed to point at a URL the frontend controls.

## The full lifecycle

```
Frontend: user taps "Create QR tag"
    │
    ▼
POST /api/tags  { redirectBaseUrl: "https://pawtato.ariyan.app/qr/" }
    │
    ▼
Backend generates a random code (e.g. "ASDOPW"), builds the full link
(redirectBaseUrl + code), renders a QR PNG encoding that link, stores both,
and returns the tag — including the code, the full link, and the QR image URL.
    │
    ▼
Frontend shows the QR image (user can download/print it — this is the file
they'd get a physical sticker made from) and the tag now appears in "My Tags".
    │
    ▼
User taps "Link to pet" → POST /api/tags/assign { publicCode, petId }
    │
    ▼
Tag status becomes ASSIGNED. Scanning the physical sticker now shows that pet's
live info. The tag can't be assigned to a second pet without unassigning first.
    │
    ▼
User taps "Unlink" → POST /api/tags/unassign { publicCode }
    │
    ▼
Tag status back to AVAILABLE. Scanning the sticker now shows "This QR is not
linked to a pet." — the sticker itself still exists, just not pointing at
anything.
    │
    ▼
User taps "Delete" → DELETE /api/tags/:id
    │
    ▼
Tag is permanently gone (and unlinked from its pet first, if it was linked).
Scanning the physical sticker afterward shows the same generic "not linked"
message — there is no way to tell a deleted code apart from one that was
never issued.
```

## Endpoints

All responses use the standard envelope: `{ success, message, data }` on success, `{ success: false, statusCode, message, error, path, timestamp }` on error.

### `POST /tags` — changed (was admin-only, now any authenticated user)

Body:
```json
{ "redirectBaseUrl": "https://pawtato.ariyan.app/qr/" }
```

`redirectBaseUrl` is **everything up to (not including) the code** — normally your app's fixed QR-landing route prefix (e.g. `https://pawtato.ariyan.app/qr/` in production, `http://localhost:5173/qr/` in dev). The backend generates the code, appends it, and encodes the resulting full URL into the QR image it renders. A trailing slash is optional — the backend normalizes it either way.

Response (201) — the created tag:
```json
{
  "id": "...",
  "publicCode": "ASDOPW",
  "linkUrl": "https://pawtato.ariyan.app/qr/ASDOPW",
  "qrImageUrl": "https://.../qrcodes/ASDOPW.png",
  "status": "AVAILABLE",
  "ownerId": "...",
  "assignedPetId": null,
  "createdAt": "..."
}
```

Use `qrImageUrl` directly as an `<img>` src for the "here's your QR code, save/print it" screen — the backend renders and stores the actual PNG, you don't need a client-side QR library. `publicCode`/`linkUrl` are there for display/debugging, not something you need to reconstruct yourself.

### `GET /tags/mine` — behavior changed (same route)

Now returns **every tag the caller owns, regardless of status** — previously this only returned tags currently `ASSIGNED` to one of the caller's pets, which meant a newly-created, not-yet-linked tag was invisible. Now a freshly created tag shows up here immediately with `status: "AVAILABLE"` and `assignedPetId: null`. This is the endpoint for the "My Tags" list screen — build it to show all four states (unlinked / linked / suspended / retired), not just linked ones.

If a tag you created isn't showing up here: this has been verified directly against real data (create → the tag is immediately returned by this endpoint, confirmed both via the service logic and a live query). If it's still not appearing, the "My Tags" screen most likely just isn't calling this endpoint yet rather than a backend issue — it's newly-specified functionality, not something that existed to regress.

### `POST /tags/assign` — same shape, now ownership-checked

Body: `{ publicCode, petId }` (unchanged). `petId` must be one of the caller's own pets (unchanged). **New:** the tag itself must also belong to the caller — a **403** now comes back if you try to assign a tag you didn't create. In practice this shouldn't come up in the UI at all, since a user will only ever act on tags from their own `/tags/mine` list.

### `POST /tags/unassign` — same shape, now ownership-checked

Body: `{ publicCode }` (unchanged). Same 403-if-not-your-tag behavior as assign.

### `DELETE /tags/:id` — new

Permanently deletes a tag the caller owns (`id` is the tag's Mongo `_id`, as returned in the `POST /tags` / `GET /tags/mine` responses — not the `publicCode`). If the tag is currently linked to a pet, the link is cleared as part of the same operation — you don't need to unassign first. Returns `{ "message": "Tag deleted successfully" }`. **403** if the caller doesn't own the tag, **404** if the id doesn't exist.

Build a confirmation dialog for this — it's irreversible, and the physical sticker becomes permanently dead (any future scan just shows "not linked", indistinguishable from a code that never existed).

### `GET /tags/:id/found-reports` — new

Returns every found report submitted against that tag (`id` is the tag's Mongo `_id`, same as `DELETE`/suspend/retire), newest first — full details in [Found reports list view](#found-reports-list-view) below.

### `GET /api/public/tags/:publicCode` — unchanged route, response behavior clarified

This is what the frontend's `/qr/:code` landing page calls to get live pet data. No auth required. Response shape depends on tag state:

**Linked to a pet (`tagStatus: "ASSIGNED"`):**
```json
{
  "tagStatus": "ASSIGNED",
  "petStatus": "SAFE",
  "name": "...",
  "species": "...",
  "breed": "...",
  "gender": "...",
  "color": "...",
  "birthDate": "2022-05-01T00:00:00.000Z",
  "weight": 4.2,
  "notableTrait": "Friendly but startles easily — approach calmly.",
  "isLost": false,
  "profileImage": "...",
  "lastSeenLocation": null,
  "lostDate": null,
  "lostDescription": null,
  "reward": null,
  "emergencyContact": null
}
```
New fields as of 2026-08-24 — `petStatus`, `birthDate`, `weight`, `notableTrait` — see [Public scan page: richer pet data](#public-scan-page-richer-pet-data) below for how to use them.

**Not linked, suspended, retired, or the code doesn't exist at all:**
```json
{ "tagStatus": "AVAILABLE", "message": "This QR is not linked to a pet." }
```
(or `tagStatus: "SUSPENDED"` / `"RETIRED"` with their own message, if you want to show slightly different copy for those — but treating all four the same generic way is also fine and simpler.)

**Important:** a completely unknown code (never issued, or belonging to a deleted tag) now returns this same 200 response instead of a 404. Don't build error-page handling keyed on a 404 here — every response from this endpoint is a normal 200 with either pet data or a "not linked" message. This was deliberate: a stranger scanning a sticker can't tell "this code never existed" apart from "this code exists but isn't linked to anything" anyway, so the API doesn't either (it also means this endpoint can't be used to enumerate which codes are real).

## Removed

- `serialNumber` on tags — gone entirely, no replacement. It was a physical-manufacturing concept that doesn't apply to self-service digital tags.
- `MANUFACTURED` tag status — gone. The lifecycle is now `AVAILABLE → ASSIGNED → AVAILABLE (unlinked) → ...`, with `SUSPENDED`/`RETIRED` reserved for admin moderation only.
- Admin's old bulk "create tag inventory" flow is gone from the product's actual use — `POST /tags` is the same route but now self-service. `GET /tags` (full inventory list) and `GET /tags/:id` are still admin-only, and admin still has `PATCH /tags/:id/suspend` / `PATCH /tags/:id/retire` for moderating an individual abusive tag — nothing to build for those beyond what might already exist in an admin panel.

## Screens to build/update

1. **Create QR tag** — a simple "Create tag" action (no form fields beyond what your app already knows: its own base URL). On success, show the returned `qrImageUrl` prominently with a save/print/share action — this is the actual file to get printed onto a physical sticker or collar tag.
2. **My Tags list** — `GET /tags/mine`. Show each tag's QR image thumbnail, its status (unlinked/linked/suspended/retired), and which pet it's linked to (if any — you'll need to cross-reference `assignedPetId` against your pets list, the same way the existing "linked tag section" on a pet's detail page already does per the original blueprint's §2.3/§2.4). Actions per tag: **Link to a pet** (if unlinked), **Unlink** (if linked, needs a confirmation step), **Delete** (needs a confirmation step, mention it's irreversible).
3. **QR scan landing page** — `/qr/:code` (this is the actual frontend route you should be sending as `redirectBaseUrl` at creation time, e.g. `https://pawtato.ariyan.app/qr/`). On load, call `GET /api/public/tags/:code` and render either the pet's public profile (reuse whatever component the original blueprint's §1.1 "Public Pet Profile" describes) or the "not linked" state. No auth, no account needed — same public/finder experience the blueprint already designed for, just served from this route instead of `/t/:publicCode`. As of 2026-08-24 this page has more to show and a form to build — see the sections below.
4. **Owner's linked-tag / pet detail view** — when an owner taps into a tag from "My Tags" that's linked to a pet, that screen should surface: a **Mark Missing / Mark Safe** toggle, and a **found reports list**. Both endpoints already exist — see [Mark Missing / Mark Safe](#mark-missing--mark-safe-already-live) and [Found reports list view](#found-reports-list-view) below.

## One security note worth deciding on deliberately

`redirectBaseUrl` is currently accepted as-is from whatever the frontend sends — the backend doesn't check it against a known/trusted domain list. That means a scanned QR code's destination is only as trustworthy as whatever build of the frontend created it; if that's ever a concern (e.g. you want to guarantee every Pawtato QR always points at `pawtato.ariyan.app` and never a staging/preview domain by accident), that'd be a small backend addition (validate the origin against `FRONTEND_URL`/`CORS_ORIGINS`) — flagging it here rather than adding it unasked, since it wasn't part of what was requested.

## Bug fix: second tag creation failing with 500

**No frontend changes needed for this** — it was purely a backend data issue, already fixed and verified against real data. Documenting it here for visibility in case it was already noticed.

**What happened:** the old `Tag` schema had a `serialNumber` field with a database-level *unique* constraint (a leftover from the pre-self-service, admin-inventory model). When that field was removed from the schema as part of this rework, the underlying unique index in MongoDB wasn't automatically dropped — Mongoose only creates indexes a schema newly declares, it never removes ones a schema stops declaring. Every new tag document then omitted `serialNumber` entirely, which MongoDB treats as an implicit `null` for indexing purposes — and a unique index only allows *one* document with a `null` value for that field. So: the first tag any user ever created worked fine (it became "the one" with a null `serialNumber`), and every tag created after that — by any user — failed with a raw duplicate-key error that surfaced as a generic 500.

**The fix, two parts:**
1. The stale index has been dropped from the live database, and creating any number of tags in a row now works correctly (verified directly against the real database: created two tags back-to-back for the same account, both succeeded, both appeared in a `/tags/mine`-equivalent query).
2. More importantly, this can't silently happen again for *any* future schema change: the app now runs `connection.syncIndexes()` once on every boot (`DatabaseModule.onApplicationBootstrap`), which reconciles every model's indexes with its current schema — creating what's missing and, critically, dropping what's no longer declared. If a field's `unique` constraint is ever removed or renamed going forward, the very next deploy self-heals the index automatically instead of leaving a landmine for the second write to trip over.

**Also hardened while fixing this:** `POST /tags` now retries with a freshly-generated code if it ever hits a genuine `publicCode` collision (astronomically unlikely on its own, but previously would have surfaced as a raw 500 rather than transparently retrying) — so tag creation itself is now resilient to this whole class of duplicate-key issue, not just the specific one that was hit.

## Public scan page: richer pet data

The public profile (`GET /api/public/tags/:publicCode`, `tagStatus: "ASSIGNED"` case) now returns four new fields — nothing to call differently, just more to render on the `/qr/:code` page:

- **`petStatus`**: `"MISSING"` or `"SAFE"` — a ready-made label, use this instead of interpreting the `isLost` boolean yourself (still present too, for anything already built against it). This directly answers "is this pet actually reported missing, or just out and about" — render it as the headline status on the page (e.g. a prominent red "MISSING" banner vs. a calm "This pet is safe at home" state), the same way §1.1 of the original blueprint described a "LOST PET" treatment.
- **`notableTrait`** (string, optional — may be `null`/absent if the owner never set one): one safety-relevant thing a stranger should know before approaching, e.g. *"Friendly but startles easily — approach calmly"* or *"May nip if grabbed suddenly."* Show this prominently, near the top of the profile card — it's meant to be read before someone reaches out to touch the animal, not buried below the fold.
- **`birthDate`** (ISO date string, optional) and **`weight`** (number, kilograms, optional): both existed on the pet record already but weren't in the public response. Useful identification detail for a finder ("is this actually the right animal") — show them as simple labeled fields (compute an approximate age from `birthDate` if you want, e.g. "~2 years old").

Where the owner sets `notableTrait`: it's just another field on the existing pet create/update forms (`POST /pets`, `PATCH /pets/:id`) — same `CreatePetDto`/`UpdatePetDto` your app already posts to, add a `notableTrait` text input (max 200 characters) alongside the existing breed/color/etc. fields.

## Mark Missing / Mark Safe (already live)

This already exists and needed no backend changes — documenting it here because it belongs on the same screen as everything else in this update (the linked-pet view reached from a QR tag).

- **Mark Missing:** `PATCH /pets/:id/report-lost`, body `{ lastSeenLocation, lostDescription, emergencyContact, reward? }` (all but `reward` required). Sets `isLost: true` — the pet's public profile immediately starts showing `petStatus: "MISSING"` and the lost-specific fields (`lastSeenLocation`, `lostDescription`, `reward`, `lastSeenLocation`).
- **Mark Safe:** `PATCH /pets/:id/report-found`, no body. Sets `isLost: false` — public profile flips back to `petStatus: "SAFE"` and clears the lost-specific display fields.

Build this as a toggle/button pair on the pet detail screen reached from a linked tag in "My Tags" — tapping "Mark Missing" should open the `lastSeenLocation`/`lostDescription`/`emergencyContact`/`reward` form (this is the same "Mark Lost" flow the original blueprint's §2.3 already specified — `ReportLostDto`'s shape hasn't changed), tapping "Mark Safe" is a single confirmed action, no form.

## Found reports list view

### `GET /tags/:id/found-reports` — new, this is the one to use from "My Tags"

This is the endpoint for "select a specific QR (e.g. the tag with public code `pgrEgeANTY`) and see the reports finders have sent for it, newest first" — added specifically for that flow. JWT-protected, and ownership-checked the same way as the other tag actions (assign/unassign/delete): only the tag's owner (or an admin) can list its reports — a **403** comes back otherwise, **404** if the tag id doesn't exist.

`:id` is the tag's Mongo `_id` (the same `id` field `GET /tags/mine` already returns for each tag), **not** its `publicCode` — matching how `DELETE /tags/:id` and the suspend/retire routes already identify a tag.

```json
[
  {
    "id": "...",
    "tag": "...",
    "pet": "...",
    "message": "Found near Road 27, looks healthy and friendly.",
    "approxLocation": "Dhanmondi, Dhaka",
    "contactInfo": "+8801XXXXXXXXX",
    "photoUrl": "...",
    "deviceFingerprint": "...",
    "foundAt": "...",
    "createdAt": "..."
  }
]
```

Build this as a table/list on the tag detail screen (reached by tapping a tag in "My Tags"): message, when (`createdAt`), approximate location, an optional photo thumbnail, and the finder's contact info if they left any (they're anonymous by default — `contactInfo` is opt-in on their end). `deviceFingerprint` is included mainly for your own reference/debugging (e.g. spotting that several reports came from the same device) — no need to display it prominently, if at all.

One nuance worth knowing: this list is scoped to the **tag's** whole history, not just whichever pet it's linked to right now — if a tag was ever unlinked and relinked to a different pet, reports from its time with the earlier pet still show up here. In practice this is rarely visible (most tags stay linked to one pet for their whole life), but don't assume every report in this list is about the tag's *current* pet.

### `GET /pets/:petId/found-reports` — already existed, still works

Same data, scoped by pet instead of by tag (get `petId` from the tag's `assignedPetId`, already returned by `GET /tags/mine`). Kept for anywhere in the app that's already showing a pet without necessarily having its tag in scope (e.g. a pet detail screen reached some other way than "My Tags"). For the "tap a QR, see its reports" flow specifically, prefer the tag-scoped endpoint above — it's more direct and doesn't require the extra `assignedPetId` cross-reference.

## Found-report spam protection: `deviceFingerprint` is now required

`POST /public/tags/:publicCode/found-report` (the form a finder submits from the scan landing page) now **requires** a new field: `deviceFingerprint`. This endpoint has no auth and is reachable by anyone who scans a tag, which makes it a spam/abuse target (each submission writes a database record and emails the pet's owner) — this field is how the backend tells repeat submissions from the same device apart from genuinely different finders, on top of the IP-based rate limit that was already there.

**What to send:** any opaque, reasonably-unique string your app can generate and keep around client-side — a UUID (`crypto.randomUUID()`) generated once and persisted in `localStorage` is the simplest option and is exactly what's shown in the Swagger example. It is **not** tied to any user account (the endpoint stays fully anonymous) and doesn't need to be cryptographically strong — it just needs to stay stable across submissions from the same browser/device. Minimum 8 characters, maximum 256.

```json
{
  "message": "Found near Road 27, looks healthy and friendly.",
  "approxLocation": "Dhanmondi, Dhaka",
  "contactInfo": "+8801XXXXXXXXX",
  "deviceFingerprint": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```
(multipart/form-data if attaching a photo, same as before — `deviceFingerprint` is just another form field alongside `message`.)

**New failure mode to handle:** a **429** response (in addition to the existing 400/404) in two situations:
- The same `deviceFingerprint` already submitted a report for this exact tag within the last 10 minutes — message: *"You already reported this recently — please wait before submitting again."*
- The same `deviceFingerprint` has submitted 5+ reports (across any tag) in the last hour — message: *"Too many reports submitted from this device recently — please try again later."*

Show the 429's message directly to the finder rather than a generic error — both are legitimate "please slow down" states, not failures. Missing/empty `deviceFingerprint` is a normal 400 validation error, same as a missing `message`.
