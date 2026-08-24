# Pawtato Frontend UI Blueprint

This file is the **UI/layout companion** to `PAWTATO_ROADMAP.md` and `PAWTATO_FRONTEND_FLOWS.md`. Those two are about *behavior* (what phases exist, what API calls a flow makes); this one is about **what the pages actually look like** — screen-by-screen layout, key components, and states — so a frontend implementer (or an early design pass) has something concrete to start from before pixels get drawn.

This file was referenced by name back when Phase 10 was scoped (see `PAWTATO_ROADMAP.md`'s Phase 10 provenance note and `PAWTATO_FRONTEND_FLOWS.md`'s own header) but never actually written until Phase 11 — this is that missing file, created now because Phase 11 needed a "how should the pages look" companion and the app has no frontend project in this repo to point at instead.

## How to use this file

- Each screen below is a **layout plan**, not a visual spec — no color/type system exists yet (there is no frontend codebase in this repo). Treat the ASCII boxes as wireframe-level structure: what's on the screen and in what order, not pixel positions.
- Screens are grouped by module. Only the **Dating module** is covered in full detail (that's what Phase 11 needs); other modules get a short one-line-per-screen list so this file has a complete map without duplicating what `PAWTATO_FRONTEND_FLOWS.md` already documents at the API level.
- When a new phase's screens are designed, append a new module section here — same append-only spirit as the roadmap's own Progress Log. Don't delete a screen's plan when it changes; strike it through and note why, same convention as the roadmap.
- PWA-first (per the original Phase 10 scoping conversation): every screen below assumes a single responsive layout that works from a phone up to desktop, not separate mobile/desktop designs.

---

## Screen Index

| Module | Screen | Status |
|---|---|---|
| Dating | Dating Hub (mode picker) | Planned — Phase 11 |
| Dating | Dating Profile Editor | Planned — Phase 11 (extends a Phase 10 layout) |
| Dating | Identity Verification — Submit | Planned — Phase 11 |
| Dating | Identity Verification — Status | Planned — Phase 11 |
| Dating | Discover / Swipe | Planned — Phase 11 (extends a Phase 10 layout) |
| Dating | Match Celebration | Planned — Phase 10 layout, unchanged |
| Dating | Matches List | Planned — Phase 10 layout, unchanged |
| Dating | Chat Thread | Planned — Phase 10 layout, unchanged |
| Dating | Matched Profile Detail (+ NID exchange) | Planned — Phase 11 |
| Dating | Report Profile (modal) | Planned — Phase 10 layout, unchanged |
| Admin | Verification Review Queue | Planned — Phase 11 |
| Admin | Dating Reports Queue | Planned — Phase 10 layout, unchanged |
| Other | Lost & Found, Auth, Pet CRUD, Admin dashboard | Not designed here — see note below |

**Other modules note:** Lost & Found, auth/onboarding, pet profile CRUD, QR/tag management, and the general admin dashboard all have working, e2e-verified API flows (`PAWTATO_FRONTEND_FLOWS.md` Flows 1–2), but no page-layout plan exists yet — out of scope for this pass, which was requested specifically to cover the dating module rework. Add a section here when those get designed.

---

## Dating Module

### Navigation shape

```
Bottom nav (mobile) / left rail (desktop):
  [ Home ]  [ My Pets ]  [ Dating ]  [ Notifications ]  [ Profile ]
```

Dating has its own sub-navigation once entered:

```
Dating tab bar:
  [ Discover ]   [ Matches ]   [ My Dating Profile ]
```

---

### 1. Dating Hub (mode picker)

Entry point after tapping the bottom-nav "Dating" tab. First decision a user makes every session: **which pet, which mode.**

```
┌─────────────────────────────────────┐
│  Dating                        ⚙️    │
├─────────────────────────────────────┤
│  Choose a pet                        │
│  ┌───────┐ ┌───────┐ ┌───────┐       │
│  │ 🐕 Rex │ │ 🐈 Mimi│ │  + Add │      │
│  │ (active)│ │(inactive)│ pet to │    │
│  └───────┘ └───────┘ └───────┘       │
│                                       │
│  Rex — choose a mode                 │
│  ┌─────────────────┐ ┌─────────────┐ │
│  │  🐾 Play Date     │ │ 🧬 Breeding  │ │
│  │  Meet any pet     │ │ Meet same-  │ │
│  │  nearby           │ │ species pets│ │
│  │  [ Start ]         │ │ [ Start ]   │ │
│  └─────────────────┘ └─────────────┘ │
│                                       │
│  ⚠ Rex's dating profile is inactive. │
│    [ Activate profile ]              │
└─────────────────────────────────────┘
```

**Notes:**
- Only pets with a `DATABLE_SPECIES`-eligible species (cat/dog) show a dating card at all; an ineligible pet shows a disabled state with a one-line explanation instead of being hidden (avoids "why isn't my pet here" confusion).
- A pet whose profile doesn't have `BREEDING` in `modes` shows the Breeding tile greyed out with "Not enabled — edit profile" rather than hidden, same reasoning.
- A pet with `isActive: false` shows the inactive banner shown above instead of mode tiles.
- Tapping a mode tile goes straight to **Discover / Swipe** pre-filtered to that pet + mode — no intermediate confirmation screen, since the tile itself is already the confirmation.

---

### 2. Dating Profile Editor

Reached via "My Dating Profile" tab, or the "Activate profile" / "Edit profile" CTAs elsewhere. One screen, scrollable sections — this is the "larger than the usual pet profile" screen from the original ask.

```
┌─────────────────────────────────────┐
│  ← Rex's Dating Profile        Save  │
├─────────────────────────────────────┤
│  Photos (1–6)                        │
│  ┌────┐┌────┐┌────┐┌────┐┌ + ┐       │
│  │ 📷1 ││ 📷2 ││ 📷3 ││ 📷4 ││Add│       │
│  └────┘└────┘└────┘└────┘└───┘       │
│  Drag to reorder · first photo is    │
│  the card cover                      │
│                                       │
│  Bio                                  │
│  ┌───────────────────────────────┐   │
│  │ Playful golden retriever who…  │   │
│  └───────────────────────────────┘   │
│                                       │
│  Modes                                │
│  [x] Play Date   [x] Breeding         │
│                                       │
│  Temperament                          │
│  ( playful ) ( calm ) ( good-with-kids)│
│  [ + add tag ]                        │
│                                       │
│  Likes                                │
│  ( fetch ) ( belly rubs ) ( the park ) │
│  [ + add ]                             │
│                                       │
│  Dislikes                             │
│  ( vacuum cleaners ) ( baths )        │
│  [ + add ]                             │
│                                       │
│  Health & Vaccination     ✓ Verified  │
│  ┌───────────────────────────────┐   │
│  │ [ ] Share health summary on    │   │
│  │     my dating profile          │   │
│  │                                 │   │
│  │ Preview (visible when on):     │   │
│  │  Vaccinations: up to date      │   │
│  │  Spayed/Neutered: Yes          │   │
│  └───────────────────────────────┘   │
│                                       │
│  Location (approximate)               │
│  ┌───────────────────────────────┐   │
│  │ Gulshan, Dhaka           [Edit]│   │
│  └───────────────────────────────┘   │
│                                       │
│  Profile Verification                 │
│  ┌───────────────────────────────┐   │
│  │ 🛡 Owner not verified           │   │
│  │ Verify your identity to join   │   │
│  │ the Verified pool and enable   │   │
│  │ safer matching.                │   │
│  │ [ Start verification → ]       │   │
│  └───────────────────────────────┘   │
│                                       │
│  [ Deactivate profile ]               │
└─────────────────────────────────────┘
```

**Notes:**
- The Health & Vaccination card is a single all-or-nothing `shareHealthSummary` toggle (decided 2026-08-25) — when off, the preview lines and the entire section are omitted from the public/candidate-facing profile, not shown-but-blank. When on, the summary is computed live from `medical`/`vaccinations` (never manually typed by the owner, never stored on the dating profile itself).
- "✓ Verified" badge next to the section header refers to `healthVerified` (Phase 10's medical-cross-reference flag), distinct from the *owner's* NID identity verification below it — these are two different badges and must not be visually merged, since a health-verified pet can have a non-identity-verified owner and vice versa.
- The Verification card is a status component with three states: not started (shown above), pending review, and approved (see next two screens) — same card, different content, so its position in the layout stays stable.
- Modes checkboxes: unchecking the only active mode should warn ("Rex won't be discoverable in any mode") rather than silently save to zero modes.

---

### 3. Identity Verification — Submit

Reached from the profile editor's verification card. A short, linear, high-trust flow — this is the most sensitive upload in the app.

```
┌─────────────────────────────────────┐
│  ← Verify Your Identity              │
├─────────────────────────────────────┤
│  Why verify?                         │
│  Verified owners can filter matches  │
│  to other verified profiles, and     │
│  choose to share ID with a specific  │
│  verified match for extra peace of   │
│  mind. This verifies you (the        │
│  owner), not your pet.               │
│                                       │
│  National ID — Front                 │
│  ┌───────────────────────────────┐   │
│  │                                 │   │
│  │     [ Tap to upload photo ]    │   │
│  │                                 │   │
│  └───────────────────────────────┘   │
│                                       │
│  National ID — Back                  │
│  ┌───────────────────────────────┐   │
│  │                                 │   │
│  │     [ Tap to upload photo ]    │   │
│  │                                 │   │
│  └───────────────────────────────┘   │
│                                       │
│  🔒 Your ID is stored privately and   │
│  only ever shown to Pawtato admins    │
│  for review, or to a specific match   │
│  after you both are verified and you  │
│  tap "Share" in that match.           │
│  It is never public, and never        │
│  shared without your action.          │
│                                       │
│  [ Submit for review ]                │
└─────────────────────────────────────┘
```

**Notes:**
- Both images required before "Submit" enables.
- The privacy notice is not optional copy — it's load-bearing given the roadmap's requirement that NID images are never publicly reachable; the UI should state plainly what happens to the image, matching the backend guarantee exactly (signed URLs, admin + matched-verified-party only, every view audit-logged).
- After submit, this screen is replaced by the Status screen — no "your submission was sent" toast-and-stay-here, since there's nothing left to do here.

---

### 4. Identity Verification — Status

The same card position as the profile editor's verification card, expanded to its own screen when tapped, with three states:

```
Pending:                          Approved:                       Rejected:
┌─────────────────────┐          ┌─────────────────────┐        ┌─────────────────────┐
│ 🕒 Under review       │          │ ✓ Verified            │        │ ✗ Not approved        │
│ Submitted 2 days ago │          │ Since 2026-08-20      │        │ Reason:               │
│ We'll notify you once│          │ You're in the         │        │ "Back image is        │
│ this is reviewed.    │          │ Verified pool.        │        │  blurry — please      │
│                       │          │ [Verified-only filter │        │  retake."             │
│ [ Cancel submission ] │          │  is on in Discover]   │        │ [ Resubmit → ]        │
└─────────────────────┘          └─────────────────────┘        └─────────────────────┘
```

**Notes:**
- Pending state offers "cancel submission" (withdraw, resubmit later) rather than leaving the user stuck mid-review with no action.
- Rejected shows the admin's `rejectionReason` verbatim — never a generic "not approved," since the user needs to know what to fix.
- Approved state doubles as where the "verified-only" Discover filter gets explained, since that's the direct payoff of this screen.

---

### 5. Discover / Swipe

Same card-stack pattern for both modes — the mode itself was already chosen on the Dating Hub, so this screen doesn't re-ask.

```
┌─────────────────────────────────────┐
│  ← Discover        🐾 Play Date  ⚙️  │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐   │
│  │                                 │   │
│  │         [ Photo 1/4 ]          │   │
│  │                                 │   │
│  │  Bella, 3 · Cat · Persian       │   │
│  │  ✓ Verified owner               │   │
│  │  "Loves sunbathing and..."      │   │
│  │  Likes: naps, string toys       │   │
│  │  ● ● ○ ○  (photo dots)          │   │
│  └───────────────────────────────┘   │
│                                       │
│      ✕                    ♥          │
│    (Pass)                (Like)      │
│                                       │
│  [ i  View full profile ]            │
└─────────────────────────────────────┘
```

Filter sheet (⚙️, slides up):
```
┌─────────────────────────────────────┐
│  Filters                        ✕    │
├─────────────────────────────────────┤
│  [ ] Verified profiles only          │
│      (only shown if you're verified) │
│  Distance: ○──────●──── 25 km        │
│  [ Apply ]                            │
└─────────────────────────────────────┘
```

**Notes:**
- Header shows the active mode as a static label (not a switcher) — changing mode goes back to the Dating Hub, keeping "which pet + which mode" as one deliberate choice rather than something to fumble mid-swipe.
- "✓ Verified owner" badge appears on the card only when the candidate's owner is `APPROVED` — visible to everyone, not just other verified users, since the badge itself is the signal that makes verified-only filtering worth using.
- In **Breeding** mode, the species is implied (all candidates share the swiper's species) so the card leads with breed instead; in **Play Date** mode, species is shown prominently on the card since candidates are mixed.
- "Verified profiles only" filter checkbox is disabled with a tooltip ("Verify your own profile to use this") when the current user isn't `APPROVED` yet — matches the backend's `400` on that combination, so the UI never lets a user hit that error.
- A mutual like triggers the Match Celebration screen immediately (per Phase 10's existing swipe-response contract) — no polling.

---

### 6. Match Celebration

Unchanged from the Phase 10 layout (full-screen modal on a mutual like):

```
┌─────────────────────────────────────┐
│                                       │
│         🎉 It's a Match! 🎉           │
│                                       │
│      ┌────┐         ┌────┐           │
│      │ Rex │  ♥      │Bella│          │
│      └────┘         └────┘           │
│                                       │
│   Rex and Bella liked each other!    │
│                                       │
│      [ Send a message ]              │
│      [ Keep swiping ]                │
└─────────────────────────────────────┘
```

---

### 7. Matches List

Unchanged from the Phase 10 layout:

```
┌─────────────────────────────────────┐
│  Matches                             │
├─────────────────────────────────────┤
│  🐾 Bella          "Hey! Rex is..."  │
│  🧬 Max            Matched today     │
│  🐾 Luna           "See you Sat?"    │
└─────────────────────────────────────┘
```

Small icon per row indicates which mode produced the match (🐾 Play Date / 🧬 Breeding), sourced from the `Swipe.mode` field Phase 11 adds for exactly this traceability purpose.

---

### 8. Chat Thread

Unchanged from the Phase 10 layout — plain message list + input, no new requirements from this phase:

```
┌─────────────────────────────────────┐
│  ← Bella & Rex          [i] Details  │
├─────────────────────────────────────┤
│                    Hi! Rex is cute 🐕 │
│  Thanks! Bella's gorgeous            │
│                    Want to meet up?  │
│                                       │
├─────────────────────────────────────┤
│  [ Type a message...        ] [Send] │
└─────────────────────────────────────┘
```

"[i] Details" opens the Matched Profile Detail screen below.

---

### 9. Matched Profile Detail (+ NID exchange)

Reached from the Chat Thread's "Details" or the Matches List. This is where Phase 11's NID exchange surfaces — **only** when both matched owners are currently `APPROVED`-verified; within that, sharing is explicit and per-direction (decided 2026-08-25), not automatic.

```
┌─────────────────────────────────────┐
│  ← Bella's Profile                   │
├─────────────────────────────────────┤
│  [ Photo carousel, full profile —    │
│    same content as Discover's        │
│    "View full profile" ]             │
│                                       │
│  Health & Vaccination                │
│  Vaccinations: up to date            │
│  (only shown if Bella's owner has     │
│   shareHealthSummary on)              │
│                                       │
├─────────────────────────────────────┤
│  🛡 Identity Sharing                  │
│  You and Bella's owner are both      │
│  verified. You can each choose to    │
│  share your ID within this match.    │
│                                       │
│  Your ID                              │
│  Not shared in this match yet.        │
│  [ Share my ID with this match ]      │
│                                       │
│  Bella's owner's ID                   │
│  Not shared yet.                      │
│  ┌ ─ ─ ─ ─ ─ ┐  ┌ ─ ─ ─ ─ ─ ┐          │
│  │  Front    │  │   Back    │          │
│  │ (hidden)  │  │ (hidden)  │          │
│  └ ─ ─ ─ ─ ─ ┘  └ ─ ─ ─ ─ ─ ┘          │
├─────────────────────────────────────┤
│  [ Unmatch ]      [ Report profile ] │
└─────────────────────────────────────┘
```

Once the other owner has tapped share, "Bella's owner's ID" replaces the hidden placeholder with the real images:

```
│  Bella's owner's ID                   │
│  ┌────────────┐ ┌────────────┐       │
│  │  [ Front ] │ │  [ Back ]  │       │
│  └────────────┘ └────────────┘       │
│  Viewed just now — this view is      │
│  logged.                             │
```

**Notes:**
- The "🛡 Identity Sharing" section is **entirely absent** (not shown-and-disabled) when either owner isn't `APPROVED` — no teaser, no upsell here, since a non-eligible match seeing "you could see their ID if..." creates pressure to verify that isn't this screen's job. Once it's present (both eligible), "Your ID" and the other party's row are two independent states — tapping "Share" only ever affects your own row; you never need the other side to share first, and they never need you to.
- "[ Share my ID with this match ]" is a deliberate, singular action scoped to *this* match only — sharing in one match never shares in another, and the button's copy should make that scope obvious (not a global "become discoverable" toggle).
- The other party's row shows a hidden-placeholder state until they've shared — never a "request to view" button, since this phase's design is opt-in-to-share, not opt-in-to-request.
- Once shared, NID images load via short-lived signed URLs fetched only when that row is actually scrolled into view / tapped open, not eagerly with the rest of the profile — matches the backend's on-demand, audit-logged read path.
- "Viewed just now — this view is logged" is deliberate, visible copy, not a hidden backend-only detail — both sides should know a view is recorded, which is itself part of why this exchange is meant to feel safe rather than covert.

---

### 10. Report Profile (modal)

Unchanged from the Phase 10 layout:

```
┌─────────────────────────────────────┐
│  Report Bella's profile         ✕    │
├─────────────────────────────────────┤
│  Reason                              │
│  ( ) Inappropriate photos            │
│  ( ) Fake profile                    │
│  ( ) Harassment                      │
│  ( ) Other                            │
│  ┌───────────────────────────────┐   │
│  │ Add details (optional)         │   │
│  └───────────────────────────────┘   │
│  [ Submit report ]                    │
└─────────────────────────────────────┘
```

---

## Admin Screens

### 11. Verification Review Queue

New for Phase 11 — mirrors the existing Dating Reports Queue's layout/interaction pattern exactly, so admins don't learn two different moderation UIs.

```
┌─────────────────────────────────────────────┐
│  Identity Verifications        [ Pending ▾ ] │
├───────────────────────────────────────────────┤
│  User            Submitted        Action      │
│  ariyan@…         2026-08-23      [ Review ]   │
│  jane@…           2026-08-24      [ Review ]   │
└───────────────────────────────────────────────┘

Review detail (opens on row click):
┌─────────────────────────────────────┐
│  Review — ariyan@…               ✕   │
├─────────────────────────────────────┤
│  ┌────────────┐   ┌────────────┐     │
│  │   Front    │   │    Back    │     │
│  │  [image]   │   │  [image]   │     │
│  └────────────┘   └────────────┘     │
│  (zoom on click)                     │
│                                       │
│  [ Approve ]      [ Reject ]         │
│  Reject reason (required if reject): │
│  ┌───────────────────────────────┐   │
│  │                                 │   │
│  └───────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Notes:**
- Front/back images load via the same on-demand signed-URL pattern as the matched-profile exchange screen — an admin opening this queue and *not* clicking into a specific review never triggers an image fetch for every row.
- Every open of the review detail logs `dating.nid.viewed` with the admin as actor, same as any other NID view — admins are not exempt from the audit trail.
- Reject requires a reason (enforced client-side to match the backend's `rejectionReason` requirement) since the user-facing Status screen displays it verbatim.

### 12. Dating Reports Queue

Unchanged from the Phase 10 layout — existing `GET /admin/dating/reports` / status-update pattern, not modified by this phase.

---

## Changelog

- **2026-08-25** — File created (Phase 11). Full page-by-page layout plan for every Dating module screen, including the two new identity-verification screens (owner-facing submit/status) and the new admin verification queue. Other modules (Lost & Found, auth, pet CRUD, general admin dashboard) intentionally left undesigned here — out of scope for this pass.
