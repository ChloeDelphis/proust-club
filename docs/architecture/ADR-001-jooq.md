# ADR-001 : Data access — jOOQ vs JPA/Hibernate

## Decision

Use jOOQ's DSL for database access. Do not introduce JPA/Hibernate.

## Context

Proust Club has a small relational model and query-heavy features, especially corpus search. JPA would add entity mapping and lifecycle behavior without a current need for object-graph persistence. jOOQ keeps queries explicit and supports PostgreSQL features directly.

## Rationale and trade-off

jOOQ gives the code control over joins, filters, ordering, and database-specific expressions. It also requires more query code than repository-derived JPA methods.

The backend generates jOOQ table and column references from the PostgreSQL schema after applying Flyway migrations. Repositories use these references for static schema objects, so Java compilation checks that table and column names still exist and that their types match. Generated sources are derived build output, not version-controlled files. The build therefore requires a PostgreSQL database that can be migrated before code generation.

## Decision history

- **2026-06-27** — The project initially used explicit jOOQ DSL fields without code generation to keep the first backend setup small. That left schema names in strings unchecked at compile time.
- **2026-10-16** — Adopt the official jOOQ Gradle code generator. The parser-backed DDL source was prototyped against all Flyway migrations but could not parse PostgreSQL's `gin_trgm_ops` index in V3. Generation therefore inspects a real PostgreSQL schema after Flyway migration, keeping PostgreSQL as the authority without duplicating schema definitions. Generated sources are reproducible build output; code generation runs before Java compilation and CI supplies PostgreSQL.

## Date

2026-06-27
