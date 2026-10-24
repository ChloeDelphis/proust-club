# Search — Frontend

How the search UI works: from user input to highlighted paragraph displayed on screen. `SearchPage` is a **unified** page — it also hosts the connected user's saved citations (frieze, volume sidebar, tag/scope filter); see `docs/features/personal-timeline.md` for that half. This doc covers the search mechanics (corpus and saved-citations text search both reuse the same `SearchForm`).

---

## What it does

The user enters a phrase, submits the form, and sees a paginated list of matching paragraphs from *À la recherche du temps perdu*. Each result shows the paragraph with the matched phrase highlighted, and its position in the work (volume, part, approximate page). A "Voir le détail" button on each result opens it in a two-column modal with progressive before/after reading context (and, when connected, a save-with-tags flow) — `SearchResultDetailModal`, documented in `docs/features/quote-save-tags.md` alongside the shared `DetailModal` layout it builds on, not duplicated here.

For a connected user, the same search box also filters their own saved citations instead, when the "saved citations" scope is active in `TagFilterBar` — see "Corpus vs. saved-citations scope" below.

**Layout** — the search form, scope filters, result count, and result cards share one content column capped at `48rem`. On wide viewports this column is centered against the full page, while the tome list stays at the left. Between `48rem` and `64rem`, the search and tome list remain in two columns, with the list and placeholder text scaled down to fit. At `48rem` (768 CSS px) and below, tome selection moves into a left-opening drawer shared with the header. The frieze remains visible at exactly `48rem` and disappears below it; mobile search starts directly under the header.

---

## Data flow

```
SearchForm (user input, no validation of its own)
  → SearchPage (TanStack Query: useQuery, gated on scope + query length)
  → searchParagraphs()  src/api/search.ts         (corpus scope)
  → listQuotes()        src/api/quote.ts          (saved-citations scope)
  → apiFetch<...>()
  → GET /api/search?q=...&volumeId=...&page=...&size=...       (corpus scope)
  → GET /api/quotes?q=...&tagId=...&volumeId=...&page=... (saved-citations scope)
  → Spring Boot → PostgreSQL
```

Types are derived from `schema.generated.ts`, generated from the backend OpenAPI spec (`pnpm generate:api`). Components never import `schema.generated.ts` directly — they go through `src/api/search.ts`/`src/api/quote.ts`.

---

## Corpus vs. saved-citations scope

`SearchPage` owns `scope: 'corpus' | 'saved'`, toggled by `TagFilterBar` (its "Mes citations enregistrées" entry, or any real tag — selecting either switches to `'saved'`; clicking the active one again returns to `'corpus'`). The same `query` state feeds both: switching scope does **not** clear the search box, mirroring the corpus text filtering straight into the saved-citations text filter (`listQuotes`'s `q` param, a case-insensitive substring match against the quote's own saved text — see `docs/features/quote-save-tags.md`). Only one of the two `useQuery` calls is `enabled` at a time, based on the active scope.

Anonymous visitors see the corpus frieze and volume list as navigation filters, but never see the saved-citations scope or tag controls. The frieze shows the fixed structure of the seven volumes without personal bookmarks. `SearchPage` only enables the personal timeline request while connected; anonymous browsing fetches public volume metadata from `GET /api/volumes` and corpus results from `GET /api/search`. It does not request `/api/quotes`, `/api/quotes/timeline`, or `/api/tags`.

Selecting a tome from the desktop list, the narrow-screen drawer, or its zone in the frieze applies the same `selectedVolumeId` filter to the active results scope. `GET /api/search` and `GET /api/quotes` apply `volumeId` in the backend before pagination and counting, so `total` and every page describe only that tome. The filter combines with the existing phrase and tag filters. Selecting the active tome again clears it. Both changes reset `page` to `0`; connected users' frieze still fetches its complete personal timeline and zooms its visible bookmarks locally. For visitors, the frieze represents only the tome structure and acts as a corpus filter; opening a random page from the frieze is a later feature.

---

## State model

State lives in `SearchPage`:

- `query` — the last submitted phrase (not what the user is currently typing), shared by both scopes
- `scope` — `'corpus' | 'saved'`
- `tagId` — which real tag is active, meaningful only in `'saved'` scope
- `selectedVolumeId` — optional tome filter shared by the desktop list, narrow-screen drawer, and frieze; valid IDs are 1–7
- `page` — current page index (0-based; reset to 0 on each new search or scope/tag/volume change)

`SearchForm` manages its own input value locally and has no minimum-length validation of its own — submitting (or clicking its clear button) always calls `onSubmit(q)` as-is, including an empty string. The 2-character floor only applies to corpus search, enforced by `SearchPage` itself (`isQueryValid`), since an empty or 1-character query is meaningful in the saved-citations scope (it means "no text filter").

At `48rem` (768 CSS px) and below, the submit button is hidden; the native search form submits with the keyboard's search/Enter action (`type="search"`, `enterkeyhint="search"`). A decorative magnifier appears inside the input on the left, and the clear control appears on the right only while the input has text. The mobile placeholder uses a smaller type scale than the tome names in the drawer.

TanStack Query derives loading state, data, errors, and caching — `['search', query, selectedVolumeId, page]` for corpus, `['quotes', tagId, query, selectedVolumeId, page]` for saved.

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

Backend-driven: `page`, `size`, and optional `volumeId` are query parameters; `total` is counted after all active filters. The frontend computes `totalPages = Math.ceil(total / size)` and renders Prev / Next controls. Page size is fixed at 10. Applying or clearing a tome filter resets pagination before issuing the new request.

## Manual verification

- **Responsive navigation at 768 px:** confirm the frieze stays visible with smaller labels, the header shows a tome-menu trigger, and opening it reveals the tome list in a left-side panel. On a signed-out session, login and registration links sit at the bottom of the panel and are absent from the header.
- **Mobile at and below 768 px:** confirm the submit button is hidden and Enter submits the search; the magnifier sits inside the input, and the clear control appears only when text is present. Confirm the placeholder is smaller than the tome names in the drawer.
- **Mobile below 768 px:** confirm the frieze is hidden, the search form follows directly below the header, and the tome drawer remains usable with login and registration links at its bottom.
- **Responsive content width:** at a wide viewport, confirm the search form and result cards share a centered width of about `48rem` relative to the full page, while the tome list stays at the left; between `48rem` and `64rem`, confirm the list and search content stay in two columns with compact typography.
- **Happy path — anonymous structure:** without a session, load `/`, confirm the frieze and tome list show all seven volumes without bookmarks, and confirm the UI requests `GET /api/volumes` but makes no requests to `/api/quotes`, `/api/quotes/timeline`, or `/api/tags`.
- **Happy path — corpus:** submit a phrase present in more than one tome, select a tome from the desktop list, drawer, or frieze, and confirm every result belongs to that tome and pagination reflects only its matches. Selecting a tome in the drawer should close the panel and reset pagination.
- **Happy path — saved citations:** switch to saved citations, select a tome, and confirm the list contains only that tome's quotes; combine the tome with a tag and a text query.
- **Toggle and pagination:** move to page 2, select a tome in either control, and confirm the first filtered page appears. Select the same tome again and confirm all-tome results return on page 1.
- **Empty result:** select a valid tome with no match for the submitted phrase (or no saved citations) and confirm the empty state and `total: 0`.
- **Public volume metadata:** call `GET /api/volumes` without a session; expect `200`, seven ordered volume records with `id`, `title`, `position`, `minPage`, and `maxPage`, and no personal quote/tag data.
- **Validation:** `GET /api/search` and authenticated `GET /api/quotes` with `volumeId=0` or `volumeId=8` return `400`; omitted `volumeId` retains all-tome behavior.
