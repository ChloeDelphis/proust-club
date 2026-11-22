# ADR-021: PostgreSQL schemas by domain

## Status

Accepted — 2026-11-22.

## Decision

Group application tables in `corpus`, `identity`, `library` and `admin`. Keep Flyway history and `pg_trgm` in `public`; keep HTTP sessions in memory. V17 moves existing tables in place, preserving cross-schema foreign keys and avoiding edits to V1–V16. jOOQ generates all four schemas and renders qualified table names.

Flyway may use credentials separate from the runtime datasource, but local defaults remain shared. PostgreSQL grants must be configured explicitly; `USER` / `ADMIN` authorization remains an application responsibility.

## Context and consequences

V1–V16 may already be applied, so a forward migration preserves their checksums and existing data. A separate migration role must own or receive DDL authority over the managed objects before applying pending migrations.

