# Paragraph context — Technical Design

Returns the paragraphs immediately before/after a given paragraph, within the same volume — what powers the progressive before/after reading context in the two-column detail modal (`DetailModal`, see `docs/features/quote-save-tags.md`).

---

## Endpoint

`GET /api/paragraphs/{id}/context?before=N&after=M` — public, no session required (same reasoning as `GET /api/search`: the corpus is public reading material, not user data). `before`/`after` default to `0`, bounded `0–20` (`@Min`/`@Max`). See Swagger UI (`/swagger-ui.html`) for the exact contract — not duplicated here.

---

## Why a dedicated endpoint, queried progressively

The two-column modal reveals context **one paragraph at a time**, on each click of an up/down arrow — not a fixed amount embedded in the initial response (`SearchHit`/`TimelineQuote`). Baking a context window into those responses would force a depth decision up front for every result/quote, most of which never get expanded. A dedicated endpoint, re-queried with a growing `before`/`after` on each click, matches the actual interaction instead.

The response never includes the center paragraph's own text — the caller already has it (`SearchHit.text` or `quote.selectedText`); this endpoint only ever returns *additional* context.

---

## The volume boundary falls out of the data model, not extra logic

`paragraphs.position` is global and sequential across the whole corpus, but `paragraphs.volume_id` isn't — filtering `WHERE volume_id = (the center paragraph's own volume) AND position BETWEEN ...` means a query for context near the start or end of a volume simply can't return rows from the neighboring volume, with no separate "is this still within bounds" check needed:

```sql
-- before (ParagraphRepository.findBefore), simplified
SELECT id, text, page_number FROM paragraphs
WHERE volume_id = :volumeId AND position < :centerPosition
ORDER BY position DESC
LIMIT :before + 1
```

`findAfter` mirrors this with `position > :centerPosition` and `ORDER BY position ASC`. Each fetches `limit + 1` rows, not `limit` — the extra row (trimmed before the response is built, never returned itself) is what tells `ParagraphService` whether more context exists beyond this batch, without a second `COUNT` query. `before` comes back in reading order (oldest first — the repository returns nearest-first, `ParagraphService` reverses it); `after` is already in reading order as fetched (nearest-first *is* oldest-first going forward from the center).

---

## Response shape

```json
{
  "paragraphId": 42,
  "before": [{ "paragraphId": 40, "text": "...", "pageNumber": 8 }, { "paragraphId": 41, "text": "...", "pageNumber": 9 }],
  "after": [{ "paragraphId": 43, "text": "...", "pageNumber": 9 }],
  "hasMoreBefore": true,
  "hasMoreAfter": false
}
```

`hasMoreBefore`/`hasMoreAfter` distinguish the volume edge from a batch that has more rows beyond it. Requests are capped at 20 paragraphs per direction; the detail modal stops expanding at that limit even if a flag remains `true` because more rows exist in the volume.
