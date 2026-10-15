# Quote selections and tags — Technical Design

Lets an authenticated user save a selection of text found in a paragraph (the whole paragraph or a substring) and organize it with personal tags. See the [data model](../architecture/data-model.md#user-data) for the underlying schema.

---

## Endpoints

`/api/quotes` (create/list/timeline/update-comment/delete, plus tag attach/detach) and `/api/tags` (create/list/rename/delete). See Swagger UI (`/swagger-ui.html`) for the exact method/route list — not duplicated here. Every endpoint in both groups requires an authenticated session — none are `permitAll()`.

---

## Data flow

```
QuoteSelection (search results — native text selection, see below)
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

A quote can have zero to twenty tags. Tag names are limited to 50 characters. `POST /api/quotes` rejects more than twenty tag names before writing the quote or any tags. `POST /api/quotes/{id}/tags` returns `409` when a new tag would exceed the same per-quote limit; adding a tag already attached remains idempotent. Both frontend tag editors prevent adding tags at the limit while leaving removals available. Tags can be created two ways, both landing on the same upsert-by-name behavior:

- **Explicit**: `POST /api/tags` creates a tag ahead of time. Returns `409` if a tag with that name (case-insensitive, after trimming) already exists for the user — the intent here is unambiguous ("create a new resource"), so a collision is a real error.
- **Implicit**: `POST /api/quotes` (via `tagNames`) and `POST /api/quotes/{id}/tags` (via `name`) reuse an existing tag if one matches, or create it otherwise. No error on a "collision" — this is the expected, idempotent path for everyday tagging.

Both paths share the same repository primitive: an `INSERT ... ON CONFLICT (user_id, LOWER(name)) DO NOTHING RETURNING id`, targeted precisely at the unique index backing this constraint (not a broad catch of "any unique violation"). Explicit creation treats an empty result as `409`; implicit upsert falls back to a `SELECT` for the existing row's id.

### Ownership is enforced inside every mutating query, not just checked beforehand

Reads and the whole-quote delete resolve ownership with `WHERE id = ? AND user_id = ?` directly. Attaching/detaching a tag go further: `user_id` is embedded in the mutation itself (an `INSERT ... SELECT ... WHERE quote.user_id = ?` for attaching, a `DELETE ... USING quote_selections WHERE quote.user_id = ?` for detaching), not only verified by a preceding read. A `quoteId` that doesn't belong to the caller simply has nothing to insert or delete, regardless of what a bug elsewhere in the calling code might have skipped.

Cross-owner access (e.g. one account targeting another account's quote or tag id) returns `404`, never `403` — this doesn't confirm or deny that the resource exists for someone else, it just looks identical to "not found".

### Detaching the last tag from a quote

Since tagging is optional, removing a quote's only tag is a normal operation — it succeeds (`204`) and leaves the quote with zero tags, exactly as if it had been created without any.

### Personal comment on a quote

`PATCH /api/quotes/{id}` sets or clears the authenticated user's private comment on a quote (`comment TEXT NULL` on `quote_selections`, `V7__quote_comment.sql`). Not settable at creation time — only editable afterwards, from the timeline detail modal (see below and `docs/features/personal-timeline.md`).

`UpdateQuoteCommentRequest.comment` has no `@NotBlank` (unlike tag names): blank/omitted is a valid input and means "clear it". The service trims and normalizes an empty/whitespace-only value to `null` — the database never stores an empty string, only `NULL` or real content, mirroring the trim-and-non-empty guarantee already enforced by a `CHECK` constraint on `tags.name` (here done in the service layer instead of a `CHECK`, since `NULL` — not "always non-empty" — is the valid empty state). Max length `2000` (`@Size`), enforced at the application level only — like `selected_text`, there's no DB-level length constraint, since the value isn't indexed or searched.

`updateCommentForOwner` mirrors `insert()`'s use of `UPDATE ... RETURNING` to avoid a second `SELECT` after the write, and — like every other mutation in this feature — embeds `user_id` directly in the `WHERE` clause rather than checking ownership beforehand: a `quoteId` not owned by the caller simply matches zero rows, surfaced as `404` (`ApiException.quoteNotFound()`), the same as every other cross-owner case in this file.

The `comment` field is always present in `QuoteSelectionResponse`/`TimelineQuote` (nullable), even though the frontend currently only ever displays or edits it from the timeline modal — one consistent DTO shape rather than two response variants with/without it.

### Filtering by tag

`GET /api/quotes?tagId=...` filters to quotes associated with that tag id. A `tagId` that doesn't exist, or belongs to a different user, isn't an error — it just matches nothing, so the response is `200` with an empty `results` list. This is a collection filter, not a lookup by identity: it also avoids confirming whether a given tag id exists for someone else.

### Filtering by text — `q`

`GET /api/quotes?q=...` (and `GET /api/quotes/timeline?q=...`) does a case-insensitive substring match against the quote's own saved text (`selected_text`) — not the personal comment. Combines with `tagId` (both conditions apply). Blank/omitted is "no text filter," not an error — same normalization as the comment field (trim, empty → no filter). Implemented with `LIKE ... ESCAPE '\'` via jOOQ (`QuoteRepository`'s shared `conditions()` helper), reusing the same pattern (and the same `LikePatterns.escape()` helper, promoted to `com.proustclub.common` once this became its second consumer) `SearchRepository` already used for corpus search — not PostgreSQL full-text search, consistent with that existing choice. This is what powers the unified search page's "saved citations" scope — see `docs/features/search-frontend.md`.

### Renaming and deleting a tag

A tag created by mistake (typically a typo caught by the implicit upsert, e.g. "Jalouise" instead of "Jalousie") can be fixed or removed independently of any quote:

- **`PATCH /api/tags/{id}`** renames it. `409` if another tag of the same user already has that name (case-insensitive) — same rule as `POST /api/tags`. Renaming a tag to its own name with different casing (e.g. `"combray"` → `"Combray"`) succeeds: the uniqueness check excludes the row being modified, so this isn't treated as a conflict with itself.

  `UPDATE` has no `ON CONFLICT` clause, unlike the `INSERT ... ON CONFLICT DO NOTHING` used for tag creation (see above). The conflict check is instead expressed as a `NOT EXISTS` subquery directly in the `UPDATE`'s `WHERE` clause, avoiding both a check-then-act race and a `catch` on a raw unique-constraint violation. If zero rows are affected, one follow-up `SELECT EXISTS` (ownership check only, no name involved) distinguishes "tag not found" (`404`) from "name already taken" (`409`) — this extra round trip only happens on the failure path, never on a successful rename.

- **`DELETE /api/tags/{id}`** deletes the tag outright. The `quote_selection_tags.tag_id` foreign key has `ON DELETE CASCADE` (`V5__quote_selections_and_tags.sql`), so every quote that had this tag loses it automatically — the quotes themselves are untouched, only their tag list shrinks. There is no "tag still in use" guard: this cascade is the same behavior already accepted for `DELETE /api/quotes/{id}` on the quote side, applied symmetrically to tags.

Both endpoints follow the same ownership discipline as the rest of this feature: `user_id` is embedded directly in the `UPDATE`/`DELETE`'s `WHERE` clause, and a tag that doesn't exist or belongs to another user returns `404`, never `403`.

## Response shapes

**`QuoteSelectionResponse`**: `id`, `paragraphId`, `startOffset`, `endOffset`, `selectedText`, `comment` (nullable), `tags` (a list of `TagResponse`, not bare names — a tag is a real resource with its own id, needed by the frontend to call the detach endpoint without a round trip to look it up), `createdAt`.

**`QuoteSelectionListResponse`**: `results`, `total`, `page`, `size` — same pagination envelope as `/api/search`. Ordered by `createdAt` descending, `id` descending as a tiebreaker (two quotes saved in the same instant still need a total order, or `LIMIT`/`OFFSET` pagination could skip or repeat a row across pages).

**`TagResponse`**: `id`, `name` (as the user typed it, trimmed — casing is preserved, only the uniqueness check ignores it), `colorIndex` (an `int` 0-9, the tag's position in a predefined 10-color palette — the palette itself lives in the frontend, not the backend, which only stores and validates the index; see [data model](../architecture/data-model.md#user-data)). Optional on `POST /api/tags`, defaults to `0` when omitted; immutable after creation — no endpoint changes an existing tag's color.

---

## Frontend — saving a quote from search (`QuoteSelection`)

`src/features/search/QuoteSelection/QuoteSelection.tsx`, rendered by `ParagraphCard` for every search result. Detects the browser's own native text selection inside its paragraph, shows a fixed-position contextual menu ("Sauvegarder") once a selection stabilizes, and opens a tag panel to save.

### Native text selection

Saving a quote starts from the browser's native `Selection`/`Range` API (drag-select) rather than a custom point-and-click mechanism — see [ADR-012](../architecture/ADR-012-native-text-selection.md) for the rationale. This requires mapping a `Range` back to a character offset even though the paragraph is split into several DOM nodes (the search-match `<mark>` breaks it into `before`/`match`/`after`), and extending a raw drag selection to clean word boundaries — both handled below.

### Converting a native `Range` to a paragraph-relative offset

`selectionRangeOffset.ts` is the piece that makes native selection viable despite the `<mark>` splitting the paragraph into multiple DOM nodes:

- **`characterOffsetForRangeBoundary(container, node, nodeOffset)`** walks `container` with a `TreeWalker` (`SHOW_TEXT`) to turn a `Range` boundary into a character offset. `node` is usually a text node directly, but a boundary right at the edge of a `<span>`/`<mark>` (a double-click word selection, or a drag starting exactly on a highlight edge) can report the wrapping element instead, with `nodeOffset` indexing into its `childNodes` — resolved by searching outward from that index for the nearest text, forward first then backward, so an empty/childless sibling never breaks the search. A raw `root` that's itself already a bare text node (every segment `QuoteSelection` renders has exactly one) is checked directly, since `TreeWalker(root).nextNode()` never returns `root` itself, only descendants.
- **`getSelectionOffsets(container, range)`** returns `null` if the range isn't fully contained in `container` (i.e. it spans into a different paragraph or outside it) — this single containment check is also what restricts a saveable selection to a single paragraph, with no coordination needed between `QuoteSelection` instances. Only the `start` boundary is walked through the DOM; `end` is derived as `start + range.toString().length` instead of a second independent walk, since this runs on every `selectionchange` event (continuously during a drag).

### Word-boundary extension

`snapSelectionOutward(text, start, end)` (`selectionOffsets.ts`) extends a raw `[start, end)` range outward to the edges of the words it touches — never inward, so a word the user visibly selected is never cut off. It's a direct character scan (`text[start]`/`text[end - 1]` non-whitespace check, then walk while non-whitespace), not a snap against a precomputed boundary list: a coarse "nearest word-start" lookup can't tell "inside a word" apart from "in the gap right after it", and would otherwise reach backward across an entire untouched word from a position sitting in that gap. `trimSelection` then strips any leading/trailing whitespace left after extension.

### Selection lifecycle

`QuoteSelection`'s `Phase` is `idle` | `selected` (a stabilized, word-extended selection, contextual menu showing) | `tagPanel` (open, saving). A `document`-level `selectionchange` listener recomputes `Phase` on every firing, but a single functional `setPhase` update short-circuits to `current` unchanged whenever `current.kind === 'tagPanel'` — without this, a `selectionchange` firing while the panel is open (e.g. from interacting with its own inputs) would yank it away mid-save. The "Sauvegarder" button also needs its own `onMouseDown={e => e.preventDefault()}`: without it, the button's own mousedown collapses the native selection before its `onClick` fires (default browser behavior for a mousedown outside the current selection), flipping `Phase` back to `idle` before the click is ever handled.

A slow save can resolve after its `QuoteSelection` instance has unmounted (e.g. the search query changed while the request was in flight) — `resetToIdle()` guards its one call to `window.getSelection()?.removeAllRanges()` (a document-wide side effect, unlike React's own `setPhase`, which the framework already no-ops safely on an unmounted component) behind an `isMountedRef`. That ref is reset to `true` on the tracking effect's own setup, not only `false` on its cleanup — React 18 StrictMode's dev-only mount→cleanup→mount double-invoke would otherwise leave it stuck at `false` for the component's entire real lifetime.

### Tag panel — `Dialog`-based, "Enregistrer" is the only save path

`TagPickerPopup` uses `@base-ui/react`'s `Dialog` (`Dialog.Root`/`Portal`/`Backdrop`/`Popup`/`Close`) — the same primitive used by `QuoteDetailModal` (`ADR-009-base-ui-dependency.md`). Its tag search/select/create UI (search box, selected chips, checkbox list, "Créer « nom »", "Enregistrer") lives in a separate presentation component, `TagPickerContent` (`TagPickerContent.tsx`, no `Dialog` of its own) — this lets `SearchResultDetailModal` (below) embed the same UI inline, in its own `DetailModal` side column, without nesting a second `Dialog` inside the first. `TagPickerPopup` itself is just the `Dialog` wrapper around it.

Tag search/creation is staged locally: nothing is sent to the backend while the panel is open, and `POST /api/tags` is never called eagerly on "Créer « nom »" (would leave an orphaned tag if dismissed). **Only "Enregistrer" saves** (`onSave`, with zero, one, or several tag names — tags stay optional). In `TagPickerPopup`, every other way of leaving the panel (×, backdrop click, Escape — all routed through one `Dialog.Root onOpenChange`) calls `onCancel` instead, and saves nothing at all, including any tag already checked. While a save is in flight (`isSaving`, from `createQuoteMutation.isPending`): "Enregistrer" and the × close button are both disabled, and `onOpenChange` ignores every dismiss attempt — the request has already been sent and can't actually be aborted, so "cancelling" mid-flight would only desync the UI from a save that's still going to complete.

### Toast

`ToastProvider` (`src/components/Toast/`), mounted once in `App.tsx`, shows a brief confirmation message after a successful save and dismisses itself after a few seconds. Generic, not specific to this feature — the first shared notification mechanism in the frontend.

---

## Frontend — detail modal for an unsaved search result (`SearchResultDetailModal`)

`src/features/search/SearchResultDetailModal/`, opened by a "Voir le détail" button in `ParagraphCard`'s header — not a click on the paragraph text itself, since that text is already a gesture target for native selection (`QuoteSelection`'s own "Sauvegarder" flow). `SearchPage` owns the open/close state (`detailHit: SearchHit | null`), the same "parent owns the single modal instance" pattern as `QuoteDetailModal`.

Same `DetailModal` layout as `QuoteDetailModal`, but for a paragraph that isn't saved yet: `centerContent` highlights the matched phrase (`buildHighlightSegments`, the same helper `ParagraphCard`/`QuoteSelection` use) instead of showing a bare `selectedText`, and `sideContent` is `TagPickerContent` directly (no second `Dialog`), wired to a local `createQuote` mutation instead of `onSave` bubbling up to a parent. On a successful save: invalidates `['quotes']`, shows the same toast as `QuoteSelection`'s own save flow (`quoteSelection.savedToast`/`saveErrorToast`), and closes the modal. `closeDisabled`/the `onOpenChange` guard mirror `TagPickerPopup`'s in-flight-save behavior above.

Reading context is public — the modal itself (and its progressive context) is available to anonymous visitors too, same as `/api/search`/`/api/paragraphs/{id}/context`. Only the tag picker in the side panel is gated on `useCurrentUser()`, mirroring `QuoteSelection`'s own contextual "Sauvegarder" menu.

---

## Frontend — browsing and managing my quotes (`QuoteCard`)

No dedicated route or page component — `QuoteCard` (`src/features/quotes/QuoteCard/`) is rendered by `SearchPage`'s `ResultList` when the "saved citations" scope is active (`src/features/search/SearchPage.tsx`). `/mes-citations` redirects to `/`. See `docs/features/search-frontend.md` for the scope toggle, state model, and how `TagFilterBar` (`src/features/quotes/TagFilterBar/`) doubles as the saved-citations entry point plus one button per tag, with inline rename/delete.

Anonymous visitors never reach this scope (`TagFilterBar`/`TimelineBar`/`VolumeList` are all gated on `isConnected` in `SearchPage`) — there's no separate route-level guard.

**`QuoteCard`** shows a quote's `selectedText` (as a button — clicking it opens the detail modal, see below), its tags (plain chips, not clickable — filtering goes through `TagFilterBar`), a formatted `createdAt`, and a delete button (confirmation, then `DELETE /api/quotes/{id}`, invalidates `['quotes']`). `Pagination` (`src/components/Pagination/`) is owned by `ResultList`, shared by both scopes.

---

## Frontend — quote detail modal (`QuoteDetailModal`) and tag editing (`QuoteTagEditor`)

`QuoteDetailModal` (`src/features/quotes/QuoteDetailModal/`) is opened two ways — clicking a bookmark on the frieze (`TimelineBar`), or clicking a citation's text in `QuoteCard` — both report just a quote id up to `SearchPage`, which owns the single modal instance and resolves it against `useTimeline()`'s already-fetched (deduplicated) data; see `docs/features/personal-timeline.md`. It delegates its two-column layout and progressive before/after context to the shared `DetailModal` component — see "Shared two-column layout" below — and owns only what's specific to an already-saved quote: the personal comment and `QuoteTagEditor`, passed as `sideContent`.

Since `QuoteCard`'s quote objects don't carry `pageNumber`/`volumeId` (only the unpaginated timeline does — see `docs/features/personal-timeline.md`'s data flow), `QuoteDetailModal`'s meta line falls back to just the formatted date when those fields are absent, instead of `"{volume} — page {N} · {date}"`.

### `QuoteTagEditor`

`src/features/quotes/QuoteTagEditor/`, the first frontend consumer of `POST/DELETE /api/quotes/{id}/tags[/{tagId}]` — both endpoints existed since this feature's initial build but had no UI caller until `QuoteDetailModal` needed one. Live editing, not a staged batch: every add or remove calls the API immediately (`useMutation` + `queryClient.invalidateQueries({ queryKey: ['quotes'] })`, the same pattern already used by `TagFilterBar`'s rename/delete) — unlike `TagPickerPopup`, there's no "Terminer" step to collect changes before sending them, because the quote this component edits already exists server-side. The search/create-if-missing matching logic (`useTagSearch`, `src/hooks/`) is shared with `TagPickerPopup` — both search an existing tag list and offer to create one that doesn't match, `QuoteTagEditor` additionally excluding tags already attached to the quote from its suggestions.

The personal comment field lives directly in `QuoteDetailModal` (no dedicated sub-component — a single `<textarea>`, one consumer). Saved when the modal closes (cross, backdrop click, or Escape — Base UI routes all three through one `onOpenChange` handler), not on blur: closing is the natural "done editing" signal for a field inside a modal, unlike inline editing outside one. Trimmed at save time, and skipped entirely if the trimmed value didn't actually change (no gratuitous `PATCH`). The modal waits for active quote queries to refresh after a successful `PATCH` before it closes, so reopening the quote immediately cannot pick an older comment from the timeline cache. The draft resets from the server value whenever the modal opens on a different quote, and also when it reopens on the *same* quote — `QuoteDetailModal` stays mounted across opens/closes (only `DetailModal`'s `paragraphId` prop toggles), so the draft-reset logic resets the tracked quote id back to `null` on close too, not only when a new id arrives.

---

## Shared two-column layout and progressive context (`DetailModal`)

`DetailModal` (`src/components/DetailModal/`) is the layout both `QuoteDetailModal` and `SearchResultDetailModal` (above) delegate to — a two-column Base UI `Dialog`: main column (context paragraphs + the center text the caller provides via `centerContent`) and a side column (`sideContent`, fully owned by the caller — comment/tags/delete for an existing quote, or the tag picker + "Enregistrer" for an unsaved search result). Lives directly in `src/components/` rather than a single feature's folder, since both consumers are real from the start.

**Progressive context**: two arrow buttons (▲ above, ▼ below the center text) each request one more paragraph of context in that direction, backed by `GET /api/paragraphs/{id}/context?before=N&after=M` — see `docs/features/paragraph-context.md` for the endpoint. `before`/`after` are local component state that only grows (never shrinks) on each click; `useParagraphContext` (`src/hooks/useParagraphContext.ts`) re-fetches the whole window each time rather than appending client-side. An arrow is disabled while a request is in flight, at the volume boundary, or when its direction reaches the 20-paragraph request limit; `hasMoreBefore`/`hasMoreAfter` can remain true at that limit if the volume contains further rows.

The context window resets to `before: 0, after: 0` whenever `paragraphId` changes to a different value — `DetailModal` can stay mounted across different quotes/results opening in sequence (only `paragraphId` toggles), so this reset is explicit state logic, the same pattern `QuoteDetailModal`'s own comment draft uses.

`closeDisabled` (optional prop) lets a caller block the × close button — used by `SearchResultDetailModal` while a save is in flight, for the same reason `TagPickerPopup` disables its own close button in that state: the request can't be aborted once sent.

---

## Manual verification

- Open the quote tag picker, select twenty tags, and confirm that further existing tags and new tag creation are disabled while selected tags can still be removed. Open an existing quote with twenty tags and confirm tag additions are disabled while removals remain available.
- Submit a quote request with twenty tags and confirm it succeeds; submit one with twenty-one tags and confirm it returns `400` without creating a quote or tags.
