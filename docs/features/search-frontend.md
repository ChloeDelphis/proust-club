# Search — Frontend

How the search UI works: from user input to highlighted paragraph displayed on screen. `SearchPage` is a **unified** page — it also hosts the connected user's saved citations (frieze, volume sidebar, tag/scope filter); see `docs/features/personal-timeline.md` for that half. This doc covers the search mechanics (corpus and saved-citations text search both reuse the same `SearchForm`).

---

## What it does

The user enters a phrase, submits the form, and sees a paginated list of matching paragraphs from *À la recherche du temps perdu*. Each result shows the paragraph with the matched phrase highlighted, and its position in the work (volume, part, approximate page). A "Voir le détail" button on each result opens it in a two-column modal with progressive before/after reading context (and, when connected, a save-with-tags flow) — `SearchResultDetailModal`, documented in `docs/features/quote-save-tags.md` alongside the shared `DetailModal` layout it builds on, not duplicated here.

For a connected user, the same search box also filters their own saved citations instead, when the "saved citations" scope is active in `TagFilterBar` — see "Corpus vs. saved-citations scope" below.

---

## Data flow

```
SearchForm (user input, no validation of its own)
  → SearchPage (TanStack Query: useQuery, gated on scope + query length)
  → searchParagraphs()  src/api/search.ts         (corpus scope)
  → listQuotes()        src/api/quote.ts          (saved-citations scope)
  → apiFetch<...>()
  → GET /api/search?q=...&page=...&size=...       (corpus scope)
  → GET /api/quotes?q=...&tagId=...&page=...       (saved-citations scope)
  → Spring Boot → PostgreSQL
```

Types are derived from `schema.generated.ts`, generated from the backend OpenAPI spec (`pnpm generate:api`). Components never import `schema.generated.ts` directly — they go through `src/api/search.ts`/`src/api/quote.ts`.

---

## Corpus vs. saved-citations scope

`SearchPage` owns `scope: 'corpus' | 'saved'`, toggled by `TagFilterBar` (its "Mes citations enregistrées" entry, or any real tag — selecting either switches to `'saved'`; clicking the active one again returns to `'corpus'`). The same `query` state feeds both: switching scope does **not** clear the search box, mirroring the corpus text filtering straight into the saved-citations text filter (`listQuotes`'s `q` param, a case-insensitive substring match against the quote's own saved text — see `docs/features/quote-save-tags.md`). Only one of the two `useQuery` calls is `enabled` at a time, based on the active scope.

Anonymous visitors never see the scope toggle (`TagFilterBar`/`VolumeList`/`TimelineBar` are all gated on `isConnected`) — the page behaves exactly like corpus-only search always did.

---

## State model

State lives in `SearchPage`:

- `query` — the last submitted phrase (not what the user is currently typing), shared by both scopes
- `scope` — `'corpus' | 'saved'`
- `tagId` — which real tag is active, meaningful only in `'saved'` scope
- `page` — current page index (0-based; reset to 0 on each new search or scope/tag change)

`SearchForm` manages its own input value locally and has no minimum-length validation of its own — submitting (or clicking its clear button) always calls `onSubmit(q)` as-is, including an empty string. The 2-character floor only applies to corpus search, enforced by `SearchPage` itself (`isQueryValid`), since an empty or 1-character query is meaningful in the saved-citations scope (it means "no text filter").

TanStack Query derives loading state, data, errors, and caching — `['search', query, page]` for corpus, `['quotes', tagId, query, page]` for saved.

---

## Loading states

| State | Condition | UI |
|---|---|---|
| Initial (corpus scope) | query < 2 chars | `<EmptyState>` inviting the user to type something |
| Loading | `isPending` (no data yet) | `<Spinner />` |
| Fetching | `isFetching` + data present | results list at 0.6 opacity |
| Error | `isError` | `<ErrorMessage />` |
| Empty | 0 results | `<EmptyState />` (wording differs: "nothing saved at all" vs. "nothing matches this filter") |

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

Backend-driven: `page` and `size` are query parameters; `total` is in the response. The frontend computes `totalPages = Math.ceil(total / size)` and renders Prev / Next controls. Page size is fixed at 10.
