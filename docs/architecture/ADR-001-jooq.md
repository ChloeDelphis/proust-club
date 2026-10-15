# ADR-001 : Data access — jOOQ vs JPA/Hibernate

## Decision

Use jOOQ's DSL for database access. Do not introduce JPA/Hibernate.

## Context

Proust Club has a small relational model and query-heavy features, especially corpus search. JPA would add entity mapping and lifecycle behavior without a current need for object-graph persistence. jOOQ keeps queries explicit and supports PostgreSQL features directly.

## Rationale and trade-off

jOOQ gives the code control over joins, filters, ordering, and database-specific expressions. It also requires more query code than repository-derived JPA methods.

The project does not currently generate jOOQ classes from the schema. DSL queries use explicitly declared fields, so the compiler checks their declared Java types but does not verify string field names against the live database schema. Revisit code generation if schema/query drift becomes costly.

## Date

2026-06-27
