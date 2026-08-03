# ADR-007: Server state — TanStack Query + apiFetch with AbortSignal

## Decision

**TanStack Query (React Query) + a thin `apiFetch<T>()` wrapper.**

## Context

The frontend needs to handle network calls to the Spring Boot backend: loading, errors, caching, cancelling stale requests. The HTTP layer needs to stay typed and predictable.

**Option A — Native `fetch` + `useState`/`useEffect`**
Zero dependency. But verbose: loading/error/data state has to be rewritten in every component, no cache, no request dedup, manual cancellation is tedious.

**Option B — TanStack Query + a wrapped fetch**
Handles the loading/error/cache/dedup lifecycle automatically. The de facto standard for React server state in 2026. Integrates naturally with `AbortSignal` for cancellation.

**Option C — SWR**
Lighter, same principle. Fewer features, less ecosystem traction.

## Why Option B

```
React component
  → TanStack Query (useQuery / useMutation)
  → domain functions  src/api/*.ts
  → apiFetch<T>()
  → native fetch
  → Spring Boot
```

`apiFetch` accepts an optional `AbortSignal`, threaded through to native `fetch`. Domain functions propagate it consistently:

```ts
// src/api/client.ts
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> { ... }

// src/api/search.ts
export function searchParagraphs(params: SearchParams, signal?: AbortSignal) {
  return apiFetch<SearchResponse>(`/api/search?...`, { signal })
}
```

TanStack Query passes its own `signal` to the `queryFn`:

```ts
queryFn: ({ signal }) => searchParagraphs(params, signal)
```

Stale requests (e.g. a new keystroke before the previous response arrives) are cancelled automatically.

## State convention

Distinguish `isPending` from `isFetching`:

- `isPending` — no data yet → show the initial loading state.
- `isFetching` — a request is in flight but data is already available → keep showing the results, a subtle indicator only.

Don't do `if (isFetching) return <Spinner />` — it would wipe already-visible data on every refetch.

```tsx
if (isPending) return <Spinner />
if (isError) return <ErrorMessage message="..." />
if (!data.results.length) return <EmptyState message="..." />
return <ResultList results={data.results} isFetching={isFetching} />
```

No Suspense for the MVP: explicit state handling is more readable and sufficient.

## Tradeoff accepted

TanStack Query is a runtime dependency (light, ~13 kB gzipped). `apiFetch` stays generic — it knows nothing about the domain, only HTTP. `AbortSignal` support is built in from day one, so no refactor is needed if cancellation becomes critical later.

## Date

2026-08-01
