# ADR-011: Rejecting breached passwords at registration — wrapped `HaveIBeenPwnedRestApiPasswordChecker`, not a `CompromisedPasswordChecker` bean

## Decision

**Spring Security's native `HaveIBeenPwnedRestApiPasswordChecker`, called explicitly from `AuthController.register()` via a small wrapper (`PasswordBreachChecker`) that deliberately does *not* implement the `CompromisedPasswordChecker` interface.** No third-party dependency added.

## Context

Registration only ever validated password *shape* (length 15–128, not identical to the username/email) — never whether the chosen password is already known to be compromised. Optional for the MVP, already noted as such in the original auth security audit (`private/impl/auth-3-audit-securite.md`, §10).

**Option A — no check at all (status quo)**
Zero implementation cost, but leaves a well-known, cheap-to-close gap: users can register with `password123` and nothing stops them.

**Option B — third-party client library (`pwnedpasswords4j`, `haveibeenpwned4j`, etc.)**
Java clients for the HIBP "Pwned Passwords" k-anonymity API exist on Maven Central. Adds a new runtime dependency for something Spring Security already ships natively as of 6.3 (this project is on Spring Security 7.1, via Spring Boot 4.1).

**Option C — Spring Security's native `CompromisedPasswordChecker` / `HaveIBeenPwnedRestApiPasswordChecker`, exposed as a `@Bean`**
The obvious, documented way to wire this in: declare a `CompromisedPasswordChecker` bean in `SecurityConfig`, same pattern as `PasswordEncoder`. No new dependency.

**Option D — Option C's exact mechanism, but *not* exposed as a `CompromisedPasswordChecker`-typed bean**
Same underlying `HaveIBeenPwnedRestApiPasswordChecker`, but wrapped in a project-owned class (`PasswordBreachChecker`) that does not implement the Spring Security interface, so no bean of that exact type ever exists in the application context.

## Why not Option C

Confirmed by decompiling `spring-security-config` 7.1.0: `InitializeUserDetailsBeanManagerConfigurer` looks up any `CompromisedPasswordChecker` bean via `ApplicationContext.getBeanProvider(CompromisedPasswordChecker.class).getIfUnique()` and, if one exists, wires it into the default `DaoAuthenticationProvider` it builds for the global `AuthenticationManager` — the exact `AuthenticationManager` this project's `AuthController` calls on every `login()` and on `register()`'s auto-login. Declaring the bean the "normal" way would therefore silently run the breach check on **every authentication**, not just registration — not documented anywhere in Spring's reference docs, and found only by tracing a genuinely surprising integration-test failure (a mocked network error on `register()` propagating out of `AuthService.reauthenticate()`, called from the *login* code path, not the registration code being tested).

That silent scope expansion would also have broken the fail-open guarantee: the auto-wired path inside `DaoAuthenticationProvider` does not catch and swallow exceptions from the checker the way `AuthService.checkPasswordNotCompromised()` does — an HIBP timeout would fail *closed*, turning a defense-in-depth check into a hard dependency for every login.

## Why Option D

`PasswordBreachChecker` builds `HaveIBeenPwnedRestApiPasswordChecker` directly in its constructor (not injected, not exposed as any Spring Security type) and exposes a single project-specific method, `isCompromised(String password)`. Because it never appears in the context as a `CompromisedPasswordChecker`, `InitializeUserDetailsBeanManagerConfigurer` finds nothing to attach to `DaoAuthenticationProvider`. `AuthController.register()` calls it explicitly, exactly once, before `AuthService.register()` — the same shape as the existing `rateLimiter.checkRegisterByIp()` pre-check.

```java
// PasswordBreachChecker — not a CompromisedPasswordChecker
@Component
class PasswordBreachChecker {
    private final HaveIBeenPwnedRestApiPasswordChecker delegate;

    PasswordBreachChecker() {
        // custom RestClient: short timeout, and baseUrl re-set explicitly —
        // HaveIBeenPwnedRestApiPasswordChecker has no getter to recover it after
        // setRestClient() replaces its default RestClient wholesale
        ...
    }

    boolean isCompromised(String password) {
        return delegate.check(password).isCompromised();
    }
}
```

```java
// AuthController.register()
rateLimiter.checkRegisterByIp(httpRequest);
service.checkPasswordNotCompromised(request.password());   // fail-open, register()-only
var created = service.register(request);
```

Sends only the first 5 characters of the password's SHA-1 hash to the HIBP API (k-anonymity, guaranteed by Spring Security's own implementation) — the plaintext password and the full hash never leave the server.

## Tradeoff accepted

- **Fail-open.** If the HIBP API errors or times out (2s connect + 2s read), the check is skipped and registration proceeds — this is deliberately a defense-in-depth layer, not a hard dependency for account creation, consistent with how `EmailVerificationService.sendVerification()` already treats a best-effort external call. **Where this actually happens, found by `/code-review` + confirmed by decompilation:** `HaveIBeenPwnedRestApiPasswordChecker.check()` already swallows `RestClientException` (timeout, connection failure, HIBP 4xx/5xx) internally and returns "not compromised," logging the failure itself (`Log.error`, its own logger) — this is the real fail-open path for a genuine HIBP outage, not `AuthService.checkPasswordNotCompromised()`'s own `catch (RuntimeException e)`, which only fires for something that delegate doesn't already handle (a bug in `PasswordBreachChecker`, an unexpected NPE). The original code comments and tests incorrectly implied the latter was the primary mechanism — corrected in both.
- ~~**Scoped to `register()` only.**~~ Lifted 2026-08-17, see addendum below.
- **Runs before the cheap in-process checks** (duplicate username/email, password ≠ identifier) that already live inside `AuthService.register()`, so a request that would fail for free still pays for the external HTTP round trip first. Noted, not fixed in this iteration — would require pulling those checks out of `register()`'s single `@Transactional` method, which is out of scope for this change. Tracked as its own follow-up (`private/tickets/breach-check-avant-verifications-bon-marche.md`).
- **Duplicates Spring Security's private `API_URL` constant** (`"https://api.pwnedpasswords.com/range/"`) as a local constant, since `HaveIBeenPwnedRestApiPasswordChecker` exposes no getter to recover its default `RestClient`'s base URL before `setRestClient()` replaces it. `PasswordBreachCheckerTest` exercises the real construction/wiring (baseUrl, timeout, RestClient) against a local HTTP stub (`com.sun.net.httpserver.HttpServer`, JDK built-in — deliberately not the live HIBP API, to avoid this backend's first test with an outbound-internet dependency) specifically to catch a future drift here; verified it actually catches the original bug by temporarily reintroducing it. The live end-to-end path (real API, real registration) is covered by manual verification instead — browser, Swagger UI, Postman/Newman — not by an automated test.

## Date

2026-08-15

## Addendum — 2026-08-17: extended to change-password and reset-confirm

The `register()`-only scope was always meant to be revisited (see the follow-up ticket referenced above at the time). Extended to the two other flows that let a user write a new password:

- `PasswordChangeService.checkNewPasswordNotCompromised()` — called by `PasswordChangeController` after the current password is re-verified (cheap, local) and before the transactional write, same cost-ordering reasoning as `register()`'s own pre-checks.
- `PasswordResetService.checkNewPasswordNotCompromisedIfTokenLooksValid()` — this one's gated on a read-only peek (`OneTimeTokenRepository.existsValidToken()`) rather than called unconditionally, because `POST /api/auth/password-reset/confirm` is unauthenticated: without the peek, any request carrying a made-up token would still pay for a real HIBP round trip. `confirmReset()` itself still atomically revalidates and consumes the token regardless of what the peek observed — the peek is purely a cost optimization, never the source of truth on token validity. This also means a password rejected by the breach check never burns the reset link — see [reset-password.md](../features/reset-password.md) "Token lifecycle" for the exact ordering.

Same fail-open/`422` behavior as `register()` on both flows — nothing about the calling context (authenticated session vs. token possession) changes the reasoning in "Why Option D" above.

One new tradeoff introduced by the `reset-confirm` extension specifically: `POST /api/auth/password-reset/confirm` previously did only cheap local DB work and had no rate limit of its own. Now that it can trigger a real outbound HTTP call, it has a dedicated per-IP bucket (`rate-limit.password-reset-confirm`, same profile as `register()`) — found missing by `/code-review` before merge, not an oversight left in.

A related, lower-severity finding from `/security-review` was considered and not acted on: gating the breach check on `existsValidToken()` means a caller who already possesses a raw, valid reset token can now distinguish "still valid" (422 on a known-breached password, no side effect) from "dead" (400) without ever completing the reset — a discreet liveness oracle. Not fixed: the actual security boundary is possession of the unguessable 256-bit token itself, which this doesn't weaken — a holder of a live token could already take the account over destructively before this change. See `private/impl/breach-check-change-password-reset-confirm-3-review.md` for the full reasoning.
