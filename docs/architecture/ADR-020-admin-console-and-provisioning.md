# ADR-020: Admin console authentication and provisioning

## Status

Accepted — 2026-11-20.

## Decision

- Keep the admin UI in the existing React application at `/admin`, and expose its data through dedicated `/api/admin/**` endpoints. Spring Security checks `ROLE_ADMIN` on every admin endpoint. A future subdomain or IP allowlist is a deployment choice and does not replace this backend authorization.
- Authenticate admins through a dedicated endpoint that requires the ordinary password and a TOTP or unused recovery code in one request. The ordinary login endpoint refuses admin accounts, so it cannot create a password-only admin session. Admin password reset also never opens a session; the admin must complete MFA at the next login.
- Store each TOTP secret encrypted with AES-GCM using a 256-bit key supplied as `ADMIN_MFA_ENCRYPTION_KEY`, outside the database. Store recovery codes as SHA-256 hashes and consume them once. Fail closed if the encryption key is absent or invalid.
- Provision the first admin through a private command-line task. The operator first creates and verifies a normal account, then runs the task against the intended database. The command is one-shot, refuses an existing admin, prints the TOTP setup URI and recovery codes once, and exposes no HTTP role-promotion endpoint. The same task works with the local or production database configuration.
- Keep usage data limited to daily aggregate registration/deletion counts and current totals for registered users, saved quotes and tags. Admin notification delivery uses an identity-free outbox and retries; messages contain no user details or quote text.

## Context

The pre-launch admin is for one operator and a small set of operational counts, not individual-user support or behavioral analytics. The MVP uses session cookies and already has a `USER`/`ADMIN` role, but normal password login would otherwise create an admin session with no second factor. Public signup must never grant the admin role. Account deletion physically removes the account, so a deletion count must be recorded in the same transaction without retaining the deleted user's identity.

## Consequences

- Local development also requires MFA; it does not use a weaker password-only shortcut. Localhost itself is not IP restricted.
- The operator must keep the encryption key stable and backed up independently of the database. Rotating it requires an explicit secret re-encryption procedure; replacing it directly makes stored MFA secrets unreadable.
- Recovery-code loss requires a deliberate operator recovery through secured database/CLI access; there is no email-based MFA bypass.
- An IP allowlist is not part of application authorization. Add it at the selected trusted proxy/hosting boundary only after the deployment network is known; do not trust a client-supplied forwarding header.
- Session duration analytics and per-user admin inspection remain out of scope.

## Manual verification

See [Admin console](../features/admin-console.md#manual-verification) for local account provisioning, MFA login, authorization checks, notification controls and production run guidance.
