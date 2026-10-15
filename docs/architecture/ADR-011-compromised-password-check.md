# ADR-011: Check new passwords against the HIBP compromised-password service

## Decision

Use Spring Security's `HaveIBeenPwnedRestApiPasswordChecker` through the project wrapper `PasswordBreachChecker`. Call it explicitly for registration, authenticated password change, and password-reset confirmation. Do not expose a `CompromisedPasswordChecker` bean: Spring Security would attach that bean to authentication and run it during login as well.

The checker sends only the first five characters of the password's SHA-1 hash to HIBP using its k-anonymity API. The plaintext password and full hash stay on the server.

## Context and rationale

Spring Security already provides the HIBP client, so no third-party dependency is needed. The wrapper keeps the check limited to flows that write a password and configures short HTTP timeouts. A typed Spring Security bean would also affect the default `DaoAuthenticationProvider`, extending the check to login.

The check is fail-open: the Spring checker treats `RestClientException` as not compromised, and `AuthService` catches unexpected runtime failures as a secondary safeguard. A compromised password is rejected with the password-policy response.

## Ordering

Registration performs cheap local validation before the HIBP request. Password change verifies the current password first. Reset confirmation performs a read-only valid-token lookup before the HIBP request, then atomically validates and consumes the token during the password update. Reset confirmation has its own per-IP rate limit because it can call HIBP.

## Trade-offs

Password writes depend on an external service when it responds, but failures do not block account recovery or password changes. The reset pre-check can reveal whether a token is live to someone who already possesses it; possession of the unguessable token remains the authorization boundary.

## Date

2026-08-15

## Scope update

2026-08-17 — Extended the check from registration to password change and reset confirmation.
