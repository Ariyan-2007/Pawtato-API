# Pawtato — PWA Frontend Design Brief

This file is a **design brief**, written to hand to Claude Design (or any designer/agent) to produce a PWA-first frontend for Pawtato. It is not a build spec with exact pixel values — it defines *what needs to exist, why, in what order, and against what real data* so design decisions are grounded in the actual product and the actual backend, not invented from scratch.

Companion documents in this repo:
- `PAWTATO_PROJECT_SPEC.md` — the product-level source of truth (what Pawtato is).
- `PAWTATO_ROADMAP.md` — the backend delivery blueprint (what's built, what's planned, phase by phase).

This brief assumes the reader has **not** read either of those — the essentials are restated below, and every screen is explicitly marked with which backend phase it depends on, so design work doesn't get ahead of (or ignore) what actually exists.

## How to use this file

- Read "Product in one page" and "PWA principles" first — they frame every screen decision below.
- Screens are grouped by **experience** (Public/Finder, Owner PWA, Dating), not alphabetically — build/design in that order, since Public is the highest-stakes, lowest-friction surface (spec's own words: *"The QR scan experience is more important than complicated dashboards"*).
- Every screen lists the **backend endpoint(s)** it depends on and whether that endpoint is **live** or **planned**. Don't design a screen's data-dependent states (loading/error/empty) against a planned endpoint as if it's live — mock it, and flag the mock clearly.
- This is a living document. If the backend roadmap's phases change, update the endpoint references here to match — don't let the two drift.

---

## Product in one page

Pawtato gives pet owners a digital identity for their pet via a physical QR tag. Scan the tag → see the pet's public profile → if lost, contact the owner or report finding it. The three things that must be exceptionally easy: **own a pet → give it a digital identity**, **lose a pet → make it findable**, **find a pet → make it easy to help it get home**. Everything else (dashboards, medical records, the new Pet Dating feature) supports those three goals; none of them should compete with the finder experience for design attention.

Cats and dogs only. No requirement for a finder to create an account. Public pages must never leak owner passwords, precise addresses, internal database IDs, or private contact info the owner hasn't explicitly opted to share.

---

## PWA principles (apply to every owner-facing screen)

1. **Installable.** Web app manifest with Pawtato icon set (192/512px + maskable), theme color, `display: standalone`. Add-to-home-screen should feel earned — prompt after a real moment of value (e.g. right after a pet's first tag is assigned), not on first load.
2. **Mobile-first, always.** Every screen is designed for a one-handed phone first; desktop is a wider layout of the same information, not a separate design. The public scan page in particular will almost always be opened on a phone that just used its camera.
3. **Offline-aware, not offline-complete.** Full offline CRUD is not a goal for v1. What matters: the app shell (nav, cached last-viewed pet list) should render instantly from cache even with no connection, and any action attempted offline should fail with a clear, friendly "you're offline" state rather than a spinner that never resolves. A finder with poor signal scanning a tag is a realistic scenario — the public profile page should degrade gracefully (cached last-known state if previously visited, or a clear "having trouble loading — try again" rather than a blank screen).
4. **Fast.** The public scan-to-profile path is the most latency-sensitive screen in the whole app — budget accordingly (skeleton state, not spinner, for the profile card; image lazy-loading below the fold only).
5. **Camera/file access, used sparingly.** No in-app QR scanner is needed for the core flow — a phone's native camera app reads the physical sticker and opens the browser directly (see Public flow below). Camera access *is* useful for: uploading a pet's profile photo, a finder optionally attaching a photo to a found-report, and dating-profile photos. Use `<input type="file" capture>` patterns, not a custom camera UI, unless there's a specific reason to.
6. **Push notifications** are a real target (spec §14) but depend on backend Phase 4 (notification events) — design the opt-in moment and the notification list screen now, but don't block anything else on push actually working.

---

## The three experiences

### 1. Public / Finder — no login, must be fast, must be simple
The page a QR scan (or a shared lost-pet link) lands a stranger on. Zero friction, zero account. This is the highest-priority design surface in the whole app.

### 2. Owner PWA — authenticated, installable
The pet owner's home base: manage pets, tags, medical records, lost status, and (new) dating profiles. This is the one that should feel like an installed app, not a website.

### 3. Pet Dating — a feature *within* the Owner PWA, not a separate app
Swipe-based matching for playdates and/or breeding, scoped per-pet. Detailed in its own section below since it's new to this project and needs more explanation than the rest.

*(A fourth surface, Admin/back-office, exists per the spec but is explicitly out of scope for this PWA-first brief — it's a low-traffic internal tool better served by a conventional responsive web dashboard, not a mobile-installable PWA. Don't spend design effort there yet.)*

---

## Experience 1 — Public / Finder

### 1.1 Public Pet Profile (the QR scan destination)
**Route pattern:** `/t/:publicCode` (frontend route) → calls `GET /api/public/tags/:publicCode` (**live**, Phase 2)

The single most important screen in the product. A stranger just scanned a sticker on a collar. They may be stressed, in a hurry, or standing in the street.

Four distinct states the backend already returns — design all four, not just the happy path:
- **Assigned + not lost** — pet photo, name, species, breed, color, sex, short description, a calm "This pet belongs to someone. If found, please contact the owner." banner, and a clear primary action (see 1.2, once Phase 3 ships).
- **Assigned + lost** — the same profile but with a prominent, unmissable "LOST PET" status treatment (spec's own example: color/urgency should be obvious even to someone glancing for two seconds), last-seen location/description, reward if the owner set one, and the primary "I found this pet" / "Contact owner" actions front and center.
- **Tag not yet linked to a pet** — the backend returns `{ tagStatus: "AVAILABLE", message: "This tag has not been linked to a pet yet." }`. Design a calm, non-alarming state for this — it's not an error, just an unclaimed tag (could be a brand-new tag someone is testing, or a tag that fell off before assignment).
- **Tag suspended/retired** — backend returns `{ tagStatus: "SUSPENDED" | "RETIRED", message }`. Design a neutral "this tag is no longer active" state — don't imply anything alarming about the pet.

Never render: owner name/email/password, the pet's internal database ID, a precise home address. `emergencyContact` and `reward` are the only owner-supplied contact-adjacent fields currently returned, and only when the owner filled them in — design their absence gracefully (they're optional).

### 1.2 "I Found This Pet" / Contact Owner action — **planned, Phase 3, not live yet**
Backend: `POST /public/tags/:publicCode/found-report` (planned). Design the flow now (message, approximate location, optional contact info, optional photo, all without requiring an account — spec §6/§26), but build it behind a feature flag or clearly mark it as depending on unshipped backend work. Don't let this block 1.1.

### 1.3 Public Lost Pets Browse
**Route:** `/lost` → `GET /api/public/lost-pets` (**live**, Phase 2 — returns `publicCode`, name, species, breed, photo, last-seen location, reward, lost date, per pet)

A simple card grid/list, each card linking to that pet's 1.1 profile via its `publicCode`. Design for zero-results (no pets currently lost — a genuinely good state, don't make it feel like an error) and for many results (this list has no pagination on the backend yet — design assuming it could grow, and flag pagination as a backend follow-up if the list gets long in practice).

---

## Experience 2 — Owner PWA

### Navigation shell
Bottom tab bar (mobile PWA convention): **Home** · **My Pets** · **Tags** · **Dating** · **Account**. A notification bell lives in the top bar, not a tab (Phase 4 dependency — design the bell and its badge now, wire it once notifications ship).

### 2.1 Auth — Register / Login
`POST /api/auth/register`, `POST /api/auth/login` (**live**). Standard email/password. Note for design: there is currently no `/auth/refresh` endpoint despite a `RefreshTokenDto` existing in the backend (flagged in the roadmap as scaffolded-but-unimplemented) — design the session as a straightforward "log in again when the access token expires" flow for now, not a silent-refresh flow, until that backend gap closes.

### 2.2 Home / Dashboard
No dedicated backend endpoint for a combined dashboard yet — compose from `GET /api/pets` + `GET /api/pets/statistics` (**live**). Surface: pet count, lost-pet count if any (should feel urgent if non-zero — this is the one dashboard element that can interrupt calm), quick links into My Pets / Tags / Dating.

### 2.3 My Pets — list & detail
- List: `GET /api/pets` (**live**). Card per pet: photo, name, species/breed, a clear Safe/Lost status chip (spec's own mockup: `● Safe` / `● LOST`).
- Create: `POST /api/pets` (**live**) — form fields match `CreatePetDto`: name, species, breed, gender, color, birthDate, weight (all but name/species optional).
- Detail: `GET /api/pets/:id` (**live**) — photo, all fields, a **linked tag section** (see 2.4 — a pet detail screen should show its current tag's status inline, sourced from `GET /tags/mine` filtered by pet, since the Pet resource itself no longer carries any tag/QR fields as of Phase 2).
- Edit: `PATCH /api/pets/:id` (**live**). Delete: `DELETE /api/pets/:id` (**live**) — needs a real confirmation step, this is destructive.
- Mark Lost: `PATCH /api/pets/:id/report-lost` (**live**) — form matches `ReportLostDto`: last-seen location, description, emergency contact (all required), optional reward. This action should feel appropriately weighty in the UI — it's the moment that changes the public page's whole tone.
- Mark Found: `PATCH /api/pets/:id/report-found` (**live**) — should feel like relief, not a routine form submit. A small celebratory moment here is appropriate (spec's product philosophy: this is the whole point of the app working).

### 2.4 Tags
- My Tags: `GET /api/tags/mine` (**live**, Phase 2) — cards showing each tag's `publicCode`, its QR image (`qrImageUrl`), and which pet it's linked to.
- Assign a tag: `POST /api/tags/assign` (**live**) — body `{ publicCode, petId }`. Design note: **the owner types/enters the code printed on the physical tag** — there is no "browse available tags" self-serve catalog by design (a real user only ever has one specific physical object in hand). Consider a simple text input rather than any kind of picker.
- Unassign: `POST /api/tags/unassign` (**live**) — body `{ publicCode }`. Needs a confirmation step (the pet becomes untagged immediately).
- Note for design: tag *creation* (`POST /api/tags`) and inventory browsing (`GET /api/tags`) are **admin-only** — don't design self-serve "order a new tag" flows into the owner PWA yet; that's Post-MVP backlog (QR tag ordering/commerce, per the roadmap).

### 2.5 Medical Records & Vaccinations
`GET/POST /api/pets/:petId/medical-records`, `GET/POST /api/pets/:petId/vaccinations` (**live**). Simple chronological lists scoped to a pet, with a lightweight add-record form each. Not a priority design surface — utilitarian is fine here; the product's design attention budget belongs on the public/finder flow and dashboard.

### 2.6 Notifications — **planned, Phase 4, not live yet**
No `GET /notifications` endpoint exists yet (`NotificationsController` is currently an empty stub). Design the list screen and the notification-bell/badge pattern now — reasonable event types to design for, per the roadmap's planned Phase 4 events: `PetMarkedLost`, `PetMarkedFound`, `TagAssigned`, `TagUnassigned`, `QrTagScanned`, `FoundReportCreated`. Mark this whole screen clearly as depending on unshipped backend work.

### 2.7 Account / Settings
`GET/PATCH /api/users/profile` (**live**), `POST /api/users/avatar` (**live**, multipart upload). Standard profile form + avatar upload.

---

## Experience 3 — Pet Dating & Companion Matching

**Backend status: planned only (Roadmap Phase 10), nothing here is live yet.** Design this fully, but every screen below should be built against mocked data until the backend module ships — don't let this feature's design work get blocked on backend sequencing, but don't let anyone mistake it for live either.

### Concept
Any pet can get an optional dating profile, separate from its main Pawtato profile. Each profile declares a **purpose**: `PLAYDATE`, `BREEDING`, or `BOTH`. Discovery and matching are purpose-aware (a playdate-only pet is never shown to, or shown, a breeding-only pet, unless one side is `BOTH`) and species-locked (dogs match dogs, cats match cats). It's swipe-based: mutual like → match → a lightweight in-app message thread opens. This is a *feature within* the owner's existing pet management, not a separate identity — the owner is always managing it on behalf of a specific pet they already registered.

### Tone note (important, since this is new territory for the product)
Pawtato's whole brand voice is calm, trustworthy, safety-conscious (per spec §22: friendly, trustworthy, simple). Dating-app UX conventions (swipe decks, match celebrations) are fine to borrow visually, but every screen involving another owner's pet needs an accessible **Report/Block** action, and location must stay coarse (city/area, never precise) until a match exists — mirror the same privacy discipline the lost-pet finder flow already has (spec §17), don't invent a laxer standard just because this feature feels more "social."

### 3.1 Dating Profile Setup
`POST/PATCH /pets/:petId/dating-profile` (planned). Per-pet, opt-in (a pet with no dating profile simply never appears anywhere in this experience). Fields: purpose (single-select: Playdate / Breeding / Both), short bio, temperament tags (multi-select chips: playful, calm, good-with-kids, etc.), a dedicated photo gallery (separate from the pet's main profile photo — owners may want different photos here), coarse location, an active/paused toggle. For Breeding/Both purpose, a "health verified" indicator that's sourced from the pet's *existing* medical/vaccination records (2.5) rather than re-entered — design this as a read-only badge pulled from real data, not a free-text claim.

### 3.2 Discover / Swipe
`GET /dating/discover?petId=` (planned). A card-stack swipe interface — one candidate pet at a time, photo-forward, purpose and temperament tags visible without extra taps, like/pass as the primary gesture (with visible buttons too, not gesture-only, for accessibility). Empty state ("no more pets nearby right now") should be common and shouldn't feel broken — a small radius and small user base means this will often be empty; design for that being normal, not an error.

### 3.3 Matches
`GET /dating/matches` (planned). A list of mutual matches across all of the owner's dating-enabled pets — grouped by which of the owner's pets matched, since an owner may have multiple pets in the feature simultaneously. A first-match moment deserves a small celebratory transition (this is the payoff moment of the whole feature).

### 3.4 Match Chat
`GET/POST /dating/matches/:matchId/messages` (planned). Deliberately minimal — a basic threaded message view, not a full chat-app feature set (no typing indicators, read receipts are a nice-to-have not a requirement per the backend plan). An "Unmatch" and "Report" action must be reachable from this screen at all times, not buried in a settings menu.

### 3.5 Report / Block
`POST /dating/report` (planned). A short reason-select + optional detail form, reachable from the swipe card, the match list, and the chat screen — this needs to be a persistent affordance, not a one-off, given it involves connecting strangers' animals (and by extension, strangers).

---

## Design system starting point

No existing brand assets were available at the time this brief was written — treat the following as a **placeholder direction**, explicitly meant to be swapped for real brand decisions, not shipped as final:
- **Tone:** warm, calm, trustworthy — never alarmist even in the Lost state (urgent ≠ scary; the goal is "help is one tap away," not panic).
- **Color:** a warm neutral base with one confident accent color for primary actions, plus a distinct, unambiguous treatment reserved *only* for the Lost status (so it stays meaningful and doesn't get diluted by reuse elsewhere).
- **Type:** a friendly, highly legible sans-serif — the public profile page in particular needs to be readable at a glance, one-handed, possibly in bright outdoor light.
- **Imagery:** pet photos are the emotional core of nearly every screen — design layouts that make the photo the hero, not a small thumbnail competing with text.

### Component inventory (reused across screens above)
`PetCard` (photo + name + species/breed + status chip), `StatusBadge` (Safe/Lost, and separately Assigned/Available/Suspended/Retired for tags), `TagQrDisplay` (QR image + public code, shown to owners), `SwipeCard` (dating), `MatchCard`, `BottomNav`, `EmptyState` (used *often* — lost-pets-empty, dating-discover-empty, notifications-empty, matches-empty all need calm, non-error-coded empty states), `ConfirmDialog` (for destructive actions: delete pet, unassign tag, unmatch), `PhotoUpload` (camera-capture-aware file input), `OfflineBanner` (PWA offline state).

---

## Backend endpoint reference (live vs. planned, at a glance)

| Endpoint | Status | Used by |
|---|---|---|
| `POST /api/auth/register`, `/login`, `/me` | Live | 2.1 |
| `GET/POST/PATCH/DELETE /api/pets` | Live | 2.2, 2.3 |
| `PATCH /api/pets/:id/report-lost`, `/report-found` | Live | 2.3 |
| `GET /api/pets/statistics` | Live | 2.2 |
| `GET /api/public/tags/:publicCode` | Live | 1.1 |
| `GET /api/public/lost-pets` | Live | 1.3 |
| `GET/POST /api/tags`, `/tags/mine`, `/tags/assign`, `/tags/unassign` | Live | 2.4 |
| `GET/POST /api/pets/:petId/medical-records`, `/vaccinations` | Live | 2.5 |
| `GET/PATCH /api/users/profile`, `POST /api/users/avatar` | Live | 2.7 |
| `POST /public/tags/:publicCode/found-report` | **Planned (Phase 3)** | 1.2 |
| `GET /notifications` | **Planned (Phase 4)** | 2.6 |
| `POST/PATCH /pets/:petId/dating-profile` | **Planned (Phase 10)** | 3.1 |
| `GET /dating/discover` | **Planned (Phase 10)** | 3.2 |
| `POST /dating/swipe` | **Planned (Phase 10)** | 3.2 |
| `GET /dating/matches` | **Planned (Phase 10)** | 3.3 |
| `GET/POST /dating/matches/:matchId/messages` | **Planned (Phase 10)** | 3.4 |
| `POST /dating/report` | **Planned (Phase 10)** | 3.5 |

Every controller in this table has full Swagger documentation at `/api/docs` once the API is running (per `PAWTATO_ROADMAP.md` Phase 1's Swagger mandate) — use that as the source of truth for exact request/response shapes when building real data-fetching, not this table's summaries.
