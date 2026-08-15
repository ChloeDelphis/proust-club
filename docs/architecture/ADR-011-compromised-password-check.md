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
- **Scoped to `register()` only.** `PasswordChangeService`/`PasswordResetService` don't enforce this yet — same scope decision already made for the password ≠ identifier check, tracked as a follow-up rather than expanded here.
- **Runs before the cheap in-process checks** (duplicate username/email, password ≠ identifier) that already live inside `AuthService.register()`, so a request that would fail for free still pays for the external HTTP round trip first. Noted, not fixed in this iteration — would require pulling those checks out of `register()`'s single `@Transactional` method, which is out of scope for this change. Tracked as its own follow-up (`private/tickets/breach-check-avant-verifications-bon-marche.md`).
- **Duplicates Spring Security's private `API_URL` constant** (`"https://api.pwnedpasswords.com/range/"`) as a local constant, since `HaveIBeenPwnedRestApiPasswordChecker` exposes no getter to recover its default `RestClient`'s base URL before `setRestClient()` replaces it. A `PasswordBreachCheckerTest` that exercises the real HTTP call (no mock) exists specifically to catch a future drift here — this exact mismatch shipped once already and went undetected by every mocked test, caught only by `/code-review`.

## Date

2026-08-15
