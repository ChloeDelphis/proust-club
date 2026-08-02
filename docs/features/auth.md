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

---

## Request / response shapes

**RegisterRequest**
```json
{ "username": "marcel", "email": "marcel@example.com", "password": "hunter2222" }
```
- `username`: 3–50 characters
- `email`: valid email format, max 255 characters
- `password`: 15–128 characters. Length over composition rules — no uppercase/digit/symbol requirement, passphrases and spaces are welcome (current NIST guidance: 15+ characters for a password used as the sole factor, since there's no MFA here). The upper bound is a sanity limit on hashing cost, not an algorithm quirk — Argon2id's cost scales with input size, so an unbounded password is a cheap way to make the server do expensive work

**LoginRequest**
```json
{ "username": "marcel", "password": "hunter2222" }
```

**UserResponse** (the only response shape returned by register/login/me)
```json
{ "uuid": "...", "username": "marcel", "email": "marcel@example.com", "role": "USER" }
```
`password`/`password_hash` never appear in any response, at any endpoint. The mapping from the internal `AuthUser` record (which does carry the hash) to `UserResponse` happens explicitly in `AuthService` — the controller never serializes an internal object directly.

---

## Why login uses username, not email

`users.username` is the non-nullable, application-facing identifier (see `data-model.md`). Email stays unique for contact/identity purposes but is not the login key for the MVP — one identifier for authentication keeps the login flow and error messages simple.

---

## Session establishment

There is no `formLogin()` — see [ADR-002](../architecture/ADR-002-session-based-api-auth.md) for why. `AuthController` calls `AuthenticationManager.authenticate(...)` directly, then persists the resulting `Authentication` into the HTTP session via `SecurityContextRepository`. `register()` reuses the exact same path with the credentials just used to create the account — auto-login is not a separate mechanism, it is `login()` called internally.

---

## No user enumeration

Login failures — unknown username or wrong password — return the same 401 with the same generic message ("Invalid username or password"). The two cases are never distinguished in the response.

---

## CSRF

CSRF protection stays enabled. The frontend must have a valid `XSRF-TOKEN` cookie before it can `POST` to `/api/auth/register` or `/api/auth/login` — in practice this is guaranteed because the app calls `GET /api/auth/me` on load to restore auth state, and that response is what carries the cookie. See [ADR-002](../architecture/ADR-002-session-based-api-auth.md).

---

## Rate limiting

`POST /api/auth/register` and `POST /api/auth/login` are rate-limited (per-IP, and per-account for login) — see [Rate limiting](rate-limiting.md) and [ADR-003](../architecture/ADR-003-rate-limiting.md). Combined with the generic 401 message (above), this is the brute-force protection for this feature.

---

## Frontend

```
LoginForm / RegisterForm (fields + client-side validation)
  → LoginPage / RegisterPage (TanStack Query: useMutation)
  → login() / register()      src/api/auth.ts
  → apiFetch<UserResponse>()  (adds X-XSRF-TOKEN on non-GET requests)
  → POST /api/auth/login | /api/auth/register
```

`useCurrentUser()` (`src/features/auth/useCurrentUser.ts`) wraps `GET /api/auth/me` in a `useQuery` — the single source of truth for "who is logged in," read by `Header` to switch between the logged-in/logged-out nav. On success, the login/register mutations write directly into the `['auth', 'me']` query cache (`queryClient.setQueryData`) instead of waiting for a refetch. Logout invalidates the same key.

Routing (`react-router`, introduced with this feature): `/`, `/login`, `/register`.

---

## Manual verification

- Register with a new username/email → redirected to `/`, header shows "Connecté en tant que ⟨username⟩".
- Register with an already-used username → error message, no redirect.
- Register with an already-used email → same.
- Log out → header reverts to login/register links.
- Log back in with the same credentials → same logged-in state.
- Log in with a wrong password → generic "Identifiants invalides" message.
- Log in with an unknown username → same generic message (no hint that the username doesn't exist).
- Reload the page while logged in → still shows as logged in (session persisted via cookie, restored via `GET /api/auth/me`).
- `GET /api/auth/me` with no session → 401.
