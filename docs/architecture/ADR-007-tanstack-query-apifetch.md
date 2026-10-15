# ADR-007: Server state — TanStack Query and `apiFetch`

## Decision

Use TanStack Query for server state and a thin generic `apiFetch<T>()` wrapper around native `fetch`.

## Context and rationale

The frontend needs request state, caching, deduplication, and cancellation. TanStack Query owns query and mutation state; domain functions in `src/api/*.ts` own endpoint details; `apiFetch` owns shared HTTP behavior. Query functions pass TanStack Query's `AbortSignal` through the API layer to `fetch`.

This avoids duplicating loading, error, caching, and cancellation logic in components. Native `fetch` remains the transport; `apiFetch` does not contain domain behavior.

## UI state convention

Use `isPending` for the initial load with no data and `isFetching` for background refreshes. Keep existing data visible while a refresh runs. The MVP uses explicit loading and error states rather than Suspense.

## Trade-off

TanStack Query adds a runtime dependency. The API wrapper remains generic and the domain modules provide typed request functions.

## Date

2026-08-01
