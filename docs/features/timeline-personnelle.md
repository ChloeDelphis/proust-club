# Personal timeline — Technical Design

A graphical bar on top of `/mes-citations` showing the user's saved quotes positioned on the structure of the work (volume → page), not on the date they were saved — that's what the list below it already does. See [ADR-009](../architecture/ADR-009-base-ui-dependency.md) for the Base UI dependency decision behind the quote-detail modal.

---

## Data flow

```
GET /api/quotes/timeline?tagId=   (unpaginated — needs every quote at once to place every bookmark)
  → QuoteController.timeline()
  → QuoteService.getTimeline(userId, tagId)
    → QuoteRepository.findTimelineByUserId  (quote_selections ⋈ paragraphs, ordered by paragraphs.position)
    → QuoteRepository.findVolumesWithPageRange  (volumes.min_page/max_page — see below)
    → QuoteRepository.tagsForQuoteIds  (same batch pattern as list())
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

`findVolumesWithPageRange()` is then a plain `SELECT` of 7 already-computed rows — no aggregation at request time, at any scale. Verified end to end: tome 1 = pages 1–103, ..., tome 7 = 434–486 (continuous across the whole corpus, never resets per volume).

## Response shape

```json
{
  "volumes": [
    { "id": 1, "title": "Du Côté de Chez Swann", "position": 1, "minPage": 1, "maxPage": 103 },
    ...
  ],
  "quotes": [
    { "id": 7, "paragraphId": 45, "pageNumber": 9, "volumeId": 1, "selectedText": "...", "comment": null, "tags": [...], "createdAt": "..." }
  ]
}
```

`volumes` is always all 7, regardless of whether they contain any quote — the frontend always draws the full structure of the work, not just the parts the user has touched.

## Frontend

`TimelineBar` (`src/features/quotes/TimelineBar/`) — stayed inside `features/quotes/`, not a new top-level feature folder, since this isn't a separate page: it's a second consumer of the same `tagId` filter state already owned by `MyQuotesPage`, passed down as a plain prop exactly like `TagFilterBar` already is.

**Rendered as one SVG**, not absolutely-positioned HTML elements. This project's CSP forbids inline `style={{ ... }}` — bookmark position is a continuous value per quote (0–100% along the page range), which can't be expressed as a finite set of CSS classes. SVG geometry attributes (`x`, `width`, `y1`/`y2`, ...) aren't CSS and aren't covered by that restriction, and are the idiomatic tool for "plot points on an axis" regardless. `preserveAspectRatio="none"` on a `0 0 1000 200` viewBox stretches the same layout math to any real container width — no `getBoundingClientRect`/`ResizeObserver` needed anywhere (this codebase's tests have never had to mock either, and still don't).

- **Positioning** (`positionTimelineQuotes.ts`) is a pure function, tested in isolation: page number → percent offset, sorted, with overlapping bookmarks (below a pixel-distance-equivalent threshold) alternately marked `isExtended` so they render at different heights instead of fully occluding each other. Returns **groups** of quotes (always length 1 today, every rendering consumer still reads `quotes[0]`) rather than one quote per entry directly — a deliberately cheap hook for a future clustering pass to build on without changing this function's signature. It does **not** make clustering free: the rendering layer (plural aria-labels, a multi-quote preview/modal) would still need real work then.
- **Zoom on a volume** — two triggers, both wired to the same `selectedVolumeId` state: clicking a volume's own zone directly in the bar (an invisible `<rect>` per volume, behind the bookmarks), or clicking its button in the filter block to the left (`"Tous les tomes"` + one per volume, generated from `data.volumes` — never hardcoded). Zooming recomputes the page range passed to `positionTimelineQuotes` to that volume's own `minPage`/`maxPage`, filters `quotes` to that `volumeId`, and hides the delimiter lines (only one volume is in view). Resetting is re-selecting `"Tous les tomes"` — there is no separate "go back" affordance.
- **Hover preview** (`QuoteHoverPreview/`) — a normal HTML component (built like `Toast`, not SVG) embedded via `<foreignObject>` so it gets real text wrapping instead of an SVG text-width estimate. Shown via React state (`onMouseEnter`/`onFocus` on the bookmark `<rect>`), not pure CSS `:hover` — consistent with how `Toast`/`TagPickerPopup` already work in this codebase.
- **Detail modal** (`QuoteDetailModal/`) — Base UI `Dialog`. Shows the full quote, `{volume title} — page {N} · {date}`, and is interactive: a personal comment (editable `<textarea>`, saved when the modal closes) and tag management (`QuoteTagEditor`, add/remove live) — see `docs/features/quote-save-tags.md` for both, they're documented there alongside the endpoints and data model they build on rather than duplicated here. No delete from the modal — that stays on `QuoteCard` in the list below.

## What this deliberately does not do (v1)

- **No tag filter specific to the timeline** — it inherits whatever tag is active in `TagFilterBar` below it; there's no separate control.
- **No clustering of overlapping bookmarks** — only the alternating-height trick above. Deferred until real usage shows whether density is actually a problem (it depends on one user's own quote count over time, not on how many users the app has).

## Manual verification

- A user with saved quotes across several volumes sees one bookmark per quote, correctly positioned, with volume delimiters between them.
- A user with zero saved quotes still sees all 7 volumes delimited (empty bar).
- Filtering by tag (the existing `TagFilterBar`) removes non-matching bookmarks from the bar, not just from the list below.
- Clicking a volume's zone directly, and clicking its filter button, both zoom the same way; re-selecting "Tous les tomes" returns to the full view.
- Hovering a bookmark shows a truncated preview; leaving hides it.
- Clicking a bookmark opens the full quote in a modal; `Escape`, the close button, and an outside click all dismiss it. Editing the comment and the tags from within the modal — see `docs/features/quote-save-tags.md` for the detailed manual verification matrix (comment save/trim/clear, tag add/remove, re-opening the same quote).
- Two quotes on nearby pages render at visibly different bar heights instead of fully overlapping.
