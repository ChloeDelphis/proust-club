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
| `PATCH` | `/api/tags/{id}` | Rename a tag |
| `DELETE` | `/api/tags/{id}` | Delete a tag, independently of any quote |

All nine endpoints require an authenticated session — none are `permitAll()`.

---

## Data flow

```
QuoteSelection (search results — point-and-click marker selection, see below)
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

### Renaming and deleting a tag

A tag created by mistake (typically a typo caught by the implicit upsert, e.g. "Jalouise" instead of "Jalousie") can be fixed or removed independently of any quote:

- **`PATCH /api/tags/{id}`** renames it. `409` if another tag of the same user already has that name (case-insensitive) — same rule as `POST /api/tags`. Renaming a tag to its own name with different casing (e.g. `"combray"` → `"Combray"`) succeeds: the uniqueness check excludes the row being modified, so this isn't treated as a conflict with itself.

  `UPDATE` has no `ON CONFLICT` clause, unlike the `INSERT ... ON CONFLICT DO NOTHING` used for tag creation (see above). The conflict check is instead expressed as a `NOT EXISTS` subquery directly in the `UPDATE`'s `WHERE` clause, avoiding both a check-then-act race and a `catch` on a raw unique-constraint violation. If zero rows are affected, one follow-up `SELECT EXISTS` (ownership check only, no name involved) distinguishes "tag not found" (`404`) from "name already taken" (`409`) — this extra round trip only happens on the failure path, never on a successful rename.

- **`DELETE /api/tags/{id}`** deletes the tag outright. The `quote_selection_tags.tag_id` foreign key has `ON DELETE CASCADE` (`V5__quote_selections_and_tags.sql`), so every quote that had this tag loses it automatically — the quotes themselves are untouched, only their tag list shrinks. There is no "tag still in use" guard: this cascade is the same behavior already accepted for `DELETE /api/quotes/{id}` on the quote side, applied symmetrically to tags.

Both endpoints follow the same ownership discipline as the rest of this feature: `user_id` is embedded directly in the `UPDATE`/`DELETE`'s `WHERE` clause, and a tag that doesn't exist or belongs to another user returns `404`, never `403`.

---

## Response shapes

**`QuoteSelectionResponse`**: `id`, `paragraphId`, `startOffset`, `endOffset`, `selectedText`, `tags` (a list of `{id, name}`, not bare names — a tag is a real resource with its own id, needed by the frontend to call the detach endpoint without a round trip to look it up), `createdAt`.

**`QuoteSelectionListResponse`**: `results`, `total`, `page`, `size` — same pagination envelope as `/api/search`. Ordered by `createdAt` descending, `id` descending as a tiebreaker (two quotes saved in the same instant still need a total order, or `LIMIT`/`OFFSET` pagination could skip or repeat a row across pages).

**`TagResponse`**: `id`, `name` (as the user typed it, trimmed — casing is preserved, only the uniqueness check ignores it).

---

## Frontend — saving a quote from search (`QuoteSelection`)

`src/features/search/QuoteSelection/QuoteSelection.tsx`, rendered by `ParagraphCard` for every search result. Handles the full save flow: entering selection mode, placing two markers, opening the tag popup, and saving.

### Why point-and-click markers instead of the browser's native text selection

The obvious alternative — let the user drag-select text with the browser's native `Selection`/`Range` API — was the original design, but was replaced before any code was written. Mapping a native `Range` back to a character offset in the paragraph's plain text is genuinely awkward once the paragraph is rendered as several DOM nodes (the search-match `<mark>` splits it into `before`/`match`/`after`), and a dragged selection gives no control over snapping to word boundaries. Two repositionable markers, placed and moved by single clicks, sidestep both problems and match the product decision for a more guided, precise gesture.

### Marker placement mechanism

- **Word boundaries**: `getWordBoundaries` (`selectionOffsets.ts`) returns the valid marker positions in a paragraph's text — the start, the end, and the start of every word that follows a run of whitespace. Punctuation glued to a word is not a boundary.
- **Cursor → offset**: `cursorOffset.ts` uses `document.caretRangeFromPoint`/`caretPositionFromPoint` on `mousemove` to find the DOM position under the cursor, then walks the paragraph's text nodes with a `TreeWalker` to convert that into a character offset. Neither browser API is meaningfully testable under jsdom, so this module is a thin, mockable boundary — `QuoteSelection.test.tsx` stubs it and drives the component by offset instead of by simulated screen coordinates.
- **Snapping**: `snapToNearestBoundary` rounds a raw offset to the nearest valid word boundary.
- **Labels are derived, never stored**: `QuoteSelection`'s `Phase` state only ever holds up to two raw offsets (`settled`, the first one placed; `live`, the one currently following the cursor). `deriveMarkerLabels(a, b)` returns `{ start: min(a,b), end: max(a,b) }` on every render — "début"/"fin" are just which offset is smaller right now, live, even mid-drag. This is what makes swapping roles when a marker is dragged past the other one work for free, with no explicit swap branch anywhere.
- **Rendering**: `buildParagraphSegments` (`paragraphSegments.ts`) merges the search-match highlight range and the marker positions into one ordered list of text runs and marker points — replacing the old hardcoded `before`/`<mark>`/`after` split, since there are now up to two more cut points to interleave.
- **Trimming**: once both markers are placed and the popup is dismissed, `trimSelection` strips any leading/trailing whitespace from the final `[start, end)` range before it's sent to the API — a marker landing right after a word still produces a clean `selectedText` with no stray space.

### Single active selection

Only one paragraph can be mid-selection at a time across a page of results. `SelectionContext` (`src/features/search/SelectionContext.ts` + `useSelectionContext.ts`) holds `activeParagraphId`/`startSelection`/`endSelection`, provided once by `SearchPage` around the whole `ResultList`. Every `QuoteSelection` instance disables its own "Sauvegarder une citation" button when another paragraph owns the active selection, and the provider's value resets whenever the search query or page changes (adjusted during render, not in a `useEffect` — see the comment in `SearchPage.tsx`; `setState` inside a plain effect body is flagged by this project's ESLint config).

### Tag popup — no premature API calls

`TagPickerPopup` lets the user search existing tags, check several, and type a name that doesn't exist yet to stage it for creation. Nothing is sent to the backend while the popup is open: a "new" tag name is just a string sitting in local state alongside the checked existing tags' names. The actual `POST /api/quotes` call — with the final `tagNames` array — only happens when the popup closes, whichever way: `Terminer` sends the checked/staged names, the × or a click outside sends an empty array. Calling `POST /api/tags` eagerly when "Créer « nom »" is clicked was considered and rejected: it would leave an orphaned tag in the database if the popup were then dismissed without saving.

### Toast

`ToastProvider` (`src/components/Toast/`), mounted once in `App.tsx`, shows a brief confirmation message after a successful save and dismisses itself after a few seconds. Generic, not specific to this feature — the first shared notification mechanism in the frontend.

### Known limitation

Cursor snapping precision needs more work — placing/repositioning a marker exactly where intended isn't always reliable yet. Not refined further in this iteration; see `private/tickets/precision-repere-selection.md`.

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
- Rename a tag to a genuinely new name → `200`, updated `TagResponse`.
- Rename a tag to its own current name with different casing (e.g. `"combray"` → `"Combray"`) → `200`, not `409`.
- Create two tags, then rename one to the other's name (any casing) → `409`.
- Rename with a blank name or a name over 50 characters → `400`.
- Rename or delete a tag id that doesn't exist, or belongs to another account → `404` in both cases, never `403`.
- Attach a tag to a quote, then delete the tag → `204`; the quote itself is unaffected, but no longer lists that tag; the tag disappears from `GET /api/tags`.

### Frontend (search results — `QuoteSelection`)

- As a connected user, search for a phrase, click "Sauvegarder une citation", place "début" and "fin" by clicking between words, click "Valider la sélection", check a tag and create a new one, click "Terminer" → citation saved with the exact selected text (leading/trailing whitespace trimmed) and both tags, confirmed via `GET /api/quotes`.
- Same flow, but close the tag popup via × instead of "Terminer" → citation still saved, with `tags: []`, even if a tag had been checked before closing.
- As an anonymous visitor, no "Sauvegarder une citation" button appears on any result.
- With a selection in progress on one paragraph, the "Sauvegarder une citation" button on every other visible result is disabled.

**Not manually re-verified** (already covered deterministically by `QuoteSelection.test.tsx`, which drives the same phases with controlled offsets rather than pixel coordinates): dropping the second marker on the first one's boundary is a no-op; repositioning an already-placed marker and having it swap start/end roles when it crosses the other one; "Annuler" resetting to idle.

**Known issue, not yet refined**: cursor snapping precision when placing/repositioning a marker needs more work — see `private/tickets/precision-repere-selection.md`.
