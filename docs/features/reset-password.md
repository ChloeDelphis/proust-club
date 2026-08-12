# Password management — Technical Design

Two distinct flows for changing a password, covered together since they're the same product concern ("manage your password") and share most of their session-invalidation machinery:

- **Reset password (forgot password)** — via email + token, for a user who has forgotten their password and is not logged in. See below.
- **Change password (while logged in)** — for an already-authenticated user who knows their current password, no email/token involved. See [Change password (while logged in)](#change-password-while-logged-in) further down.

See [Auth](auth.md) for the base session/CSRF model both flows reuse.

## Reset password (forgot password)

---

## Endpoints

| Method | Path | Auth required | Purpose |
|---|---|---|---|
| POST | `/api/auth/password-reset/request` | none | Send a reset link by email if it matches an account. Always returns the same generic response |
| POST | `/api/auth/password-reset/confirm` | none (proven by token) | Set a new password from a valid token, open a session (auto-login) |

Changing a password for an already-logged-in user (with the current password, no email/token) is a separate flow — see [Change password (while logged in)](#change-password-while-logged-in) below.

---

## Request / response shapes

**PasswordResetRequestRequest**
```json
{ "email": "marcel@example.com" }
```

**Response (always, regardless of whether the email matched an account)**
```json
{ "message": "If an account exists for this email, a reset link has been sent." }
```

**PasswordResetConfirmRequest**
```json
{ "token": "lCXCmUgFVwG7foD6O0jgNq1jQOt86aoF8CI9Nipo8f8", "newPassword": "Le cote de chez Swann" }
```
- `newPassword`: same constraints as registration (15–128 characters, see [Auth](auth.md)).

**Response** — `UserResponse`, same shape as register/login/me (see [Auth](auth.md)). Confirming a reset opens a session, same as auto-login after registration.

---

## Token lifecycle

- Generated with `SecureRandom` (32 bytes, base64url-encoded) — never `UUID.randomUUID()`.
- Stored **hashed** (SHA-256, not Argon2id) in a dedicated `password_reset_tokens` table (`user_id`, `token_hash`, `expires_at`, `used_at`). SHA-256 rather than Argon2id: the token is already 256 bits of random entropy and short-lived/single-use, so a fast hash is enough — Argon2id's deliberate slowness defends against guessing a human-chosen password, which doesn't apply here.
- Valid for **30 minutes**.
- A user only ever has one live token: requesting a new reset invalidates any earlier unused token for that account.
- **Validated and burned in a single atomic `UPDATE ... RETURNING`** (`PasswordResetTokenRepository.consumeValidToken`), not a separate check-then-set — this closes a race window between two concurrent confirm attempts presenting the same token, and means the token is spent the instant a confirm attempt reaches the service, whether or not that attempt goes on to succeed. It's spent *after* the new password has already passed `@Size(min=15, max=128)` validation on the request DTO though, so a syntactically invalid password (a typo) doesn't burn the link — only a confirm attempt with a well-formed password does.
- The generic error `Invalid or expired reset token.` (400) never distinguishes "expired" from "already used" from "never existed."

---

## No account enumeration

`POST /request` always returns the same 202 with the same generic message, whether or not the email matches an account — the request handler itself (`PasswordResetService.requestReset`) never throws and the controller has no branch on the result.

---

## Session handling on confirm

Confirming a reset opens a new session directly from the `AuthUser` the service just updated — it does **not** re-authenticate through `AuthenticationManager` (that would mean a redundant DB round-trip plus an Argon2id re-verification of a password the same method just wrote). `AuthUserDetailsService.toUserDetails(AuthUser)` builds the same `UserDetails` shape `loadUserByUsername` would, and `PasswordResetController` wraps it directly into an authenticated `UsernamePasswordAuthenticationToken`.

Every other active session for that account is invalidated (the new one is excluded), via `SessionRegistry` — see [ADR-010](../architecture/ADR-010-session-invalidation.md) for the mechanism and its one real limitation (invalidation is lazy, not instant, on a single-instance deployment).

---

## CSRF

Same invariant as the rest of the API: CSRF stays active on both endpoints even though they're `permitAll()` (anonymous access and CSRF protection are independent). The `/reset-password` page can be reached as a direct link from an email client, with no prior navigation on the site — the CSRF cookie is nonetheless already present by the time the form is submitted, because `Header` (rendered above every route) fires `GET /api/auth/me` on mount regardless of which page loaded first. Manually verified: see "Manual verification" below.

---

## Rate limiting

`POST /api/auth/password-reset/request` is rate-limited by IP and by account (normalized email) — see [Rate limiting](rate-limiting.md). `POST /confirm` is not separately rate-limited: a wrong/expired token there is a dead end regardless (the token itself is the only thing being brute-forced, and it's 256 bits of entropy).

---

## Frontend

```
ForgotPasswordForm (email field)
  → ForgotPasswordPage (TanStack Query: useMutation)
  → requestPasswordReset()        src/api/auth.ts
  → POST /api/auth/password-reset/request

ResetPasswordForm (new password field)
  → ResetPasswordPage (reads ?token= via useSearchParams)
  → confirmPasswordReset()        src/api/auth.ts
  → POST /api/auth/password-reset/confirm
  → on success: writes the returned user into the ['auth', 'me'] query cache
    (same pattern as login/register), shows a toast, redirects to /
```

Routes: `/forgot-password`, `/reset-password` (reads `token` from the query string). `LoginPage` links to `/forgot-password`. Both pages share `AuthPage.module.css` with `LoginPage`/`RegisterPage` (identical layout, same precedent as `AuthForm.module.css`).

---

## Change password (while logged in)

For an authenticated user who knows their current password — no email, no token. Complements the reset flow above rather than replacing it: a shared/unattended device left logged in must not let someone silently take over the account just because a session is open, so the current password is always re-verified first.

### Endpoint

| Method | Path | Auth required | Purpose |
|---|---|---|---|
| POST | `/api/auth/password` | yes (session) | Re-verify the current password, then set a new one |

No new Flyway migration — `users.password_hash` already exists (V4).

### Request / response shape

**PasswordChangeRequest**
```json
{ "currentPassword": "Les madeleines de Combray", "newPassword": "Le cote de chez Swann" }
```
- `newPassword`: same constraints as registration/reset (15–128 characters, see [Auth](auth.md)).

**Response** — `204 No Content`, no body. Unlike register/confirm-reset, this endpoint never opens a new session (one is already open) and nothing about the caller's identity changes — there's nothing to return.

### Current password re-verification

Goes through the same `AuthenticationManager` round-trip as login (`AuthService.reauthenticate`, extracted from `AuthService.authenticate` so the "User logged in" log line — accurate for an actual login — isn't emitted for what is really a re-verification on an already-open session). A wrong current password returns the exact same generic `401 Invalid username or password.` as a failed login — no distinct error code or message that would tell a caller *why* it failed beyond "the endpoint requires proof of the current password."

### Session handling

Unlike reset's `confirm`, this flow never opens a new session — the one making the request stays exactly as it is. Every *other* active session for the account is invalidated (`SessionInvalidator.invalidateOtherSessions`, the same `SessionRegistry`-backed component the reset flow uses — extracted out of `PasswordResetService` once this became its second consumer, see [ADR-010](../architecture/ADR-010-session-invalidation.md)).

### Rate limiting

`POST /api/auth/password` is rate-limited **by account only** (no per-IP bucket) — see [Rate limiting](rate-limiting.md). Unlike login/register/password-reset, this endpoint already requires an authenticated session, so an anonymous IP-based bucket adds nothing a session cookie doesn't already gate; the account bucket exists to stop someone with access to an open session from brute-forcing the current password.

### Frontend

```
ChangePasswordForm (current password + new password fields)
  → AccountPage (route /account, TanStack Query: useMutation)
  → changePassword()              src/api/auth.ts
  → POST /api/auth/password
  → on success: toast; on 401: "Mot de passe actuel incorrect.";
    on any other error: generic failure message
```

Route: `/account` (English in code — routes/identifiers stay in English project-wide even though the UI text is French; the page title and Header link both read "Compte"/"Mon compte"). Reachable via a "Mon compte" link in `Header`, next to "Mes citations", shown only when connected. `AccountPage` uses the same ad hoc protection pattern as `MyQuotesPage` (`useCurrentUser()` + redirect to `/login` if not connected) rather than a shared component — noted as a candidate for promotion once truly needed, see `private/impl/changement-mot-de-passe-connecte-3-review.md`.

### Manual verification — change password

- Change with the correct current password → `204`, session making the request stays logged in.
- Change with an incorrect current password → `401`, generic message (same as a failed login).
- Change with a new password shorter than 15 characters → client-side validation blocks submission; server also rejects with `400` if bypassed.
- Call the endpoint with no session → `401` (or `403` if the request also lacks a CSRF token — CSRF is checked before authentication in the filter chain).
- Log in from a second session, change the password from the first → the second session's next request is rejected (`401`), the first stays valid.
- Log in with the old password after a successful change → `401`. Log in with the new password → `200`.
- Exceed 5 change attempts for the same account within 15 minutes → `429` with a `Retry-After` header.

---

## Manual verification — reset password

- Request a reset for a known email → generic confirmation message, email appears in Mailhog (`http://localhost:8025` in dev).
- Request a reset for an unknown email → identical generic message, no email sent.
- Request a reset with an invalid email format → 400.
- Click the link from the email in a **fresh browser tab with no prior navigation on the site** → the form loads and submits successfully (CSRF cookie already present via `Header`'s mount-time `/me` call — see "CSRF" above).
- Submit a new password → redirected to `/`, logged in as the account owner, toast shown.
- Log in with the old password afterward → 401.
- Log in with the new password afterward → 200.
- Submit the reset form with a token that was never issued → generic invalid/expired message.
- Submit the reset form twice with the same (already-used) token → second attempt gets the generic invalid/expired message.
- Submit a new password shorter than 15 characters → client-side validation blocks submission (no request sent); if bypassed, server also rejects with 400 and the token is **not** consumed (verify the same token still works with a valid password afterward).
- Visit `/reset-password` with no `token` query parameter → "invalid link" message, no form shown.
- Log in on a second device/browser, then complete a reset from a first device → the second device's session is rejected (401, `ProblemDetail`) on its next request; the reset itself stays logged in.
