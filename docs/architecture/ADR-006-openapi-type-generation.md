# ADR-006: Generating TypeScript types from OpenAPI

## Decision

**`openapi-typescript`**, generating `src/api/schema.generated.ts` from the backend's OpenAPI spec.

## Context

The Spring Boot backend exposes an OpenAPI spec via springdoc-openapi (`/v3/api-docs`). The frontend needs TypeScript types matching the backend DTOs (e.g. `SearchResponse`, `SearchHit`).

**Option A — Hand-written types**
Manually duplicate the Java DTOs in TypeScript. Simple at first, but risks permanent drift: every backend change has to be manually mirrored on the frontend — a source of silent bugs.

**Option B — Generate from OpenAPI (`openapi-typescript`)**
A script queries the running backend (`GET /v3/api-docs`) and generates a `schema.generated.ts` file containing the exact types. The backend is the single source of truth.

## Why Option B

Hand-written types drift silently — nothing catches a backend field rename or type change until a runtime bug (or a very attentive reviewer) surfaces it. Generating from the spec turns that drift into a compile error instead.

```json
"generate:api": "openapi-typescript http://localhost:8080/v3/api-docs -o src/api/schema.generated.ts"
```

Re-run on every backend contract change.

## Conventions

- `schema.generated.ts` is never hand-edited, and is committed — it documents the contract as of that commit.
- Domain types (`SearchResponse`, `SearchHit`, etc.) are extracted from it in `src/api/*.ts` — no component imports `schema.generated.ts` directly.

## Tradeoff accepted

The backend must be running to (re)generate types — no offline generation for now. Acceptable for a single-developer MVP workflow.

## Date

2026-08-01
