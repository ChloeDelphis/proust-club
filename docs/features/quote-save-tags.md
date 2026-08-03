# Quote selections and tags — Technical Design

Lets an authenticated user save a selection of text found in a paragraph (the whole paragraph or a substring) and organize it with personal tags. See the [data model](../architecture/data-model.md#user-data) for the underlying schema.

---

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/quotes` | Save a quote selection, with optional tags |
| `GET` | `/api/quotes` | List the authenticated user's quotes, optionally filtered by `tagId`, paginated |
| `DELETE` | `/api/quotes/{id}` | Delete a quote (and its tag associations) |
| `POST` | `/api/quotes/{id}/tags` | Attach a tag (by name) to an existing quote |
| `DELETE` | `/api/quotes/{id}/tags/{tagId}` | Detach a tag from a quote |
| `POST` | `/api/tags` | Create a tag ahead of tagging any quote |
| `GET` | `/api/tags` | List the authenticated user's tags |

All seven endpoints require an authenticated session — none are `permitAll()`.

---

## Data flow

```
React component (future — MVP step 6)
  → POST /api/quotes { paragraphId, startOffset, endOffset, selectedText, tagNames? }
  → QuoteController          resolves user_id from the session (never from the request body)
  → QuoteService.create()
      1. load the paragraph's real text (404 if the paragraph doesn't exist)
      2. re-validate: paragraph.text.substring(startOffset, endOffset) == selectedText
      3. insert the quote_selections row
      4. for each tagName: upsert the tag, attach it to the quote
  → QuoteRepository / TagRepository (jOOQ, no codegen — raw table/column references)
  → PostgreSQL
```

### Server-side revalidation of `selectedText`

The client sends `paragraphId`, `startOffset`, `endOffset` and `selectedText` together. The server does not trust that combination — it reloads the paragraph's actual text and checks `text.substring(startOffset, endOffset).equals(selectedText)`, rejecting the request (`400`) otherwise. This isn't a security boundary (a user can only corrupt their own data), but it prevents saving a quote whose displayed text silently diverges from what the offsets actually point to.

### Tagging is optional, and tag creation is dual

A quote can be saved with zero, one, or several tags — there is no floor. Tags can be created two ways, both landing on the same upsert-by-name behavior:

- **Explicit**: `POST /api/tags` creates a tag ahead of time. Returns `409` if a tag with that name (case-insensitive, after trimming) already exists for the user — the intent here is unambiguous ("create a new resource"), so a collision is a real error.
- **Implicit**: `POST /api/quotes` (via `tagNames`) and `POST /api/quotes/{id}/tags` (via `name`) reuse an existing tag if one matches, or create it otherwise. No error on a "collision" — this is the expected, idempotent path for everyday tagging.

Both paths share the same repository primitive: an `INSERT ... ON CONFLICT (user_id, LOWER(name)) DO NOTHING RETURNING id`, targeted precisely at the unique index backing this constraint (not a broad catch of "any unique violation"). Explicit creation treats an empty result as `409`; implicit upsert falls back to a `SELECT` for the existing row's id.

### Ownership is enforced inside every mutating query, not just checked beforehand

Reads and the whole-quote delete resolve ownership with `WHERE id = ? AND user_id = ?` directly. Attaching/detaching a tag go further: `user_id` is embedded in the mutation itself (an `INSERT ... SELECT ... WHERE quote.user_id = ?` for attaching, a `DELETE ... USING quote_selections WHERE quote.user_id = ?` for detaching), not only verified by a preceding read. A `quoteId` that doesn't belong to the caller simply has nothing to insert or delete, regardless of what a bug elsewhere in the calling code might have skipped.

Cross-owner access (e.g. one account targeting another account's quote or tag id) returns `404`, never `403` — this doesn't confirm or deny that the resource exists for someone else, it just looks identical to "not found".

### Detaching the last tag from a quote

Since tagging is optional, removing a quote's only tag is a normal operation — it succeeds (`204`) and leaves the quote with zero tags, exactly as if it had been created without any.

### Filtering by tag

`GET /api/quotes?tagId=...` filters to quotes associated with that tag id. A `tagId` that doesn't exist, or belongs to a different user, isn't an error — it just matches nothing, so the response is `200` with an empty `results` list. This is a collection filter, not a lookup by identity: it also avoids confirming whether a given tag id exists for someone else.

---

## Response shapes

**`QuoteSelectionResponse`**: `id`, `paragraphId`, `startOffset`, `endOffset`, `selectedText`, `tags` (a list of `{id, name}`, not bare names — a tag is a real resource with its own id, needed by the frontend to call the detach endpoint without a round trip to look it up), `createdAt`.

**`QuoteSelectionListResponse`**: `results`, `total`, `page`, `size` — same pagination envelope as `/api/search`. Ordered by `createdAt` descending, `id` descending as a tiebreaker (two quotes saved in the same instant still need a total order, or `LIMIT`/`OFFSET` pagination could skip or repeat a row across pages).

**`TagResponse`**: `id`, `name` (as the user typed it, trimmed — casing is preserved, only the uniqueness check ignores it).

---

## Manual verification

- Search for a phrase, save it as a quote with two tags, confirm both appear in the response with their own ids. **Gotcha**: `/api/search` matches case-insensitively, but `selectedText` revalidation is an exact (case-sensitive) match — the phrase actually highlighted at the returned offsets may not be the same case as the search query typed (e.g. searching "madeleine" can surface a paragraph where the match is actually "Madeleine"); send the text exactly as it appears in the paragraph, not as typed in the search box.
- Save a quote with no tags at all — succeeds, `tags: []`.
- Try to save a quote whose `selectedText` doesn't match the paragraph at the given offsets → `400`.
- `GET /api/quotes` with `page=-1`, `size=0`, `size=21`, or `tagId=0` → `400` in each case.
- List quotes filtered by an existing tag id → only matching quotes returned. Filter by a tag id that doesn't exist → empty list, not an error.
- Attach the same tag name twice to the same quote → second call is a no-op, still `200`, still one tag.
- Remove a quote's only tag → succeeds, quote now has zero tags.
- Create a tag "Combray", then try to create "combray" → `409`.
- As a second account, try to read, tag, untag, or delete the first account's quote → `404` in every case.
- Delete a quote → its tag associations disappear, but the tags themselves remain listed under `GET /api/tags` (a tag never gets deleted as a side effect of losing its last quote).
