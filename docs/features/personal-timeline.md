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
  → VolumeResponse[7] with their named parts and first pages (no quote, bookmark, or tag data)
```

The public volume endpoint supplies the fixed volume and part structure needed to navigate the corpus. Each part includes its identifier, title, position, and first page; its last page is the next part's first page, or the containing volume's last page. The personal timeline endpoint remains authenticated and is fetched only when a session is present. Anonymous visitors therefore get the same frieze geometry and volume structure without loading personal data. The boundary is recorded in [ADR-017](../architecture/ADR-017-public-corpus-structure.md).

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
    {
      "id": 1, "title": "Du côté de chez Swann", "position": 1, "minPage": 1, "maxPage": 103,
      "parts": [
        { "id": 1, "title": "Combray", "position": 1, "startPage": 1 },
        { "id": 2, "title": "Un amour de Swann", "position": 2, "startPage": 44 },
        { "id": 3, "title": "Noms de pays : le nom", "position": 3, "startPage": 96 }
      ]
    },
    ...
  ],
  "quotes": [
    { "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "paragraphId": 45, "pageNumber": 9, "volumeId": 1, "selectedText": "...", "comment": null, "tags": [...], "createdAt": "..." }
  ]
}
```

`volumes` is always all 7, regardless of whether they contain any quote — the frontend always draws the full structure of the work, not just the parts the user has touched.

## Frontend

**Layout** — the frieze spans the search content on desktop, where it replaces the left tome list. The left column is hidden from 426px upward. Below 48rem, the frieze is hidden and the tome list remains available in the header drawer. These navigation controls are public; personal bookmarks and saved-citation controls require a session.

- **Positioning** — bookmark positions follow each quote's page within its tome. Overlapping bookmarks alternate between two heights.
- **Tome selection** — the frieze and desktop list or drawer share one selection. It zooms the frieze, filters bookmarks and results, and resets pagination. Selecting the active tome again clears the filter. The unpaginated timeline response supplies all bookmarks.
- **Parts within a zoomed tome** — the public volume structure supplies each part's first page. The zoom uses these page boundaries to draw internal delimiters and position each part title while leaving bookmark positions on the same page scale. A fixed-height, right-aligned breadcrumb above the frieze shows the current level: `Toute l’œuvre › I. [tome]` or `Toute l’œuvre › I. [tome] › [partie]`. Earlier levels are clickable and return to the whole work or the selected tome. Part titles use the tome-title typography without Roman numerals. The accessible track label includes the selected tome and its part names.
- **Part filter** — selecting a part from the zoomed frieze filters corpus search and saved citations with `partId`; the backend applies that filter before pagination and counting. The timeline keeps its unpaginated response and filters visible bookmarks locally. Selecting the active part returns to the tome; the breadcrumb links return to the tome or whole work.
- **Keyboard and pointer access** — the named SVG group exposes each visible tome and part zone as a separately named button. Tab moves between controls; Enter or Space activates them. Inactive zones leave the tab order when hidden. The frieze stays sticky while scrolling.
- **Bookmark preview** — HTML labels inside the SVG wrap naturally and open on hover or keyboard focus.
- **Quote details** — selecting a bookmark opens the shared detail modal with reading context and tag controls. Deletion remains in the saved-quote list. See [Quote save and tags](quote-save-tags.md) and [Paragraph context](paragraph-context.md).

## Current limitations

- **No tag filter specific to the timeline** — it inherits whatever tag is active in `TagFilterBar` below it; there's no separate control.
- **No clustering of overlapping bookmarks** — only the alternating-height trick above. Revisiting this depends on one user's own quote count over time, not on how many users the app has.

## Manual verification

- **Responsive tome navigation:** at 425px and below, confirm the tome list remains in the header drawer; between 426px and 48rem, confirm the drawer remains available; from 48rem upward, confirm the left column is gone and the frieze spans the search content.
- **Anonymous structure and privacy:** without a session, confirm the frieze and tome list show all seven tomes with no bookmarks; `GET /api/volumes` returns only structure, `/api/quotes/timeline` returns `401`, and the browser makes no personal quote/tag requests.
- **Select a tome:** choose one from the desktop list, drawer, or frieze; confirm the frieze expands to the selected tome as the other tomes fade away, and the active result list stays in sync.
- **Select from frieze:** click or keyboard-focus another tome zone and activate it with Enter or Space; confirm sidebar selection, frieze zoom, and result filter stay synchronized.
- **Part structure:** zoom into tomes with two and six parts; confirm each part title and vertical delimiter appears at its page boundary, with the selected tome title above the track. Confirm bookmarks stay at their original page positions.
- **Part filter:** select a part in a tome and confirm search results, saved citations, pagination totals, and visible bookmarks follow that part. Select the active part to return to the tome; use the breadcrumb to return to the tome or whole work.
- **Clear selection:** click the selected tome again in either control, or click `Toute l’œuvre` in the breadcrumb from a tome or part; confirm all bookmarks and results return and the frieze does not move vertically.
- **Saved-citations scope:** repeat while saved citations are active; confirm filtering combines with the selected tag and resets pagination.
