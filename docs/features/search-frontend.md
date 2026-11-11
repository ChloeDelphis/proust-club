# Search — Frontend

How the search UI works: from user input to highlighted excerpt displayed on screen. `SearchPage` is a **unified** page — it also hosts the connected user's saved citations (frieze, volume sidebar, tag/scope filter); see `docs/features/personal-timeline.md` for that half. This doc covers the search mechanics (corpus and saved-citations text search both reuse the same `SearchForm`).

---

## What it does

The user enters a phrase, submits the form, and sees a paginated list of matching paragraphs from *À la recherche du temps perdu*. Each result shows an excerpt centered on the matched phrase (target length about 200 characters), with the match highlighted in a pale apricot tone (`#F7E8D4`), and its volume and part. Result cards use a mauve border (`#AA8193`) that shifts to the signature plum (`#6E3C54`) on hover. The page number is omitted from both the result list and full-paragraph detail modal. The excerpt is cut at word boundaries, preferring nearby sentence punctuation, and uses an ellipsis where text was omitted. Clicking or keyboard-activating the excerpt opens the full paragraph in a two-column modal with progressive before/after reading context (and, when connected, a save-with-tags flow) — `SearchResultDetailModal`, documented in `docs/features/quote-save-tags.md` alongside the shared `DetailModal` layout it builds on, not duplicated here. Text selection in the excerpt remains available for saving a citation.

The backend continues to return the complete paragraph and match offsets. The frontend derives the excerpt from those offsets; `QuoteSelection` adds the excerpt's source offset back to local selection positions before saving, so saved citation offsets still refer to the original paragraph.

For a connected user, the same search box also filters their own saved citations instead, when the "saved citations" scope is active in `TagFilterBar` — see "Corpus vs. saved-citations scope" below.

**Layout** — above 1024px, the tome list sits beside centered search and results, using a wider column, fluid serif labels, and a vertical divider. From 768px through 1024px, the search fills the available content column while the tome list and frieze remain visible. Below 768px, the list moves into a left-side drawer and the frieze is hidden. At exactly 768px the tablet layout is retained. The drawer leaves part of the page visible and closes on outside click, Escape, tome selection, its close control, or a left swipe. Tome names wrap inside it.

**Responsive thresholds** — `64rem` (1024px) stops offsetting and constraining search content because the sidebar leaves less room on medium screens. The tome labels use a 16–18px fluid scale on the desktop/tablet sidebar; the mobile drawer keeps its own 16px label size. `48rem` (768px) switches between the two-column layout and the mobile drawer; the query is strict (`width < 48rem`) so the 768px tablet reference keeps the two-column layout. `30rem` (480px) tightens header spacing and branding on the narrowest phones. Check the supplied reference widths at 320, 375, 425, 768, 1024, and 1440px, plus 1040px to confirm the tome labels no longer jump in size just above the 1024px threshold.

---

## Data flow

```
SearchForm (user input, no validation of its own)
  → SearchPage (TanStack Query: useQuery, gated on scope + query length)
  → searchParagraphs()  src/api/search.ts         (corpus scope)
  → getSearchOverview() src/api/search.ts         (corpus scope; frieze markers and counts)
  → listQuotes()        src/api/quote.ts          (saved-citations scope)
  → apiFetch<...>()
  → GET /api/search?q=...&volumeId=...&partId=...&page=...&size=...       (corpus scope)
  → GET /api/search/overview?q=...                                   (corpus scope; unpaginated, lightweight)
  → GET /api/quotes?q=...&tagId=...&volumeId=...&partId=...&page=... (saved-citations scope)
  → Spring Boot → PostgreSQL
```

Types are derived from `schema.generated.ts`, generated from the backend OpenAPI spec (`pnpm generate:api`). Components never import `schema.generated.ts` directly — they go through `src/api/search.ts`/`src/api/quote.ts`.

---

## Corpus vs. saved-citations scope

`SearchPage` owns `scope: 'corpus' | 'saved'`, toggled by `TagFilterBar` (its "Mes citations enregistrées" entry, or any real tag — selecting either switches to `'saved'`; clicking the active one again returns to `'corpus'`). The same `query` state feeds both: switching scope does **not** clear the search box, mirroring the corpus text filtering straight into the saved-citations text filter (`listQuotes`'s `q` param, a case-insensitive substring match against the quote's own saved text — see `docs/features/quote-save-tags.md`). The paginated results query follows the active scope; the corpus overview query is enabled alongside corpus results only for a valid corpus phrase.

Anonymous visitors see the corpus frieze and volume list as navigation filters, but never see the saved-citations scope or tag controls. With no active corpus phrase, the frieze shows the fixed structure of the seven volumes without personal bookmarks. `SearchPage` enables the personal timeline request only while connected and when no valid corpus phrase is active or saved-citations scope is selected. Anonymous browsing fetches public volume metadata from `GET /api/volumes` and corpus results from `GET /api/search`; it does not request `/api/quotes`, `/api/quotes/timeline`, or `/api/tags`.

When a valid query is active in corpus scope, the frieze uses `GET /api/search/overview` instead of the personal quote timeline, including for connected users. The overview provides all matching passage positions, per-volume/part counts, and at most five words for hover; selecting a tome or part filters this cached marker set locally. Switching to saved-citations scope disables the corpus overview and restores the connected user's own timeline and bookmarks. Corpus matches have no tags, so the overview never requests or returns tag data.

Selecting a tome from the desktop list, the narrow-screen drawer, or its zone in the frieze applies the same `selectedVolumeId` filter to the active results scope. When a tome is selected, its named parts become selectable zones in the frieze. Selecting a part adds `partId` alongside `volumeId`; `GET /api/search` and `GET /api/quotes` apply both filters before pagination and counting, so totals and pages describe only that part. The filter combines with the existing phrase and tag filters. Selecting the active part again returns to the tome; selecting the tome title clears the part filter, and selecting the tome again returns to all tomes. Each scope change resets `page` to `0`. Personal timelines and corpus overview markers are unpaginated and filter visible bookmarks/markers locally. Anonymous visitors get the same corpus filters without personal data. Opening a random page from the frieze is a later feature.

---

## State model

Search and pagination state lives in `SearchPage`; the selected tome is shared with the header drawer through `VolumeSelectionProvider`:

- `query` — the last submitted phrase (not what the user is currently typing), shared by both scopes
- `scope` — `'corpus' | 'saved'`
- `tagId` — which real tag is active, meaningful only in `'saved'` scope
- `selectedVolumeId` — optional tome filter shared by the desktop list, drawer, and frieze
- `selectedPartId` — optional part filter available after selecting a tome in the frieze
- `page` — current page index (0-based; reset to 0 on each new search or scope/tag/volume change)

`SearchForm` manages its own input value locally and has no minimum-length validation of its own — submitting (or clicking its clear button) always calls `onSubmit(q)` as-is, including an empty string. The 2-character floor only applies to corpus search, enforced by `SearchPage` itself (`isQueryValid`), since an empty or 1-character query is meaningful in the saved-citations scope (it means "no text filter").

At narrow widths, Enter submits the search and the submit button is hidden. A magnifier appears inside the input and a clear control appears when it contains text. The placeholder is smaller than tome names in the drawer.

TanStack Query derives loading state, data, errors, and caching — `['search', query, selectedVolumeId, selectedPartId, page]` for corpus, `['quotes', tagId, query, selectedVolumeId, selectedPartId, page]` for saved.

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

The backend returns `startOffset` (inclusive, 0-based) and `endOffset` (exclusive, 0-based) within the full paragraph, matching JavaScript's `String.substring()` exactly. `createSearchExcerpt` selects a bounded window around that match; `ParagraphCard` subtracts the excerpt start from the highlight range, while `QuoteSelection` adds the excerpt start back to user selections before saving.

```tsx
const excerpt = text.substring(excerptStart, excerptEnd)
const matchStart = startOffset - excerptStart
const matchEnd = endOffset - excerptStart
const before = excerpt.substring(0, matchStart)
const match  = excerpt.substring(matchStart, matchEnd)
const after  = excerpt.substring(matchEnd)
// renders: {before}<mark>{match}</mark>{after}
```

No `dangerouslySetInnerHTML`. Excerpt selection uses offsets and boundary scans; React renders every text segment and highlight.

---

## Pagination

Backend-driven: `page`, `size`, and optional `volumeId` and `partId` are query parameters; `total` is counted after all active filters. The frontend computes `totalPages = Math.ceil(total / size)` and renders Prev / Next controls. Page size is fixed at 10. Applying or clearing a tome or part filter resets pagination before issuing the new request.

## Manual verification

- **Responsive layout:** at 1440px, check centered search beside the tome list; at 1024px and 768px, check the full content column, visible frieze, and two-column layout; at 425px, 375px, and 320px, check the drawer, hidden frieze, and mobile search controls. Also check at 1040px that tome labels remain compact. Check keyboard submission, clear control, and account links in the drawer.
- **Drawer:** verify outside click, Escape, tome selection, close control, and left swipe dismiss it; vertical scrolling and wrapped tome names remain usable.
- **Happy path — anonymous structure:** without a session, load `/`, confirm the frieze and tome list show all seven volumes without bookmarks, and confirm the UI requests `GET /api/volumes` but makes no requests to `/api/quotes`, `/api/quotes/timeline`, or `/api/tags`.
- **Happy path — corpus:** submit a phrase present in more than one tome, select a tome from the list, drawer, or frieze, and confirm results and pagination match that tome. Selecting a tome in the drawer closes it.
- **Corpus frieze overview:** for a phrase with matches across several tomes and parts, confirm each passage is marked once, tome and part badges show the corresponding counts, and hovering/focusing a marker shows no more than five words. Zooming into a tome and part filters marks and badges without changing the overview request; changing the query refreshes it. Confirm the personal timeline endpoint is not requested while a valid corpus query is active, including when connected.
- **Part filter:** zoom into a tome, select one of its part titles, and confirm corpus results and saved citations are restricted to that part. Select the active part again to return to the tome; activate the tome title to clear the part filter, then activate the tome again to show all tomes. Confirm each change resets pagination.
- **Search excerpts:** confirm the full match remains visible, text is cut on word boundaries with ellipses only when needed, and nearby punctuation is preferred. Check matches near the start and end of a paragraph and a match longer than the 200-character target. Click an excerpt to open its full paragraph; drag-select text and confirm it still opens the save flow without opening the detail modal, and that saved selection offsets point to the correct text in the original paragraph.
- **Happy path — saved citations:** switch to saved citations, select a tome, and confirm the list contains only that tome's quotes; combine the tome with a tag and a text query.
- **Toggle and pagination:** move to page 2, select a tome in either control, and confirm the first filtered page appears. Select the same tome again and confirm all-tome results return on page 1. When using Prev / Next, confirm the viewport returns to the start of the updated result list.
- **Empty result:** select a valid tome with no match for the submitted phrase (or no saved citations) and confirm the empty state and `total: 0`.
- **Public volume metadata:** call `GET /api/volumes` without a session; expect `200`, seven ordered volume records with `id`, `title`, `position`, `minPage`, and `maxPage`, and no personal quote/tag data.
- **Validation:** `GET /api/search` and authenticated `GET /api/quotes` with `volumeId=0`, `volumeId=8`, or `partId=0` return `400`; omitted filters retain the wider scope.
