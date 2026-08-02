# ADR-001 : Data access — jOOQ vs JPA/Hibernate

## Decision

**jOOQ** for all database access.

## Context

Spring Boot projects default to JPA/Hibernate via Spring Data. Two main alternatives were considered:

**Option A — Spring Data JPA / Hibernate**
The standard Spring choice. Entities are annotated POJOs; queries are generated or written in JPQL. Widespread, well-documented, large ecosystem.

**Option B — jOOQ**
SQL-centric library with a type-safe DSL that mirrors SQL directly. Queries are written explicitly; nothing is generated behind the scenes.

## Why not JPA

JPA adds an abstraction layer that only pays off when the domain benefits from object graph mapping — bidirectional relationships, lazy loading, inheritance hierarchies. Proust Club has a simple, flat relational model with no such needs.

The friction JPA introduces without payoff here:

- **Magic queries.** `findByTextContainingIgnoreCase` generates SQL that is hard to predict and harder to optimize. For a project built around text search, explicit control over queries matters.
- **N+1 by default.** Lazy loading is convenient until it is not. Discovering an N+1 in production is a recurring Hibernate story.
- **Native queries for anything real.** `strpos()`, `lower()`, `gin_trgm_ops`, `LIMIT/OFFSET` — all require `@Query(nativeQuery = true)`, which bypasses the type safety JPA is supposed to provide.
- **Proxy objects and session management.** Debugging a `LazyInitializationException` is time spent on infrastructure, not on the product.

## Why jOOQ

- **SQL is explicit.** The query in the code is the query that runs. No surprises.
- **Type-safe DSL.** `DSL.field("text", String.class)` — the compiler catches field name typos and type mismatches (further improved once jOOQ code generation is wired up).
- **Full SQL expressiveness.** Window functions, CTEs, custom PostgreSQL functions — all available without workarounds.
- **Fits the use case.** Proust Club is query-heavy by nature: substring search, offset calculation, position-ordered results. jOOQ is a better fit than an ORM for this workload.

## Tradeoff accepted

jOOQ requires more explicit code than Spring Data repositories. There is no `findById` for free. This is acceptable: the explicitness is the point, and the query surface of this project is small enough that verbosity is not a concern.

## Date

2026-06-27
