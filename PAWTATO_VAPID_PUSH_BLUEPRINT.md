# Pawtato Web Push (VAPID) Blueprint

Standalone implementation + API-verification reference for the frontend/PWA
session wiring up real browser push notifications against the Pawtato API.
It does not summarize `PAWTATO_ROADMAP.md` or `PAWTATO_FRONTEND_FLOWS.md` —
it documents the actual current backend contract, verified line-by-line
against the real source and the real, passing e2e suite
(`test/push-notifications.e2e-spec.ts`), so every shape below is provably
correct rather than inferred.

## 1. What this covers, and who it's for

This is for whoever builds the **browser side** of Web Push: a service
worker (`sw.js` or similar) plus a `usePush.ts`-style React hook (or
equivalent) that:

- registers the service worker,
- asks the user for notification permission,
- subscribes to push via the browser's `PushManager`,
- POSTs that subscription to this API,
- and handles the `push` / `notificationclick` / `pushsubscriptionchange`
  service-worker events once a real push arrives.

It covers, in order: the contract in one paragraph, the full three-endpoint
API reference (real request/response/error shapes, not placeholders), the
exact JSON payload a service worker will receive, the event → push table,
step-by-step service-worker implementation guidance, a copy-paste curl test
suite, a manual browser QA checklist, and operational notes on VAPID key
handling.

The backend side (`WebPushService`, `PushChannel`, the three
`NotificationsController` routes) is already built, tested, and merged —
this document exists so the frontend half can be built against it without
re-deriving anything from the Nest source.

## 2. The Web Push contract, in one paragraph

Web Push uses VAPID (Voluntary Application Server Identification): the
server holds an EC key pair and signs every push it sends with the private
key, so the push service (e.g. Google's or Mozilla's) can verify the sender
without a per-message API key. The browser calls
`PushManager.subscribe({ userVisibleOnly: true, applicationServerKey: <VAPID public key> })`,
which returns a `PushSubscription` object containing an `endpoint` (a URL
unique to that browser install, hosted by the browser vendor's push
service) and a `keys` object (`p256dh`, `auth`) used to encrypt messages to
it. That `PushSubscription.toJSON()` object — completely unmodified — is
POSTed to `POST /notifications/web-push-subscriptions` and stored server-side.
From then on, whenever a push-eligible domain event fires for that user, the
API (`PushChannel` → `WebPushService` → the `web-push` npm package) encrypts
a JSON payload and sends it straight to that `endpoint`, which the browser's
push service delivers to the service worker's `push` event — with no open
tab required.

## 3. Full endpoint reference

All three routes live on `NotificationsController` (`src/modules/notifications/notifications.controller.ts`),
mounted under the app's global prefix (`api` by default —
`API_PREFIX` env var; assumed below). Every route in this controller is
guarded by `JwtAuthGuard` (`@UseGuards(JwtAuthGuard)` at the class level) —
**all three require `Authorization: Bearer <accessToken>`**, including the
public-key route (it's not a secret, but it's only ever needed once the
user is already signed in).

Every successful response is wrapped by the app's global `ResponseInterceptor`:

```json
{ "success": true, "message": "Request successful", "data": { ... } }
```

Every error response is wrapped by `AllExceptionsFilter`:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "…string or string[]…",
  "error": "BadRequestException",
  "path": "/api/notifications/web-push-subscriptions",
  "timestamp": "2026-09-11T00:00:00.000Z"
}
```

The global `ValidationPipe` runs with `whitelist: true, transform: true,
forbidNonWhitelisted: true` — any extra field not declared on a DTO is
rejected, not silently dropped.

---

### 3.1 `GET /notifications/vapid-public-key`

**Auth:** Bearer JWT required.
**Purpose:** feeds `PushManager.subscribe()`'s `applicationServerKey`
directly.

Reads `vapid.publicKey` straight from `ConfigService` — independent of
`WebPushService`'s own `isConfigured()` check. Uses `||`, not `??`, so an
empty-string env var reports `null` the same as a genuinely unset one
(handing the browser an empty `applicationServerKey` would fail
`subscribe()` with a confusing error instead of a clear "not configured"
signal).

**Success response — `200`:**

```json
{
  "success": true,
  "message": "Request successful",
  "data": { "publicKey": "BN4Gv...<base64url VAPID public key>...c8" }
}
```

**When push isn't configured on the server** (no `VAPID_PUBLIC_KEY` /
`VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` set — this is the real, currently
passing e2e-tested behavior, not a hypothetical):

```json
{ "success": true, "message": "Request successful", "data": { "publicKey": null } }
```

The frontend must treat `publicKey: null` as "push is unavailable right
now" and skip the subscribe flow gracefully (don't crash, don't retry in a
loop) rather than assuming a key is always present.

No documented error responses beyond the standard `401` for a missing/invalid
bearer token.

---

### 3.2 `POST /notifications/web-push-subscriptions`

**Auth:** Bearer JWT required.
**Purpose:** register (or re-register) the caller's browser `PushSubscription`.
Idempotent per `endpoint` — a `findOneAndUpdate(..., { upsert: true })` on
`{ endpoint }`, so re-subscribing (re-login, service-worker update, rotated
keys) **updates** the existing row's owner/keys rather than creating a
duplicate.

**Request body** — shaped to match `PushSubscription.toJSON()` exactly, so
the frontend can `JSON.stringify(subscription)` with zero transformation
(`RegisterWebPushSubscriptionDto`, `src/modules/notifications/dto/register-web-push-subscription.dto.ts`):

```ts
{
  endpoint: string;   // @IsUrl() — must be a valid URL
  keys: {
    p256dh: string;   // @IsString() @IsNotEmpty()
    auth: string;     // @IsString() @IsNotEmpty()
  };
}
```

Validation notes straight from the DTO's own comments:
- `endpoint` is validated with `@IsUrl()`.
- `keys` carries **both** `@IsNotEmptyObject()` and `@ValidateNested()` —
  deliberately, not redundantly. `@ValidateNested()` alone does nothing when
  `keys` is entirely absent (there's nothing to descend into), which
  previously let a request with `endpoint` but no `keys` reach the service
  layer as `dto.keys === undefined` and crash with a `500` on
  `dto.keys.p256dh`. `@IsNotEmptyObject()` closes that gap — see §7 for the
  regression test proving the fix.

**Success response — `201`:**

```json
{
  "success": true,
  "message": "Request successful",
  "data": {
    "_id": "66f1a2b3c4d5e6f7a8b9c0d1",
    "userId": "66f1a2b3c4d5e6f7a8b9c0aa",
    "platform": "WEB",
    "endpoint": "https://fcm.googleapis.com/fcm/send/<opaque-id>",
    "p256dh": "BOr...<base64url>...w",
    "authSecret": "kx...<base64url>...Q",
    "createdAt": "2026-09-11T00:00:00.000Z",
    "updatedAt": "2026-09-11T00:00:00.000Z",
    "__v": 0
  }
}
```

(`p256dh`/`authSecret` are the stored server-side field names — they come
back exactly as stored; `platform` is always `"WEB"` for this route, set by
the service, never taken from the request body.)

**Error cases (real, e2e-verified):**

| Case | Status | Body `message` |
|---|---|---|
| `keys` object missing entirely | `400` | `["keys must be a non-empty object"]` |
| `endpoint` is not a valid URL (e.g. `"not-a-url"`) | `400` | class-validator's default `@IsUrl()` message array |
| Missing/invalid bearer token | `401` | — |

The `keys`-missing case is a **regression test** for a real bug: before the
`@IsNotEmptyObject()` fix, this same request crashed with a `500` instead of
a clean `400`. It is now guaranteed `400` by
`test/push-notifications.e2e-spec.ts`.

---

### 3.3 `DELETE /notifications/web-push-subscriptions?endpoint=<url>`

**Auth:** Bearer JWT required.
**Purpose:** unregister one of the caller's own subscriptions, scoped by
`endpoint` **and** the caller's own `userId` (IDOR-safe — see below).

**Query parameter** (`UnregisterWebPushSubscriptionQueryDto`):

```ts
{
  endpoint: string; // @IsUrl() — required
}
```

This route deliberately validates the query string through a DTO instead of
a raw `@Query('endpoint') endpoint: string`. The raw form let a *missing*
`endpoint` reach the service as `undefined`, which Mongoose's driver then
silently dropped from the delete filter —
`findOneAndDelete({ endpoint: undefined, userId })` executed as
`findOneAndDelete({ userId })`, deleting an **arbitrary one of the caller's
own subscriptions** instead of erroring. The DTO makes a missing/malformed
`endpoint` a clean `400` instead, verified by a regression test that
confirms an unrelated subscription survives the attempt (see §7).

**Success response — `200`:**

```json
{
  "success": true,
  "message": "Request successful",
  "data": { "message": "Web push subscription removed" }
}
```

**Error cases (real, e2e-verified):**

| Case | Status | Notes |
|---|---|---|
| `endpoint` query param missing | `400` | validated by the DTO; the request never reaches the service, so nothing is deleted |
| `endpoint` not owned by the caller (belongs to another user, or doesn't exist) | `404` | `NotFoundException('Web push subscription not found')` — same 404 whether the row exists-but-belongs-to-someone-else or doesn't exist at all, so this endpoint can't be used to enumerate other users' subscriptions (IDOR-safe by construction: the lookup filter is `{ endpoint, userId }`, never `{ endpoint }` alone) |
| Unregistering the same `endpoint` a second time | `404` | the row is already gone |
| Missing/invalid bearer token | `401` | — |

**Routing note worth knowing if you ever add a route to this controller:**
`DELETE /notifications/web-push-subscriptions` is registered *before* the
generic `DELETE /notifications/:id` (single-notification-delete) route in
`notifications.controller.ts`. Nest/Express matches routes in registration
order, so a static path must come before a param path it could otherwise be
swallowed by — this was a real bug caught while writing the e2e suite
(`"web-push-subscriptions"` was being matched as a notification id and
400ing on `ParseMongoIdPipe`), the same class of bug previously fixed for
`GET /pets/statistics` in Phase 1. Not something the frontend needs to do
anything about — just don't be surprised if a future related endpoint has a
comment about this.

## 4. The push payload contract

When a push-eligible domain event fires, `PushChannel`
(`src/modules/notifications/channels/push.channel.ts`) builds and sends
this exact JSON string as the (encrypted) push payload:

```json
{
  "title": "Someone may have found your pet!",
  "body": "Found near the dog park, safe and friendly.",
  "tag": "found-report.created",
  "data": {
    "type": "found-report.created",
    "petId": "66f1a2b3c4d5e6f7a8b9c0d2"
  }
}
```

Field-by-field, straight from the code:
- `title` / `body` — `renderNotification(type, payload)`'s `title`/`message`
  (see §5's table for the exact copy per event).
- `tag` — always the raw domain event type string (e.g.
  `"found-report.created"`, `"pet.marked-lost"`). Useful as the
  `Notification` API's own `tag` option, which browsers use to collapse/
  replace stacked notifications of the same tag instead of piling up
  duplicates.
- `data.type` — same event type string, for the `notificationclick` handler
  to branch on.
- `data.petId` — included **only when** the event payload's `petId` is a
  string; omitted entirely otherwise (`ADMIN_BROADCAST` has no `petId`, so
  its push payload's `data` is just `{ "type": "admin.broadcast" }`).

**Service worker side** — this arrives at the `push` event as the encrypted
message body; decrypt it (the browser does this for you) and call:

```js
self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Pawtato', {
      body: payload.body,
      tag: payload.tag,
      data: payload.data,
      icon: '/icons/pawtato-192.png', // adjust to your actual asset path
      badge: '/icons/pawtato-badge.png',
    }),
  );
});
```

`event.data` can theoretically be absent (an empty push) — always guard with
`event.data ? event.data.json() : {}` rather than assuming a payload.

Note what's **not** sent: there is no `icon`/`badge`/`url` field in the
server's payload — those are frontend-side presentation choices layered on
in `showNotification()`'s options object, not something the backend
dictates. If you want click-through navigation, put the target path on
`data` yourself when handling `notificationclick` (see §6) by deriving it
from `data.type`/`data.petId` — the server does not send a ready-made URL.

## 5. Event → push table

Every case comes from `renderNotification()`
(`src/modules/notifications/templates/notification-templates.ts`), which is
the single, authoritative place every event type's `sendPush` flag is
declared. This is the complete list — anything not in this table does not
push (its `sendPush` is `false`, or it falls to the `default` case entirely
unhandled).

| Domain event (`type` / `tag`) | Push? | Title | Fires when |
|---|---|---|---|
| `pet.marked-lost` | ✅ | `Pet marked as lost` | An owner marks their own pet as lost. |
| `pet.marked-found` | ✅ | `Pet marked as found` | An owner marks a lost pet as found/recovered. |
| `tag.assigned` | ❌ | — | A QR tag is assigned to a pet (in-app only). |
| `tag.unassigned` | ❌ | — | A QR tag is removed from a pet (in-app only). |
| `qr.tag-scanned` | ❌ | — | A pet's QR tag is scanned by anyone (in-app only). |
| `found-report.created` | ✅ | `Someone may have found your pet!` | A finder submits a found report by scanning a pet's tag. Also the only event type with `sendSms: true` — the one case where a few minutes genuinely matter. Message body is the finder's own submitted text when present, otherwise a generic fallback. |
| `vaccination.reminder-due` | ❌ | — | A scheduled vaccination reminder becomes due (email only, not push). |
| `dating.match-created` | ✅ | `It's a match!` | Two pets' profiles mutually match in Dating. |
| `admin.broadcast` | ✅ | Admin-authored (from `payload.title`, falls back to `"Pawtato"`) | An admin sends a broadcast announcement via `POST /admin/notifications/broadcast`. Title/body are freeform admin content, not a fixed template string. |
| *(anything else / unrecognized type)* | ❌ | `Notification` | Falls through `renderNotification`'s `default` case — no push, no email, no SMS. |

Note also, from `PushChannel` itself: a device row only receives a push if
it's `platform === DevicePlatform.WEB` **and** has all three of
`endpoint`/`p256dh`/`authSecret` present as strings. `IOS`/`ANDROID` rows
(registered via the separate native `POST /notifications/device-tokens`
route) are silently skipped — there is no FCM/APNs provider wired up yet,
so this table applies to Web Push subscribers only.

## 6. Step-by-step service-worker implementation guidance

1. **Register the service worker** (once, early in the app's lifecycle):
   ```js
   if ('serviceWorker' in navigator) {
     const registration = await navigator.serviceWorker.register('/sw.js');
   }
   ```

2. **Request Notification permission**, triggered by explicit user action
   (a button, not on page load — browsers increasingly block/penalize
   auto-prompts):
   ```js
   const permission = await Notification.requestPermission();
   if (permission !== 'granted') return; // user declined or dismissed
   ```

3. **Fetch the VAPID public key**:
   ```js
   const res = await fetch(`${API_BASE}/notifications/vapid-public-key`, {
     headers: { Authorization: `Bearer ${accessToken}` },
   });
   const { data } = await res.json();
   if (!data.publicKey) {
     // Server has no VAPID keys configured — bail out gracefully, no retry loop.
     return;
   }
   ```

4. **Convert the base64url public key to a `Uint8Array`** — `PushManager.subscribe()`
   requires this exact conversion (a standard, widely-used helper):
   ```js
   function urlBase64ToUint8Array(base64String) {
     const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
     const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
     const rawData = atob(base64);
     return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
   }
   ```

5. **Subscribe**:
   ```js
   const registration = await navigator.serviceWorker.ready;
   const subscription = await registration.pushManager.subscribe({
     userVisibleOnly: true,
     applicationServerKey: urlBase64ToUint8Array(data.publicKey),
   });
   ```

6. **POST the subscription, unmodified** (`subscription.toJSON()` already
   matches the DTO exactly):
   ```js
   await fetch(`${API_BASE}/notifications/web-push-subscriptions`, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       Authorization: `Bearer ${accessToken}`,
     },
     body: JSON.stringify(subscription.toJSON()),
   });
   ```

7. **Handle `push` in the service worker** — see §4 for the exact
   `showNotification()` call.

8. **Handle `notificationclick`** — close the notification and focus/open
   the app, optionally routing based on `data.type`/`data.petId`:
   ```js
   self.addEventListener('notificationclick', (event) => {
     event.notification.close();
     const { type, petId } = event.notification.data ?? {};
     const targetUrl = petId ? `/pets/${petId}` : '/notifications';

     event.waitUntil(
       clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
         for (const client of clientList) {
           if (client.url.includes(targetUrl) && 'focus' in client) return client.focus();
         }
         if (clients.openWindow) return clients.openWindow(targetUrl);
       }),
     );
   });
   ```

9. **Handle `pushsubscriptionchange`** — fires when the browser rotates or
   invalidates the existing subscription (this happens on the browser's own
   schedule, independent of anything the server does). Re-subscribe and
   re-POST, exactly like the initial flow, but from inside the service
   worker:
   ```js
   self.addEventListener('pushsubscriptionchange', (event) => {
     event.waitUntil(
       (async () => {
         const newSubscription = await self.registration.pushManager.subscribe(
           event.oldSubscription?.options ?? {
             userVisibleOnly: true,
             applicationServerKey: /* re-fetch or cache the VAPID public key */ undefined,
           },
         );

         await fetch(`${API_BASE}/notifications/web-push-subscriptions`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           // Note: a service worker has no direct access to your app's
           // in-memory accessToken — persist it somewhere the SW can reach
           // (e.g. IndexedDB written by the main thread) or use a
           // long-lived mechanism; don't assume `Authorization` is trivially
           // available here.
           body: JSON.stringify(newSubscription.toJSON()),
         });
       })(),
     );
   });
   ```

10. **Also POST a fresh subscription on ordinary re-login** — the DTO's
    upsert-on-`endpoint` behavior means calling
    `POST /notifications/web-push-subscriptions` again after every
    successful login (if a subscription already exists in the browser) is
    always safe and cheap; it just updates the row's owner/keys rather than
    creating a duplicate.

11. **On explicit logout / "turn off notifications"**, call
    `subscription.unsubscribe()` browser-side and
    `DELETE /notifications/web-push-subscriptions?endpoint=<the subscription's endpoint>`
    server-side, in either order — but do call the DELETE, otherwise the
    server keeps a subscription row it can never successfully deliver to
    once the browser drops it (though `PushChannel`'s own 404/410 cleanup —
    see §9 — will eventually reap it anyway on the next failed send).

## 7. Copy-paste curl test suite

Substitute `$API_BASE` (e.g. `http://localhost:5000/api`) and
`$ACCESS_TOKEN` (a real bearer JWT from `POST /auth/login`).

**Get the VAPID public key:**
```bash
curl -s "$API_BASE/notifications/vapid-public-key" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Register a subscription (success case):**
```bash
curl -s -X POST "$API_BASE/notifications/web-push-subscriptions" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "https://fcm.googleapis.com/fcm/send/example-endpoint-id",
    "keys": {
      "p256dh": "BOr8...example-p256dh...w",
      "auth": "kx...example-auth...Q"
    }
  }'
```
Expect `201` and the stored row back (see §3.2).

**Re-register the same endpoint (idempotent update, not a duplicate):**
```bash
curl -s -X POST "$API_BASE/notifications/web-push-subscriptions" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "https://fcm.googleapis.com/fcm/send/example-endpoint-id",
    "keys": { "p256dh": "rotated-p256dh", "auth": "rotated-auth" }
  }'
```
Expect `201` again, same `endpoint` in the response.

**Now-fixed error case #1 — missing `keys` (was a 500, now a clean 400):**
```bash
curl -s -X POST "$API_BASE/notifications/web-push-subscriptions" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "endpoint": "https://fcm.googleapis.com/fcm/send/malformed-example" }'
```
Expect `400` with `"message": ["keys must be a non-empty object"]`.

**Now-fixed error case #2 — missing `endpoint` query param on unregister
(was a silent arbitrary-row delete, now a clean 400):**
```bash
curl -s -X DELETE "$API_BASE/notifications/web-push-subscriptions" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```
Expect `400` — and, if you have another subscription registered under the
same account, confirm with a follow-up `GET` (there is no list-subscriptions
route today; verify indirectly by re-registering and re-deleting that
specific `endpoint` to confirm it was never removed by the request above)
that it was **not** deleted.

**Unregister a subscription (success case):**
```bash
curl -s -X DELETE "$API_BASE/notifications/web-push-subscriptions?endpoint=https%3A%2F%2Ffcm.googleapis.com%2Ffcm%2Fsend%2Fexample-endpoint-id" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```
Expect `200` with `{ "message": "Web push subscription removed" }`.

**Unregister the same endpoint again (should now 404):**
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE \
  "$API_BASE/notifications/web-push-subscriptions?endpoint=https%3A%2F%2Ffcm.googleapis.com%2Ffcm%2Fsend%2Fexample-endpoint-id" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```
Expect `404`.

**IDOR check — a different user cannot delete your subscription:**
Register a subscription as User A, then run the same `DELETE ...?endpoint=`
request with User B's `$ACCESS_TOKEN`. Expect `404` (not `403` — the lookup
filter is `{ endpoint, userId }`, so a non-owner gets the same "not found"
response as a nonexistent endpoint, never leaking whether the endpoint
exists under someone else's account).

## 8. Manual browser QA checklist

1. Open the app in a real browser (Chrome/Edge/Firefox all support Web
   Push; Safari needs the PWA installed to the home screen on iOS/macOS).
   Log in.
2. Trigger the subscribe flow (permission prompt → accept). Confirm no
   console errors during `PushManager.subscribe()`.
3. Confirm the row landed server-side: call
   `GET /notifications/vapid-public-key` isn't enough to check this (it
   doesn't list subscriptions) — instead, confirm indirectly via step 4
   below actually delivering a push, or by checking the database directly
   if you have access.
4. Trigger a real push-eligible event end-to-end — the easiest is: as this
   same logged-in user, report one of your own pets lost
   (`pet.marked-lost` — but note this pushes to *the pet's owner*, i.e.
   yourself), or better, use a second browser/profile: subscribe as User A,
   then as an anonymous finder, scan User A's pet's QR tag and submit a
   found report (`found-report.created`) — this is the flow the real e2e
   suite exercises, and it also fires SMS eligibility (stubbed) alongside
   push.
5. Confirm the OS-level notification actually appears (not just an in-app
   toast) — this is the point of the whole feature; a notification that
   only appears while the tab is open isn't proof push works.
6. Click the notification — confirm `notificationclick` navigates/focuses
   correctly per your implementation.
7. Test unsubscribe: call `subscription.unsubscribe()` client-side and hit
   `DELETE /notifications/web-push-subscriptions?endpoint=...`. Trigger the
   same event again — confirm no notification arrives, and confirm no
   server-side error (a delivery attempt to an unsubscribed endpoint should
   404/410 and be silently cleaned up per §9, not throw).
8. Test a second device/browser under the same account — subscribe there
   too, trigger an event, confirm **both** devices receive the notification
   (this proves the multi-subscription fan-out in `PushChannel.send()`,
   which `Promise.all`s over every `WEB` device row for the user).
9. Close the tab/app entirely on one device, then trigger an event from
   another session — confirm the notification still arrives (this is Web
   Push's whole point: no open tab required).

## 9. Operational notes

- **VAPID keys must be a real matching EC key pair, not just two
  independently well-formed-looking strings.** This was a real, caught
  failure mode on this project: a mismatched public/private key pair would
  pass basic format checks but silently break every real delivery (the push
  service rejects or the encryption fails) — the 2026-08-30 verification
  pass on this feature specifically confirmed the public and private key
  loaded in `.env` are actually mathematically paired, not merely present.
  Don't assume "both env vars are set and non-empty" is sufficient proof
  push will actually work — verify with a real end-to-end send (§8) after
  any key rotation.

- **Generate a key pair with:**
  ```bash
  npm run vapid:generate
  ```
  This runs `web-push generate-vapid-keys` (see `package.json`'s `scripts`)
  and prints a fresh public/private pair to the terminal. Set them as
  `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` in `.env`, plus `VAPID_SUBJECT`
  (a `mailto:` URI identifying the sending application/operator — defaults
  to `mailto:no-reply@pawtato.app` if unset, per `src/config/configuration.ts`).

- **All three env vars are optional at boot** (`src/config/env.validation.ts`:
  `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` are all
  `Joi.string().allow('').optional()`), following the same "additive
  feature, degrade at use rather than fail boot" convention as this
  project's Stripe integration. Unset (or blank), `WebPushService` reports
  `isConfigured() === false` and `PushChannel` logs a one-time warning and
  silently skips sending — the rest of the API, including in-app and email
  notifications, is entirely unaffected.

- **Rotate any key pair that has ever appeared in a chat/terminal
  transcript before using it in production.** A demo VAPID pair was
  generated and printed to a session terminal during this feature's own
  verification — the same rule that applied to this project's earlier
  Atlas/SMTP credential exposure applies here: a secret that has been
  displayed anywhere outside its final `.env` location should be treated as
  potentially compromised and regenerated with `npm run vapid:generate`
  before real users depend on it.

- **The public key is not a secret** (every subscribing browser receives
  it) — only the private key needs protecting. `GET /notifications/vapid-public-key`
  requiring auth is about UX/consistency (there's no reason an anonymous
  caller needs it), not about hiding a secret.
