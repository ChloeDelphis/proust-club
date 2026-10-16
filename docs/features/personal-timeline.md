# Personal timeline — Technical Design

A graphical bar, shown to connected users on the unified search/citations page (`/`, `SearchPage` — see `docs/features/search-frontend.md`), positioning the user's saved quotes on the structure of the work (volume → page), not on the date they were saved — that's what the list below it already does. `/mes-citations` redirects to `/`, preserved for previously bookmarked links. See [ADR-009](../architecture/ADR-009-base-ui-dependency.md) for the Base UI dependency decision behind the quote-detail modal.

---

## Data flow

```
GET /api/quotes/timeline?tagId=   (unpaginated — needs every quote at once to place every bookmark)
  → QuoteController.timeline()
  → QuoteService.getTimeline(userId, tagId)
    → QuoteTimelineRepository.findByUserId  (quote_selections ⋈ paragraphs, ordered by paragraphs.position)
    → QuoteTimelineRepository.findVolumesWithPageRange  (volumes.min_page/max_page — see below)
    → QuoteTagRepository.findByQuoteIds  (same batch pattern as list())
  → TimelineResponse { volumes: TimelineVolume[7], quotes: TimelineQuote[] }
```

`GET /api/quotes` (paginated, `size` ≤ 20) could never have served this: the timeline needs every saved quote in one response to place every bookmark, not one page of results.

## `volumes.min_page`/`max_page` — computed once, at import time

Each volume's page range is needed to position bookmarks proportionally and to draw the delimiter between volumes. Rather than recomputing `MIN`/`MAX(page_number)` on every request (or caching that computation), the bounds are **persisted as plain columns** (`V6__volumes_page_range.sql`, nullable — `volumes` is seeded by `V2` before any paragraph exists, so the bounds can't be known at seed time). `CorpusImportService` writes them once, right after inserting all paragraphs:

```sql
UPDATE volumes SET min_page = ..., max_page = ...
FROM (SELECT volume_id, MIN(page_number), MAX(page_number) FROM paragraphs GROUP BY volume_id) ranges
WHERE volumes.id = ranges.volume_id
```

`findVolumesWithPageRange()` is then a plain `SELECT` of 7 already-computed rows — no aggregation at request time, at any scale. Page numbers are continuous across the whole corpus (e.g. tome 1 = pages 1–103, tome 7 = 434–486), never resetting per volume.

## Response shape

```json
{
  "volumes": [
    { "id": 1, "title": "Du côté de chez Swann", "position": 1, "minPage": 1, "maxPage": 103 },
    ...
  ],
  "quotes": [
    { "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "paragraphId": 45, "pageNumber": 9, "volumeId": 1, "selectedText": "...", "comment": null, "tags": [...], "createdAt": "..." }
  ]
}
```

`volumes` is always all 7, regardless of whether they contain any quote — the frontend always draws the full structure of the work, not just the parts the user has touched.

## Frontend

**Layout** — `SearchPage` renders the frieze (`TimelineBar`) full-width above a two-column grid (`aside` 12rem / content `1fr`), with the volume list (`VolumeList`, `src/features/quotes/VolumeList/`) in the `aside`. All three (frieze, sidebar, `TagFilterBar`) are gated on `isConnected` — an anonymous visitor sees plain corpus search, nothing from this feature. `selectedVolumeId` is owned by `SearchPage` (not `TimelineBar` itself) and passed as a controlled prop to both `TimelineBar` and `VolumeList`, so a click in either one stays in sync with the other. Both components read the same timeline data independently via a shared hook, `useTimeline(activeTagId)` (`src/features/quotes/useTimeline.ts`) — same `queryKey`, deduplicated by TanStack Query into a single request, not prop-drilled.

**Rendered as one SVG**, not absolutely-positioned HTML elements. This project's CSP forbids inline `style={{ ... }}` — bookmark position is a continuous value per quote (0–100% along the page range), which can't be expressed as a finite set of CSS classes. SVG geometry attributes (`x`, `width`, `y1`/`y2`, ...) aren't CSS and aren't covered by that restriction, and are the idiomatic tool for "plot points on an axis" regardless. `preserveAspectRatio="none"` on a `0 0 1000 200` viewBox stretches the same layout math to any real container width — no `getBoundingClientRect`/`ResizeObserver` needed anywhere.

- **Positioning** (`positionTimelineQuotes.ts`) maps each quote's page number to a percentage offset within the selected page range and sorts the results. Overlapping bookmarks (below a pixel-distance-equivalent threshold) alternate between two heights instead of fully occluding each other. Returns groups of quotes (currently always length 1, every rendering consumer reads `quotes[0]`) rather than one quote per entry directly.
- **Selecting a volume** — two triggers, both calling the same `onSelectVolume` prop: clicking a volume's own zone directly in the bar, or clicking its entry in `VolumeList`'s sidebar (one button per volume, generated from `data.volumes` — never hardcoded). `SearchPage` owns `selectedVolumeId` and passes it to both controls. The frieze zooms to the volume's `minPage`/`maxPage`, filters its visible bookmarks to that `volumeId`, and hides delimiters. The same selection also filters the main result list server-side through `GET /api/search` or `GET /api/quotes` (before pagination and count); see `docs/features/search-frontend.md`. Selecting the active volume again clears both zoom and result filter, and either change resets pagination to page 1. The timeline request itself remains complete and unpaginated so the frieze can position every saved quote.
- **Transition between "all volumes" and "one volume zoomed"** — the other volumes' zones and delimiters stay mounted (never conditionally unmounted) and are hidden via a CSS `opacity`/geometry transition on `isHidden`, instead of popping instantly. The visually-hidden zones also drop out of the accessibility tree and tab order (`aria-hidden` + `tabIndex={-1}`) — `pointer-events: none` alone only blocks the mouse, not keyboard activation.
- **Sticky on scroll** — `TimelineBar`'s root is `position: sticky; top: 0` with an opaque background, so it stays pinned at the top of the viewport while the quote list below it scrolls underneath, rather than scrolling away with the rest of the page.
- **Hover preview** (`QuoteHoverPreview/`) — a normal HTML component (built like `Toast`, not SVG) embedded via `<foreignObject>` so it gets real text wrapping instead of an SVG text-width estimate. Shown via React state (`onMouseEnter`/`onFocus` on the bookmark `<rect>`), not pure CSS `:hover` — consistent with how `Toast`/`TagPickerPopup` already work in this codebase.
- **Detail modal** (`QuoteDetailModal/`) — opened from a bookmark here, or from a citation's text in `QuoteCard` (the list below); both report just a quote id up to `SearchPage`, which owns the single modal instance. Two-column layout with progressive before/after context, delegated to the shared `DetailModal` component (`src/components/DetailModal/`, also used by the not-yet-saved counterpart opened from a search result) — see `docs/features/quote-save-tags.md`, which documents `DetailModal`, `QuoteDetailModal`'s side panel (comment + `QuoteTagEditor`), and the progressive-context endpoint (`docs/features/paragraph-context.md`) together, rather than splitting that across two docs. No delete from the modal — that stays on `QuoteCard` in the list below.

## Current limitations

- **No tag filter specific to the timeline** — it inherits whatever tag is active in `TagFilterBar` below it; there's no separate control.
- **No clustering of overlapping bookmarks** — only the alternating-height trick above. Revisiting this depends on one user's own quote count over time, not on how many users the app has.

## Manual verification

- **Select from sidebar:** choose a tome and confirm the frieze zooms to its page range and the active result list is filtered to the same tome.
- **Select from frieze:** click another tome zone and confirm sidebar selection, frieze zoom, and result filter stay synchronized.
- **Clear selection:** click the selected tome again in either control and confirm all bookmarks and results return.
- **Saved-citations scope:** repeat while saved citations are active; confirm filtering combines with the selected tag and resets pagination.
