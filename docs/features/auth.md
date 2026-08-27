# Auth — Technical Design

Account creation and session-based login: from a JSON request to an active HTTP session.

---

## Endpoints

| Method | Path | Auth required | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | none | Create an account, then immediately open a session (auto-login) |
| POST | `/api/auth/login` | none | Authenticate, open a session |
| POST | `/api/auth/logout` | session | Invalidate the current session |
| GET | `/api/auth/me` | session | Return the current user, or 401 if none |
| POST | `/api/auth/email/confirm` | none | Confirm an account's email address from a one-time token sent at registration |
| POST | `/api/auth/email/confirm/resend` | session | Issue and send a fresh confirmation token, invalidating any still-valid prior one |

---

## Request / response shapes

**RegisterRequest**
```json
{ "username": "marcel", "email": "marcel@example.com", "password": "hunter2222" }
```
- `username`: 3–50 characters
- `email`: valid email format, max 255 characters
- `password`: 15–128 characters. Length over composition rules — no uppercase/digit/symbol requirement, passphrases and spaces are welcome (current NIST guidance: 15+ characters for a password used as the sole factor, since there's no MFA here). The upper bound is a sanity limit on hashing cost, not an algorithm quirk — Argon2id's cost scales with input size, so an unbounded password is a cheap way to make the server do expensive work
- `password` must not be identical (case-insensitive) to `username` or to the normalized `email` — `400` if it is. Strict equality only, not a substring check: a passphrase that merely contains the username (e.g. `"Marcel se souvient de Combray"` for user `marcel`) stays accepted, since a "contains" rule would fight the passphrase-friendly design above. Enforced in `AuthService.register()`, mirrored client-side in `RegisterForm` for immediate feedback — the backend check is the only one that actually matters. Scoped to registration only for now; `PasswordChangeService`/`PasswordResetService` don't enforce this yet — a deliberate scope decision, tracked as a follow-up.
- `password` must not appear in a known data breach — `422` if it does, checked against the [Have I Been Pwned](https://haveibeenpwned.com/) "Pwned Passwords" API (k-anonymity: only the first 5 characters of the SHA-1 hash ever leave the server) via Spring Security's `HaveIBeenPwnedRestApiPasswordChecker`, wrapped in `PasswordBreachChecker` (`auth/PasswordBreachChecker.java`). That wrapper deliberately does **not** implement Spring Security's `CompromisedPasswordChecker` interface and is not exposed as a bean of that type — doing so would make Spring Security auto-wire the check into every authentication (`login()` included, not just `register()`) via `InitializeUserDetailsBeanManagerConfigurer`, silently expanding scope and bypassing the fail-open behavior below. **Fails open**: if the HIBP API errors or times out (2s connect + 2s read), the check is skipped and registration proceeds — this is a defense-in-depth check, not a hard dependency. Scoped to registration only for now, same follow-up tracking as the identifier check above.

**LoginRequest**
```json
{ "email": "marcel@example.com", "password": "hunter2222" }
```
- `email`: valid email format, max 255 characters, normalized the same way as registration (trim + lowercase — see `EmailNormalizer`) before being checked

**UserResponse** (the only response shape returned by register/login/me)
```json
{ "uuid": "...", "username": "marcel", "email": "marcel@example.com", "role": "USER", "emailVerified": false }
```
`password`/`password_hash` never appear in any response, at any endpoint. The mapping from the internal `AuthUser` record (which does carry the hash) to `UserResponse` happens explicitly in `AuthService` — the controller never serializes an internal object directly.

---

## Why login uses email, and how the session identity model works

`email` is the login credential — a better UX bet than `username` for a mainstream product, since a user is far more likely to remember the address they registered with than an app-specific handle. `username` stays exactly as before: required, unique, the public display identity (`Header`'s "Connecté en tant que ⟨username⟩", etc.) — nothing about it changed, only what you type to log in.

Three previously-conflated things are now explicit, separate concepts — see [ADR-013](../architecture/ADR-013-authentication-identifiers-and-stable-identity.md) for the full comparison of options and why:

- **`email`** — the login credential (what authenticates you)
- **`username`** — the public identity (what other people/the UI see)
- **`users.uuid`** — the stable technical identity (what the system uses internally: session equality, rate-limit bucket keys, `user_id` foreign keys)

The session principal is a dedicated class, `ProustClubPrincipal` (`auth/ProustClubPrincipal.java`), replacing Spring Security's own `User`. Its `getUsername()` — Spring's vocabulary for "the string used to authenticate," not necessarily the app's `username` field — returns the normalized email, since that's the actual credential; `getUserId()` and `getDisplayUsername()` are separate, explicit accessors for the other two concepts. `equals()`/`hashCode()` are based on `userId` alone, deliberately — neither `username` nor `email` is trusted as the system's notion of identity, only the immutable database key is. `CurrentUser` (`auth/CurrentUser.java`) is the single place every controller in this package resolves the current principal from `Authentication`, rather than each one casting independently.

---

## Session establishment

There is no `formLogin()` — see [ADR-002](../architecture/ADR-002-session-based-api-auth.md) for why. `AuthController` calls `AuthenticationManager.authenticate(...)` directly, then persists the resulting `Authentication` into the HTTP session via `SecurityContextRepository`. `register()` reuses the exact same path with the credentials just used to create the account — auto-login is not a separate mechanism, it is `login()` called internally, now passing the registration email through the same normalization as a real login.

`PasswordResetService.confirmReset()`'s auto-login is the one path that never goes through `AuthenticationManager` (the new password was just written, re-verifying it would be pointless) — it builds a `ProustClubPrincipal` directly from the updated user and must call `eraseCredentials()` on it itself before the session is persisted, since that's normally `ProviderManager`'s job and this path bypasses `ProviderManager` entirely.

---

## No user enumeration

Login failures — unknown email or wrong password — return the same 401 with the same generic message ("Invalid email or password"). The two cases are never distinguished in the response, and this is structural, not just a matching error message: `AuthService.authenticate()`/`reauthenticate()` never look the account up themselves — resolution happens exclusively inside `AuthUserDetailsService`, reached through `AuthenticationManager`, so an unknown email pays the exact same `DaoAuthenticationProvider` timing-attack mitigation (a dummy password-encoder comparison) as a wrong password on a real account. A prior design that did a manual lookup before calling `AuthenticationManager` would skip that mitigation and leak a timing difference — see ADR-013.

---

## CSRF

CSRF protection stays enabled. The frontend must have a valid `XSRF-TOKEN` cookie before it can `POST` to `/api/auth/register` or `/api/auth/login` — in practice this is guaranteed because the app calls `GET /api/auth/me` on load to restore auth state, and that response is what carries the cookie. See [ADR-002](../architecture/ADR-002-session-based-api-auth.md).

---

## Rate limiting

`POST /api/auth/register` and `POST /api/auth/login` are rate-limited (per-IP, and per-account for login) — see [Rate limiting](rate-limiting.md) and [ADR-003](../architecture/ADR-003-rate-limiting.md). Combined with the generic 401 message (above), this is the brute-force protection for this feature.

---

## Email confirmation at registration

`register()` still auto-logs in immediately — an unconfirmed account is fully usable, this is a deliberate product decision, not a placeholder. Confirming is entirely a side channel: a reminder banner (`EmailVerificationBanner`, mounted under `Header` in `App.tsx`, visible on every page) is the only visible effect of `emailVerified` being `false`.

**Token model.** Shared with password reset via `OneTimeTokenRepository`/`SecureToken` (256-bit `SecureRandom`, SHA-256 hashed at rest, single-use — `UPDATE ... WHERE used_at IS NULL AND expires_at > now() RETURNING` burns the token and reads it in one round trip, closing the race a separate check-then-set would leave open). Email confirmation keeps its own physical table (`email_verification_tokens`, `V9__email_verification.sql`) rather than sharing rows with `password_reset_tokens` — a bug in one flow's queries still can't touch the other flow's data — but the query logic itself is generalized, parameterized by table name. TTL is 24h (vs. 30 minutes for password reset): confirming an email is a lower-stakes possession check than resetting a credential, so a longer window trades a small security margin for less friction if the user doesn't check their inbox right away.

**Sending is best-effort.** `EmailVerificationService.sendVerification()` catches `MailException` and logs a warning rather than letting it propagate — deliberately asymmetric with `PasswordResetService.requestReset()`, which lets a mail failure fail the request. A transient SMTP hiccup must not make account creation itself unreliable, since the account is already fully usable without a confirmed email.

**Confirming needs no session.** `POST /api/auth/email/confirm` is `permitAll` — the link may be opened on a different device/browser than the one used to register, so the token itself (not a cookie) is what proves the request is legitimate. Same anti-enumeration posture as password reset: `400` with a generic "invalid or expired" message, whether the token is unknown, expired, or already used.

**Existing accounts.** `V9__email_verification.sql` adds `users.email_verified BOOLEAN NOT NULL DEFAULT TRUE`, then changes the column default to `FALSE` — Postgres backfills existing rows with the `TRUE` default at `ALTER TABLE` time (no table rewrite since PG 11), so every account created before this feature is already marked confirmed; only new registrations start unconfirmed.

**Frontend.** `ConfirmEmailPage` (`/confirm-email?token=`) reads the token via `useSearchParams` and fires the confirmation through `useQuery` — not `useMutation` — specifically because `useQuery`'s dedup by `queryKey` is safe under React StrictMode's double-invoked effects for a "run this exactly once on mount" side effect; a `useEffect` + `useMutation` + guard-ref version of this page shipped a real bug where the page could get stuck on the loading state forever in dev. Since `confirmEmail()` resolves `void` (204 No Content) and TanStack Query treats a `queryFn` resolving to `undefined` as an error, the `queryFn` normalizes the result to `true` rather than changing `confirmEmail()`'s `Promise<void>` signature.

**Resending.** `POST /api/auth/email/confirm/resend` requires an active session (unlike `confirm`, which doesn't need one) — the caller has already proven account ownership, so there's no anti-enumeration reason to stay generic: an already-verified account gets a distinct `409` rather than a silent no-op. `EmailVerificationService.resendVerification()` calls the same `sendVerification()` used at registration, whose `insert()` atomically overwrites any still-unused prior token in place (upsert on a partial unique index — see `OneTimeTokenRepository`) — a user never has more than one live confirmation link at once, and two concurrent resend requests (double-click, two tabs) can't both leave a live token. Rate-limited per account (`rate-limit.email-verification-resend`, no per-IP bucket — same reasoning as `password-change`: the endpoint already requires a session). Frontend: a "Renvoyer l'email de confirmation" button inside `EmailVerificationBanner` itself, `useMutation` + toast on success, `apiErrorMessage` (409 and 429 each get a dedicated message) on failure.

**The 409 is reachable from the UI, not just the API contract.** `useCurrentUser()`'s cache can be stale — e.g. the email was confirmed via a link opened in a different tab/device, and this tab's `emailVerified` hasn't refetched yet — so the button can still be visible and clickable at the moment the account is actually already verified. Beyond showing an accurate message ("Votre adresse email est déjà confirmée." rather than the generic "try again," which would be misleading since retrying always fails identically), the `onError` handler invalidates `CURRENT_USER_QUERY_KEY` on a 409 so the banner self-corrects and disappears once the refetch confirms the account is verified — same query-invalidation mechanism `ConfirmEmailPage` already uses on a successful confirm.

---

## Frontend

```
LoginForm / RegisterForm (fields + client-side validation)
  → LoginPage / RegisterPage (TanStack Query: useMutation)
  → login() / register()      src/api/auth.ts
  → apiFetch<UserResponse>()  (adds X-XSRF-TOKEN on non-GET requests)
  → POST /api/auth/login | /api/auth/register
```

`useCurrentUser()` (`src/features/auth/useCurrentUser.ts`) wraps `GET /api/auth/me` in a `useQuery` — the single source of truth for "who is logged in," read by `Header` to switch between the logged-in/logged-out nav, and by `EmailVerificationBanner` to decide whether to show the confirmation reminder (and, inside it, the resend button). On success, the login/register mutations write directly into the `['auth', 'me']` query cache (`queryClient.setQueryData`) instead of waiting for a refetch. Logout invalidates the same key; so does a successful email confirmation (`ConfirmEmailPage`), so the banner disappears without a reload if the confirming browser happens to be logged in as that account.

Routing (`react-router`): `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/confirm-email`, `/account`.

---

## Manual verification

- Register with a new username/email → redirected to `/`, header shows "Connecté en tant que ⟨username⟩".
- Register with an already-used username → error message, no redirect.
- Register with an already-used email → same.
- Register with a password identical to the username (any case) → `400`, dedicated message, no account created.
- Register with a password identical to the email (any case) → same.
- Register with a password that merely contains the username as a substring → succeeds (non-regression for the "strict equality, not substring" decision).
- Register with a password known to be in the HIBP breach list (e.g. `123456789012345`, 15 characters, 67k+ occurrences at the time of writing) → `422`, "Ce mot de passe est trop commun. Choisissez-en un autre." shown in the UI, no account created. Verified end-to-end in a real browser against the live HIBP API — done 2026-08-15.
- Register with a long, safe passphrase → succeeds normally (non-regression). Verified end-to-end in a real browser — done 2026-08-15.
- Log out → header reverts to login/register links.
- Log back in with the same credentials → same logged-in state.
- Log in with a wrong password → generic "Identifiants invalides" message.
- Log in with an unknown email → same generic message (no hint that the email doesn't exist). Verified end-to-end against the real server: both cases return byte-identical `401` bodies — done 2026-08-27.
- Log in with the registration email in a different case (e.g. `Marcel@Example.com`) → succeeds, same account (case-insensitive, same normalization as registration). Verified end-to-end — done 2026-08-27.
- Log in with a malformed email (e.g. `not-an-email`) → `400`, rejected by `@Email` validation before any authentication attempt. Verified end-to-end (curl + `LoginPage.test.tsx`) — done 2026-08-27.
- Change password, then check a second concurrent session for the same account (e.g. logged in on two tabs/devices) → the other session is invalidated (`401 Session has expired`) on its next request; the session that performed the change stays open. Verified end-to-end against the real server, two real sessions — done 2026-08-27.
- Confirm a password reset while another session for the same account is active → that other session is invalidated the same way; the new session opened by the reset stays open. Verified end-to-end against the real server (real Mailhog token) — done 2026-08-27.
- Register → confirmation email received (Mailhog in dev), reminder banner visible under the header on every page.
- Click the confirmation link (valid, unused token) → `204`, "Votre adresse email a été confirmée." message, `users.email_verified` becomes `true`, banner disappears immediately if the confirming browser is logged in as that account.
- Confirming works with no active session (e.g. link opened in a different browser/device than the one used to register).
- Click the same confirmation link twice → second attempt shows a generic "invalid or expired" message, does not un-confirm or change anything.
- Confirm with a token that was never issued → same generic error message (`400`).
- Confirm with an empty/missing token → `400` (`@NotBlank` validation).
- Account created before this feature shipped → `email_verified` already `true` (migration backfill), no banner, no email sent.
- Click "Renvoyer l'email de confirmation" in the banner (logged in, unconfirmed) → `204`, new email received (Mailhog), toast "Email de confirmation renvoyé.", the previous link (if any) now fails with the generic "invalid or expired" message, the new link confirms successfully.
- Call resend without a session → `401`.
- Call resend on an already-verified account → `409` (e.g. via curl/Postman with a verified session).
- Confirm the email in one tab, then click resend in another tab still showing the (now stale) banner → `409` internally, "Votre adresse email est déjà confirmée." message, banner disappears shortly after as the current-user query refetches.
- Click resend repeatedly past the per-account rate limit → `429`, dedicated "Trop de tentatives. Réessayez plus tard." message, button re-enabled after the request settles.
- Reload the page while logged in → still shows as logged in (session persisted via cookie, restored via `GET /api/auth/me`).
- `GET /api/auth/me` with no session → 401.
