# ADR-004: Error handling — `ErrorResponseException` over a global exception handler

## Decision

Business exceptions continue to extend Spring's `ErrorResponseException` and build their own `ProblemDetail` (status + detail, plus extra behavior when needed — e.g. the `Retry-After` header on `RateLimitExceededException`). No `@RestControllerAdvice` / global exception-to-HTTP mapping layer is introduced. Business exceptions are therefore coupled to Spring Web types (`HttpStatus`, `ProblemDetail`, `ErrorResponseException`) by design — this coupling is accepted, not accidental.

## Context

While auditing the API's error-handling contract (see `private/tickets/error-handling-contract.md`), two options were on the table:

**Option A — Plain `RuntimeException` + `@RestControllerAdvice`**
Business exceptions stay HTTP-agnostic; a single `ApiExceptionHandler` maps each exception type to a status/`ProblemDetail`. Cleaner separation of concerns on paper, but every new business exception (e.g. `CitationNotFoundException`, `TagNotFoundException` for the upcoming quote-saving step) requires a new `@ExceptionHandler` case — hand-written dispatch code that duplicates what Spring already does natively for `ErrorResponseException`.

**Option B — Keep extending `ErrorResponseException`** (chosen)
Already in place for `ApiException` (auth) and `RateLimitExceededException` (rate limiting). Spring's `DefaultHandlerExceptionResolver` resolves `ErrorResponseException` natively — zero dispatch code, whether there are 2 exception types or 20. The tradeoff: each exception knows its own HTTP status and constructs its `ProblemDetail` directly.

## Why Option B

Proust Club's backend is, and is expected to remain, a Spring Boot API — there is no concrete plan to extract a transport-agnostic domain core reused by a non-HTTP consumer. Given that, "rely on Spring MVC's native error support" (one of the project's explicit error-handling goals) outweighs the theoretical benefit of an HTTP-agnostic exception hierarchy that today has no consumer other than this same API. Writing an `ApiExceptionHandler` now would mean maintaining dispatch code that duplicates behavior Spring already provides for free, for a separation of concerns that isn't crossing any real boundary yet.

## Reevaluation trigger

Revisit if a domain layer independent of HTTP transport is ever extracted — at that point, business exceptions knowing about `ProblemDetail` would become a leak across a real boundary, not a theoretical one.

## Convention

- Keep exceptions close to the feature that throws them, not in a separate `exception/` subpackage.
- Group related simple errors sharing the same shape in one class with named static factories (see `auth/ApiException.java`).
- Give an exception its own class only when it carries real behavior beyond status + message (see `ratelimit/RateLimitExceededException.java`, which computes a `Retry-After` header).
- No `try/catch` in controllers solely to build an HTTP response.

## Date

2026-08-02
