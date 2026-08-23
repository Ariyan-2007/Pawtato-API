# Auth Rework: OTP Email Verification — Frontend Guide

This document is for the frontend team. It explains what changed in the backend's registration/login/verification flow and exactly what the frontend needs to build or update against it. It's separate from `PAWTATO_FRONTEND_BLUEPRINT.md` (the general design brief) — that file's §2.1 "Auth — Register / Login" section is now out of date where it conflicts with this one; treat this document as authoritative for auth until the blueprint is refreshed.

## What changed, in one paragraph

Registration no longer issues an access token immediately. It creates a **pending** account and emails a **6-digit OTP code** (not a magic link). The account only becomes usable — and only then does the API ever hand out a token — once that code is verified via the new `POST /auth/verify-otp`. If someone abandons that screen and comes back later through the login form instead, `POST /auth/login` recognizes the account is still pending, silently sends a fresh code, and routes them back to the same OTP screen — they never need to register again. The old magic-link endpoints (`POST /auth/verify-email`, `POST /auth/resend-verification`) are gone; there is no `/verify?token=...` frontend route to build anymore.

## Why (in case it comes up)

The previous flow handed out a working access token at registration regardless of verification status — meaning an attacker (or just a typo'd email) could get full API access without ever proving they controlled the mailbox. That's now closed: no token exists until the email is proven. Concurrent duplicate registrations for the same email are also now handled at the database level (a unique index + graceful conflict handling), not just an application-level check, so a double-submit or two simultaneous requests can never produce two accounts for one email.

## New/changed endpoints

All responses are wrapped in this API's standard envelope: `{ success, message, data }` on success, `{ success: false, statusCode, message, error, path, timestamp }` on error. The `message`/`status`/etc. fields described below live inside `data`.

### `POST /auth/register` — changed

Body: `{ fullName, email, password }` (unchanged shape).

No longer returns `accessToken`. Always returns (on success):

```json
{ "message": "Verification code sent to your email.", "email": "sarah@example.com", "status": "PENDING_VERIFICATION" }
```

This same shape comes back in **two** distinct backend situations, deliberately collapsed into one response because the frontend does the same thing either way — show the OTP screen:
- A brand-new account was created.
- The email already had a pending (unverified) account — no second account was created, but a fresh code was sent (the old one is now invalid).

If the email already belongs to a **verified/active** account, the request instead fails:
- **409 Conflict**, `message: "Email already registered."` — no code is sent. Show this as a normal "already registered, try logging in instead" error, probably with a link to the login screen.

Validation failures (bad email format, missing fields, weak password) still come back as **400** the same way they always did.

### `POST /auth/login` — response shape changed (endpoint/body unchanged)

Body: `{ email, password }` (unchanged).

Still **401** for wrong password or unknown email (same generic `"Invalid email or password"` message either way — the API deliberately doesn't reveal which one it was).

On correct credentials, the response body now differs depending on account status — **this is the key thing to build against**:

**Active account** (normal login):
```json
{ "accessToken": "...", "user": { "id": "...", "fullName": "...", "email": "...", "role": "USER", "status": "ACTIVE" } }
```

**Pending account** (correct password, but never verified — e.g. they closed the OTP tab after registering):
```json
{ "verificationRequired": true, "message": "Your email is not verified yet. A verification code has been sent.", "email": "sarah@example.com", "status": "PENDING_VERIFICATION" }
```
No `accessToken` is present in this case. A fresh OTP has already been sent server-side as a side effect of this call (subject to the resend cooldown below) — **do not call resend-otp immediately after this**, just route straight to the OTP screen.

**Frontend logic:** after a 200 from `/auth/login`, check `verificationRequired === true` (or equivalently, the absence of `accessToken`) and branch: if present, navigate to the OTP-entry screen (pre-filled with the email); otherwise treat it as a normal successful login as before.

### `POST /auth/verify-otp` — new

Body: `{ email, otp }` (`otp` is a 6-digit numeric string).

Used for **both** flows — right after registration, and after being routed here from a pending-account login. On success, the account is activated **and the user is logged in immediately**:

```json
{ "accessToken": "...", "user": { "id": "...", "fullName": "...", "email": "...", "role": "USER", "status": "ACTIVE" } }
```

Store the token and route into the authenticated app exactly as you would after a normal login — there is no separate "now go log in again" step.

On failure: **400**, `message: "Invalid or expired OTP."` for all of: wrong code, expired code (10-minute TTL), a code that's already been used, or a code entered after a newer one was issued (only the most-recently-issued code is ever valid). These are deliberately not distinguished in the response — don't try to show different copy for "expired" vs "wrong", just show one generic error and let the user retry or hit "resend code."

After **5** wrong attempts against the same code, the code is invalidated server-side and the same 400 response comes back with `message: "Too many incorrect attempts. Please request a new verification code."` — this one *is* distinguishable by message text if you want to show a more specific "request a new code" prompt at that point (e.g. auto-focus the resend button).

### `POST /auth/resend-otp` — new (replaces `resend-verification`)

Body: `{ email }`.

Always returns 200 with a generic message that does **not** reveal whether the email exists or is already verified (anti-enumeration, same pattern as the existing forgot-password endpoint):

```json
{ "message": "If that account exists and needs verification, a new code has been sent." }
```

**Exception:** if the account exists, is pending, and a code was already sent within the last **60 seconds**, this returns **400** instead:

```json
{ "message": "Please wait 42s before requesting another code." }
```

Build the resend button to: disable itself once clicked, and if a 400 comes back with a "Please wait Ns" message, parse the number out and start a client-side countdown before re-enabling (or just re-disable for a flat 60s — either is fine, the number in the message is a courtesy, not a contract you need to parse exactly).

### Removed endpoints

- `POST /auth/verify-email` — gone. Delete any `/verify?token=...` frontend route/page.
- `POST /auth/resend-verification` — gone, replaced by `/auth/resend-otp` above (email-based body is the same, only the path and the underlying mechanism changed).

### Unchanged endpoints

`GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/reset-password` are untouched — the forgot/reset-password flow still uses the original email-link mechanism, not OTP. Nothing to change there.

## Screens to build/update

1. **Registration form** — same fields as before. On success (201), always navigate to the OTP-entry screen with the email carried forward (from `data.email`), regardless of whether it was a new account or a pending resend. On a 409 with "Email already registered.", show an inline error with a link to the login screen instead of a generic toast.

2. **OTP-entry screen** — new. A single 6-digit code input (numeric keypad on mobile), the email shown read-only for context ("We sent a code to sarah@example.com"), a submit button calling `verify-otp`, and a "Resend code" affordance calling `resend-otp` with its own cooldown state as described above. On success, store the token and proceed into the app exactly like a normal post-login redirect. On the attempts-exceeded message specifically, consider nudging focus to "Resend code" since retrying the same code is now pointless.

3. **Login form** — same fields, but the submit handler now needs the branch described above (`verificationRequired` present → OTP screen; else → normal login). This is the one existing screen whose *handler logic* changes even though its *fields* don't.

4. Any deep link/route previously built for `FRONTEND_URL/verify?token=...` should be removed — nothing points there anymore, and hitting it will 404 against the backend if it tries to call the old endpoint.

## Things intentionally NOT changed

- `RegisterDto`/`LoginDto` request bodies are the same shape as before (`fullName`/`email`/`password` and `email`/`password` respectively) — no new required fields on those two forms.
- Forgot/reset password is a completely separate, untouched flow (still magic-link, still `/reset?token=...`).
- The JWT itself (claims, expiry, `Authorization: Bearer` usage) is unchanged — the only difference is *when* one gets issued.
