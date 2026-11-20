# Admin console

The private admin console gives the operator a compact view of account and saved-content totals, a 30-day registration/deletion history, and controls for email alerts. It is served by the existing React app at `/admin`; the login page is `/admin/login`. The interface reuses Proust Club's page/surface and prune accent tokens, Fraunces display titles and DM Sans controls. It omits the reader navigation while in the admin route.

## Access and authentication

`POST /api/admin/auth/login` takes an email, password and either a six-digit TOTP or one unused recovery code. A successful second-factor check opens the existing secure session. The endpoint applies the login rate limits. `/api/admin/**` is role-protected by Spring Security; the frontend route guard only improves navigation and is not an authorization control.

Admin accounts cannot use `POST /api/auth/login`, which rejects them with the same generic invalid-credentials response used for a failed login. Password-reset confirmation changes the admin password and invalidates existing admin sessions but does not create a new session; the admin must sign in through the MFA endpoint afterward.

The first admin is provisioned with the private CLI command described in the workspace's `private/notes-techniques/admin-bootstrap.md` operator runbook. It promotes one already-verified `USER`; there is no public or HTTP role-promotion operation. This supports both local and production databases through the configured DB connection.

If the authenticator and all recovery codes are lost, `./gradlew resetAdminMfa` replaces the stored TOTP credential and recovery codes for the verified admin account. This is a privileged offline operation, requires `ADMIN_CONFIRM_MFA_RESET=RESET`, and prints the new setup details once. Stop every backend instance before running it and restart afterward; the app's current session registry is in memory, and restart invalidates those sessions.

## Data and privacy

- The registered-user total counts existing `USER` rows. Quote and tag totals are live counts owned by `USER` accounts; admin accounts are excluded.
- The 30-day activity view reads UTC daily totals. Registration and account deletion counters are incremented in the business transaction. A deletion remains countable after the user's row and personal data are removed.
- The metrics store no user identifier. The admin notification outbox stores only event type, time and retry state. It contains neither an email nor quote content; the recipient is resolved from the current admin row when sent.
- Email notifications default to enabled when the first admin is provisioned. Their switches persist in the admin console. Delivery is retried independently of registration/deletion, with bounded batches and backoff; messages contain only the event type.
- The console does not show per-user citations, comments, tags or reading history, and does not measure login/session duration.

## Operations and network boundary

`ADMIN_MFA_ENCRYPTION_KEY` must be a stable base64-encoded 32-byte key provided through the runtime environment or secret store. The app fails closed for MFA provisioning and verification when the key is missing or invalid. Keep different keys for local and production environments. Do not put the key, TOTP setup URI or recovery codes in source control, normal application logs or a shared transcript.

The backend and frontend remain in the same deployment for this version. If a future hosting provider supports a trusted IP allowlist, apply it at the proxy/WAF boundary after selecting the production topology. A dynamic home IP may need a VPN with a fixed egress address. Do not use `X-Forwarded-For` as an application-level access check.

## Manual verification

1. Start local PostgreSQL and MailHog with `docker compose up -d` from the repository root.
2. Start the backend and frontend. Create a normal account, confirm its email using the message captured in MailHog at `http://localhost:8025`, and log out.
3. Generate a fresh local `ADMIN_MFA_ENCRYPTION_KEY`, set `ADMIN_BOOTSTRAP_EMAIL` to that verified account, and run `./gradlew provisionAdmin` from `apps/backend/`. Record the one-time setup URI in an authenticator and save all recovery codes in a password manager. Do not run the command a second time: it refuses if any admin already exists.
4. Restart the backend with the same `ADMIN_MFA_ENCRYPTION_KEY` still set. The key must be stable across local restarts.
5. Open `http://localhost:5173/admin/login`, sign in with password and TOTP, then check the totals and activity. Sign out and verify that `/api/admin/dashboard` returns 401 without a session.
6. Sign in as a normal user and request `/api/admin/dashboard`; expect 403. A request through ordinary `/api/auth/login` for the admin account must fail generically.
7. Toggle each notification setting, refresh the page, and confirm it persists. Register or delete a test account with the matching setting enabled and confirm the minimal message arrives in MailHog; disable the setting and repeat to confirm no message arrives. Restart the backend and confirm the preferences remain.
8. Confirm an admin password-reset link does not create a logged-in session. Sign in again using MFA.
9. Before production launch, run the one-shot command in the production runtime with the production database and secret-store key, then sign in at `/admin/login`. Verify the chosen hosting boundary's IP restriction separately after the hosting provider and allowed source network are known.
