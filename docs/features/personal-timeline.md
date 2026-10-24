# Personal timeline — Technical Design

A graphical bar, shown to connected users on the unified search/citations page (`/`, `SearchPage` — see `docs/features/search-frontend.md`), positioning the user's saved quotes on the structure of the work (volume → page), not on the date they were saved — that's what the list below it already does. `/mes-citations` redirects to `/`, preserved for previously bookmarked links. See [ADR-009](../architecture/ADR-009-base-ui-dependency.md) for the Base UI dependency decision behind the quote-detail modal.

---

## Data flow

```
GET /api/quotes/timeline?tagId=   (authenticated, unpaginated — needs every quote at once to place every bookmark)
  → QuoteController.timeline()
  → QuoteService.getTimeline(userId, tagId)
    → QuoteTimelineRepository.findByUserId  (quote_selections ⋈ paragraphs, ordered by paragraphs.position)
    → QuoteTagRepository.findByQuoteIds  (same batch pattern as list())
  → TimelineResponse { volumes: VolumeResponse[7], quotes: TimelineQuote[] }

GET /api/volumes (public structural metadata)
  → VolumeController → VolumeService → VolumeRepository
  → VolumeResponse[7] (no quote, bookmark, or tag data)
```

The public volume endpoint supplies only the fixed structure needed to navigate and filter the corpus. The personal timeline endpoint remains authenticated and is fetched only when a session is present. Anonymous visitors therefore get the same frieze geometry and volume filters without loading personal data. The boundary is recorded in [ADR-017](../architecture/ADR-017-public-corpus-structure.md).

`GET /api/quotes` (paginated, `size` ≤ 20) could never have served this: the timeline needs every saved quote in one response to place every bookmark, not one page of results.

## `volumes.min_page`/`max_page` — computed once, at import time

Each volume's page range is needed to position bookmarks proportionally and to draw the delimiter between volumes. Rather than recomputing `MIN`/`MAX(page_number)` on every request (or caching that computation), the bounds are **persisted as plain columns** (`V6__volumes_page_range.sql`, nullable — `volumes` is seeded by `V2` before any paragraph exists, so the bounds can't be known at seed time). `CorpusImportService` writes them once, right after inserting all paragraphs:

```sql
UPDATE volumes SET min_page = ..., max_page = ...
FROM (SELECT volume_id, MIN(page_number), MAX(page_number) FROM paragraphs GROUP BY volume_id) ranges
WHERE volumes.id = ranges.volume_id
```

`VolumeRepository` reads the 7 already-computed rows for the public endpoint — no aggregation at request time, at any scale. The personal timeline reuses those structural DTOs through `VolumeService` instead of querying volume metadata through its quote repository. Page numbers are continuous across the whole corpus (e.g. tome 1 = pages 1–103, tome 7 = 434–486), never resetting per volume.

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

**Layout** — the frieze spans the page above the tome list and search results. On narrow screens, the list moves into the header drawer and the frieze is hidden on phones. These navigation controls are public; personal bookmarks and saved-citation controls require a session.

**Frieze rendering** — SVG positions bookmarks along the page range without inline styles. `ResizeObserver` keeps its aspect ratio responsive; HTML labels wrap and center in each volume zone.

- **Positioning** — bookmark positions follow each quote's page within its tome. Overlapping bookmarks alternate between two heights.
- **Tome selection** — the frieze and desktop list or drawer share one selection. It zooms the frieze, filters bookmarks and results, and resets pagination. Selecting the active tome again clears the filter. The unpaginated timeline response supplies all bookmarks.
- **Keyboard and pointer access** — inactive tome zones leave the tab order when hidden. The frieze stays sticky while scrolling.
- **Bookmark preview** — HTML labels inside the SVG wrap naturally and open on hover or keyboard focus.
- **Quote details** — selecting a bookmark opens the shared detail modal with reading context and tag controls. Deletion remains in the saved-quote list. See [Quote save and tags](quote-save-tags.md) and [Paragraph context](paragraph-context.md).

## Current limitations

- **No tag filter specific to the timeline** — it inherits whatever tag is active in `TagFilterBar` below it; there's no separate control.
- **No clustering of overlapping bookmarks** — only the alternating-height trick above. Revisiting this depends on one user's own quote count over time, not on how many users the app has.

## Manual verification

- **Anonymous structure and privacy:** without a session, confirm the frieze and tome list show all seven tomes with no bookmarks; `GET /api/volumes` returns only structure, `/api/quotes/timeline` returns `401`, and the browser makes no personal quote/tag requests.
- **Select a tome:** choose one from the desktop list, drawer, or frieze; confirm the active result list and frieze reflect the same selection.
- **Select from frieze:** click another tome zone and confirm sidebar selection, frieze zoom, and result filter stay synchronized.
- **Clear selection:** click the selected tome again in either control and confirm all bookmarks and results return.
- **Saved-citations scope:** repeat while saved citations are active; confirm filtering combines with the selected tag and resets pagination.
