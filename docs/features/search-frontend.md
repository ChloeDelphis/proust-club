# Search — Frontend

How the search UI works: from user input to highlighted paragraph displayed on screen.

---

## What it does

The user enters a phrase, submits the form, and sees a paginated list of matching paragraphs from *À la recherche du temps perdu*. Each result shows the paragraph with the matched phrase highlighted, and its position in the work (volume, part, approximate page).

---

## Data flow

```
SearchForm (user input + validation)
  → SearchPage (TanStack Query: useQuery)
  → searchParagraphs()  src/api/search.ts
  → apiFetch<SearchResponse>()
  → GET /api/search?q=...&page=...&size=...
  → Spring Boot → PostgreSQL
```

Types are derived from `schema.generated.ts`, generated from the backend OpenAPI spec (`pnpm generate:api`). Components never import `schema.generated.ts` directly — they go through `src/api/search.ts`.

---

## State model

Two pieces of state live in `SearchPage`:

- `query` — the last submitted phrase (not what the user is currently typing)
- `page` — current page index (0-based; reset to 0 on each new search)

`SearchForm` manages its own input value locally. Submitting calls `onSubmit(q)`, which updates `SearchPage.query`.

TanStack Query derives loading state, data, errors, and caching from the `[search, query, page]` query key.

---

## Loading states

| State | Condition | UI |
|---|---|---|
| Initial | query < 2 chars | Nothing rendered |
| Loading | `isPending` (no data yet) | `<Spinner />` |
| Fetching | `isFetching` + data present | `ResultList` at 0.6 opacity |
| Error | `isError` | `<ErrorMessage />` |
| Empty | 0 results | `<EmptyState />` |

`placeholderData: keepPreviousData` (TanStack Query v5's replacement for v4's `keepPreviousData: true` option) keeps previous results visible during page transitions, preventing layout flicker. Never `if (isFetching) return <Spinner />` — that erases results already on screen.

---

## Highlighting

The backend returns `startOffset` (inclusive, 0-based) and `endOffset` (exclusive, 0-based), matching JavaScript's `String.substring()` exactly.

```tsx
const before = text.substring(0, startOffset)
const match  = text.substring(startOffset, endOffset)
const after  = text.substring(endOffset)
// renders: {before}<mark>{match}</mark>{after}
```

No `dangerouslySetInnerHTML`. No string manipulation beyond `substring`.

---

## Pagination

Backend-driven: `page` and `size` are query parameters; `total` is in the response. The frontend computes `totalPages = Math.ceil(total / size)` and renders Prev / Next controls. Page size is fixed at 10 for MVP.

---

## Manual verification

- Search for a known phrase (e.g., "petite madeleine") → results appear with the match highlighted in yellow inside `<mark>`.
- Navigate to page 2 → results change; previous results stay briefly visible during fetch (opacity transition).
- Search for a phrase that does not exist → EmptyState message appears.
- Submit an empty form or a single character → inline validation error; no HTTP request sent.
- Disconnect the backend and search → ErrorMessage appears.
- Verify `<mark>` wraps exactly the matched phrase, case-insensitively, with no surrounding whitespace.
- Verify Prev button is disabled on page 1; Next button is disabled on the last page.
