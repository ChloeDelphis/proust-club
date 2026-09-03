# Quote selections and tags — Technical Design

Lets an authenticated user save a selection of text found in a paragraph (the whole paragraph or a substring) and organize it with personal tags. See the [data model](../architecture/data-model.md#user-data) for the underlying schema.

---

## Endpoints

`/api/quotes` (create/list/timeline/update-comment/delete, plus tag attach/detach) and `/api/tags` (create/list/rename/delete). See Swagger UI (`/swagger-ui.html`) for the exact method/route list — not duplicated here, see `CLAUDE.md` ("Doc de feature"). Every endpoint in both groups requires an authenticated session — none are `permitAll()`.

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

A quote can be saved with zero, one, or several tags — there is no floor. Tags can be created two ways, both landing on the same upsert-by-name behavior:

- **Explicit**: `POST /api/tags` creates a tag ahead of time. Returns `409` if a tag with that name (case-insensitive, after trimming) already exists for the user — the intent here is unambiguous ("create a new resource"), so a collision is a real error.
- **Implicit**: `POST /api/quotes` (via `tagNames`) and `POST /api/quotes/{id}/tags` (via `name`) reuse an existing tag if one matches, or create it otherwise. No error on a "collision" — this is the expected, idempotent path for everyday tagging.

Both paths share the same repository primitive: an `INSERT ... ON CONFLICT (user_id, LOWER(name)) DO NOTHING RETURNING id`, targeted precisely at the unique index backing this constraint (not a broad catch of "any unique violation"). Explicit creation treats an empty result as `409`; implicit upsert falls back to a `SELECT` for the existing row's id.

### Ownership is enforced inside every mutating query, not just checked beforehand

Reads and the whole-quote delete resolve ownership with `WHERE id = ? AND user_id = ?` directly. Attaching/detaching a tag go further: `user_id` is embedded in the mutation itself (an `INSERT ... SELECT ... WHERE quote.user_id = ?` for attaching, a `DELETE ... USING quote_selections WHERE quote.user_id = ?` for detaching), not only verified by a preceding read. A `quoteId` that doesn't belong to the caller simply has nothing to insert or delete, regardless of what a bug elsewhere in the calling code might have skipped.

Cross-owner access (e.g. one account targeting another account's quote or tag id) returns `404`, never `403` — this doesn't confirm or deny that the resource exists for someone else, it just looks identical to "not found".

### Detaching the last tag from a quote

Since tagging is optional, removing a quote's only tag is a normal operation — it succeeds (`204`) and leaves the quote with zero tags, exactly as if it had been created without any.

### Personal comment on a quote

`PATCH /api/quotes/{id}` sets or clears the authenticated user's private comment on a quote (`comment TEXT NULL` on `quote_selections`, `V7__quote_comment.sql`). Not settable at creation time — only editable afterwards, from the timeline detail modal (see below and `docs/features/timeline-personnelle.md`).

`UpdateQuoteCommentRequest.comment` has no `@NotBlank` (unlike tag names): blank/omitted is a valid input and means "clear it". The service trims and normalizes an empty/whitespace-only value to `null` — the database never stores an empty string, only `NULL` or real content, mirroring the trim-and-non-empty guarantee already enforced by a `CHECK` constraint on `tags.name` (here done in the service layer instead of a `CHECK`, since `NULL` — not "always non-empty" — is the valid empty state). Max length `2000` (`@Size`), enforced at the application level only — like `selected_text`, there's no DB-level length constraint, since the value isn't indexed or searched.

`updateCommentForOwner` mirrors `insert()`'s use of `UPDATE ... RETURNING` to avoid a second `SELECT` after the write, and — like every other mutation in this feature — embeds `user_id` directly in the `WHERE` clause rather than checking ownership beforehand: a `quoteId` not owned by the caller simply matches zero rows, surfaced as `404` (`ApiException.quoteNotFound()`), the same as every other cross-owner case in this file.

The `comment` field is always present in `QuoteSelectionResponse`/`TimelineQuote` (nullable), even though the frontend currently only ever displays or edits it from the timeline modal — one consistent DTO shape rather than two response variants with/without it.

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

**`QuoteSelectionResponse`**: `id`, `paragraphId`, `startOffset`, `endOffset`, `selectedText`, `comment` (nullable), `tags` (a list of `{id, name}`, not bare names — a tag is a real resource with its own id, needed by the frontend to call the detach endpoint without a round trip to look it up), `createdAt`.

**`QuoteSelectionListResponse`**: `results`, `total`, `page`, `size` — same pagination envelope as `/api/search`. Ordered by `createdAt` descending, `id` descending as a tiebreaker (two quotes saved in the same instant still need a total order, or `LIMIT`/`OFFSET` pagination could skip or repeat a row across pages).

**`TagResponse`**: `id`, `name` (as the user typed it, trimmed — casing is preserved, only the uniqueness check ignores it).

---

## Frontend — saving a quote from search (`QuoteSelection`)

`src/features/search/QuoteSelection/QuoteSelection.tsx`, rendered by `ParagraphCard` for every search result. Detects the browser's own native text selection inside its paragraph, shows a fixed-position contextual menu ("Sauvegarder") once a selection stabilizes, and opens a tag panel to save.

### Native text selection, not point-and-click markers

An earlier version of this feature used two repositionable markers ("début"/"fin") placed by clicking between words, specifically to avoid two problems attributed to the browser's native `Selection`/`Range` API: mapping a `Range` back to a character offset once the paragraph is split into several DOM nodes (the search-match `<mark>` breaks it into `before`/`match`/`after`), and a dragged selection giving no control over snapping to word boundaries. Reversed (`ADR-012-native-text-selection.md`): drag-select is the universal "select to highlight" gesture on the web, the marker click-flow was extra friction, and it shipped with an unresolved cursor-precision bug. Both original objections turned out to be solvable rather than structural — see below.

### Converting a native `Range` to a paragraph-relative offset

`selectionRangeOffset.ts` is the piece that makes native selection viable despite the `<mark>` splitting the paragraph into multiple DOM nodes:

- **`characterOffsetForRangeBoundary(container, node, nodeOffset)`** walks `container` with a `TreeWalker` (`SHOW_TEXT`) to turn a `Range` boundary into a character offset. `node` is usually a text node directly, but a boundary right at the edge of a `<span>`/`<mark>` (a double-click word selection, or a drag starting exactly on a highlight edge) can report the wrapping element instead, with `nodeOffset` indexing into its `childNodes` — resolved by searching outward from that index for the nearest text, forward first then backward, so an empty/childless sibling never breaks the search. A raw `root` that's itself already a bare text node (every segment `QuoteSelection` renders has exactly one) is checked directly, since `TreeWalker(root).nextNode()` never returns `root` itself, only descendants — an early bug found by `/code-review`, not by the initial hand-written tests.
- **`getSelectionOffsets(container, range)`** returns `null` if the range isn't fully contained in `container` (i.e. it spans into a different paragraph or outside it) — this single containment check is also what restricts a saveable selection to a single paragraph, with no coordination needed between `QuoteSelection` instances. Only the `start` boundary is walked through the DOM; `end` is derived as `start + range.toString().length` instead of a second independent walk, since this runs on every `selectionchange` event (continuously during a drag).

### Word-boundary extension

`snapSelectionOutward(text, start, end)` (`selectionOffsets.ts`) extends a raw `[start, end)` range outward to the edges of the words it touches — never inward, so a word the user visibly selected is never cut off. It's a direct character scan (`text[start]`/`text[end - 1]` non-whitespace check, then walk while non-whitespace), not a snap against a precomputed boundary list: a coarse "nearest word-start" lookup can't tell "inside a word" apart from "in the gap right after it", and would otherwise reach backward across an entire untouched word from a position sitting in that gap — the exact regression `/code-review` caught in an earlier version of this function. `trimSelection` (unchanged) then strips any leading/trailing whitespace left after extension.

### Selection lifecycle

`QuoteSelection`'s `Phase` is `idle` | `selected` (a stabilized, word-extended selection, contextual menu showing) | `tagPanel` (open, saving). A `document`-level `selectionchange` listener recomputes `Phase` on every firing, but a single functional `setPhase` update short-circuits to `current` unchanged whenever `current.kind === 'tagPanel'` — without this, a `selectionchange` firing while the panel is open (e.g. from interacting with its own inputs) would yank it away mid-save. The "Sauvegarder" button also needs its own `onMouseDown={e => e.preventDefault()}`: without it, the button's own mousedown collapses the native selection before its `onClick` fires (default browser behavior for a mousedown outside the current selection), flipping `Phase` back to `idle` before the click is ever handled.

A slow save can resolve after its `QuoteSelection` instance has unmounted (e.g. the search query changed while the request was in flight) — `resetToIdle()` guards its one call to `window.getSelection()?.removeAllRanges()` (a document-wide side effect, unlike React's own `setPhase`, which the framework already no-ops safely on an unmounted component) behind an `isMountedRef`. That ref is reset to `true` on the tracking effect's own setup, not only `false` on its cleanup — React 18 StrictMode's dev-only mount→cleanup→mount double-invoke would otherwise leave it stuck at `false` for the component's entire real lifetime.

### Tag panel — `Dialog`-based, "Enregistrer" is the only save path

`TagPickerPopup` uses `@base-ui/react`'s `Dialog` (`Dialog.Root`/`Portal`/`Backdrop`/`Popup`/`Close`) — the same primitive already used by `QuoteDetailModal` (`ADR-009-base-ui-dependency.md`), not a new adoption decision. Tag search/creation is staged locally exactly as before: nothing is sent to the backend while the panel is open, and `POST /api/tags` is never called eagerly on "Créer « nom »" (would leave an orphaned tag if dismissed). What changed from the original design: **only "Enregistrer" saves** (`onSave`, with zero, one, or several tag names — tags stay optional). Every other way of leaving the panel (×, backdrop click, Escape — all routed through one `Dialog.Root onOpenChange`) calls `onCancel` instead, and saves nothing at all, including any tag already checked. While a save is in flight (`isSaving`, from `createQuoteMutation.isPending`): "Enregistrer" and the × close button are both disabled, and `onOpenChange` ignores every dismiss attempt — the request has already been sent and can't actually be aborted, so "cancelling" mid-flight would only desync the UI from a save that's still going to complete.

### Toast

`ToastProvider` (`src/components/Toast/`), mounted once in `App.tsx`, shows a brief confirmation message after a successful save and dismisses itself after a few seconds. Generic, not specific to this feature — the first shared notification mechanism in the frontend.

---

## Frontend — browsing and managing my quotes (`MyQuotesPage`)

`src/features/quotes/MyQuotesPage/`, routed at `/mes-citations`, linked from `Header` only when a session is active. Lists the authenticated user's saved quotes (most recent first), filterable by tag, with quote deletion and inline tag rename/delete — no separate page for tag management.

### Route protection is ad hoc, not a `ProtectedRoute`

`MyQuotesPage` checks `useCurrentUser()` itself and renders `<Navigate to="/login" replace />` if the session query resolves without a user (a `Spinner` is shown while it's still pending, to avoid a redirect flash before the session is known). This is the first "redirect if not authenticated" page in the app — `QuoteSelection` only conditionally renders UI, it never redirects. A generic `ProtectedRoute` wasn't extracted for a single consumer; it's expected to be worth it once the personal timeline (MVP step 7) needs the same guard. The check is UX only, not a security boundary — every underlying endpoint independently rejects an unauthenticated request with `401` regardless of what the frontend renders.

### Composition

- **`TagFilterBar`** (`src/features/quotes/TagFilterBar/`) — a "Tous" button plus one button per tag (`useTags()`, a hook shared with `TagPickerPopup` since this is its second consumer). Renaming is inline: a pencil icon turns the tag's name into a text `<input>` in place; Enter commits, Escape cancels, and losing focus (blur) also commits — a `suppressNextBlurRef` ref prevents Enter/Escape from double-committing through the blur that follows a `<input>` unmount. A `409` (name already taken) shows a toast and leaves the field in edit mode. Deleting a tag asks for confirmation (`window.confirm`) and, if the deleted tag was the active filter, resets the filter to "Tous" — the cache invalidation for `['quotes']` skips its own immediate refetch in that case (`refetchType: 'none'`) since the filter reset already triggers a fresh fetch under the new query key; other cached quote pages are still marked stale normally.
- **`QuoteCard`** (`src/features/quotes/QuoteCard/`) — one quote's `selectedText`, its tags (plain chips, not clickable — filtering goes through `TagFilterBar`), a formatted `createdAt`, and a delete button (confirmation, then `DELETE /api/quotes/{id}`, invalidates `['quotes']`).
- **`Pagination`** (`src/components/Pagination/`) — extracted from `ResultList` in the same change that introduced this page, since `MyQuotesPage` needed the identical page/size/total/prev-next block. `ResultList` now consumes it too, rather than keeping its own copy.

### Filter changes reset the page

Selecting a different tag (or "Tous") resets `page` to `0` via a single wrapped handler (`handleSelectTag`) passed down as `onSelectTag` — unlike `SearchPage`'s selection reset, there's only one entry point that changes `tagId` here, so no render-time state-adjustment trick is needed.

---

## Frontend — editing an existing quote (`QuoteTagEditor`)

`src/features/quotes/QuoteTagEditor/`, the first frontend consumer of `POST/DELETE /api/quotes/{id}/tags[/{tagId}]` — both endpoints existed since this feature's initial build but had no UI caller until the timeline detail modal (`QuoteDetailModal`, see `docs/features/timeline-personnelle.md`) needed one. Live editing, not a staged batch: every add or remove calls the API immediately (`useMutation` + `queryClient.invalidateQueries({ queryKey: ['quotes'] })`, the same pattern already used by `TagFilterBar`'s rename/delete) — unlike `TagPickerPopup`, there's no "Terminer" step to collect changes before sending them, because the quote this component edits already exists server-side (nothing to defer until a later creation call). The search/create-if-missing matching logic (`useTagSearch`, `src/hooks/`) is shared with `TagPickerPopup` — both search an existing tag list and offer to create one that doesn't match, `QuoteTagEditor` additionally excluding tags already attached to the quote from its suggestions.

The personal comment field lives directly in `QuoteDetailModal` (no dedicated sub-component — a single `<textarea>`, one consumer). Saved when the modal **closes** (cross, backdrop click, or Escape — Base UI routes all three through one `onOpenChange` handler), not on blur: closing is the natural "done editing" signal for a field inside a modal, unlike inline editing outside one. Trimmed at save time, and skipped entirely if the trimmed value didn't actually change (no gratuitous `PATCH`). The draft resets from the server value whenever the modal opens on a *different* quote, and also — this needs an explicit check, not just a quote-id comparison — when it **reopens on the same quote**, since `QuoteDetailModal` stays mounted across opens/closes (only the Dialog's `open` prop toggles); without resetting `renderedQuoteId` back to `null` on close too, a stale local draft from before closing would stick around instead of the value actually on the server (found and fixed during manual verification of this feature).

---

## Manual verification

- Search for a phrase, save it as a quote with two tags, confirm both appear in the response with their own ids. **Gotcha**: `/api/search` matches case-insensitively, but `selectedText` revalidation is an exact (case-sensitive) match — the phrase actually highlighted at the returned offsets may not be the same case as the search query typed (e.g. searching "madeleine" can surface a paragraph where the match is actually "Madeleine"); send the text exactly as it appears in the paragraph, not as typed in the search box.
- Save a quote with no tags at all — succeeds, `tags: []`.
- Try to save a quote whose `selectedText` doesn't match the paragraph at the given offsets → `400`.
- `GET /api/quotes` with `page=-1`, `size=0`, or `size=21` → `400` in each case, with a `detail` stating the specific reason (e.g. `"size must be <= 20"`). `tagId=not-a-uuid` (a malformed UUID) also `400`s, but via Spring's own type conversion rather than a bespoke validation message (see ADR-015 — `tagId` moved from a bounded `int` to a `UUID`, so `@Min` no longer applies).
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

**`PATCH /api/quotes/{id}` — comment**

- Happy path: set a comment on a quote with none yet (`{"comment": "Un souvenir marquant."}`) → `200`, `comment` in the response matches, and `GET /api/quotes`/`GET /api/quotes/timeline` both reflect it afterwards.
- Happy path: update an existing comment to a different value → `200`, new value persisted.
- Edge case: send `"  Un souvenir marquant.  "` (leading/trailing whitespace) → `200`, `comment` in the response is trimmed.
- Edge case: send `""` or `"   "` on a quote that already has a comment → `200`, `comment` is `null` afterwards (cleared, not stored as an empty string).
- Edge case: send exactly 2000 characters → `200`, accepted at the limit.
- Validation error: send 2001 characters → `400`.
- Validation error: as a second account, `PATCH` the first account's quote → `404`, never `403`.
- Validation error: `PATCH` a quote id that doesn't exist → `404`.
- Validation error: without a session → `401`.

### Frontend (search results — `QuoteSelection`)

Verified end-to-end in a real headless browser (Playwright, driving an actual native mouse drag-select against the running dev servers — not just simulated offsets), as `marcel_qa`, then confirmed server-side via `GET /api/quotes`:

- Search for "madeleine", drag-select across the highlighted `<mark>` (which covers only "Madeleine", the search term) → the contextual menu ("Sauvegarder") appears at a fixed position, independent of where the selection is on screen. Click it → tag panel opens, create a new tag, click "Enregistrer" → citation saved. The saved `selectedText` was `"Madeleines"` (offsets 422–432), not just `"Madeleine"` — the word-boundary extension correctly pulled in the trailing "s" that sits *outside* the `<mark>`, and the backend's revalidation (`text.substring(start, end) == selectedText`) accepted it, confirming the offsets are genuinely correct against the real paragraph text, not just self-consistent in the frontend.
- Same flow, but press Escape instead of clicking "Enregistrer" (after checking a tag first) → dialog closes, contextual menu does not reappear, and `GET /api/quotes` confirms nothing was saved — including the checked tag, which is discarded along with the citation. This is the behavior change from the old mechanism (closing used to save without tags; now closing any way other than "Enregistrer" saves nothing at all).
- A stray `401` on `/api/auth/me` appears in the browser console before login — pre-existing, expected (every page load probes session state; unrelated to this feature).

**Not manually re-verified** (already covered deterministically by `QuoteSelection.test.tsx`/`TagPickerPopup.test.tsx`/`selectionOffsets.test.ts`/`selectionRangeOffset.test.ts`): no contextual menu for an anonymous visitor even with a selection; a selection confined to whitespace being treated as empty; a selection crossing into a different paragraph being ignored; the tag panel surviving a `selectionchange` firing while open; disabling "Enregistrer" and every dismiss path while a save is in flight; not clearing the document's selection if a save resolves after the component has unmounted.

### Frontend (`/mes-citations` — `MyQuotesPage`)

Verified manually end-to-end in a real browser (register a test account, save quotes from search, then exercise the page below) — see `CLAUDE.md` for a reusable local test account.

- As an anonymous visitor, navigating directly to `/mes-citations` redirects to `/login`.
- As a connected user with no saved quotes, the page shows the empty-state message and no filter bar (no tags exist yet either).
- Save two quotes from search with different tags (one tag each) → both appear on `/mes-citations`, most recent first, each showing its own tag chip and a formatted date.
- Click a tag in the filter bar → only quotes carrying that tag are shown; click "Tous" → full list returns.
- Rename a tag (pencil icon → edit the inline input → Enter) → the new name appears immediately both in the filter bar and on every quote card that carried it.
- Delete a quote (confirm the native dialog) → it disappears from the list immediately.
- Delete a tag that is the currently active filter (confirm the dialog) → the filter bar loses that tag, the active filter resets to "Tous", and any quote that had it now shows one fewer chip (the quote itself is untouched).
- Delete the last remaining quote while filtered to "Tous" → generic empty-state message ("Aucune citation sauvegardée pour le moment.").

**Not manually re-verified** (already covered deterministically by `TagFilterBar.test.tsx`/`QuoteCard.test.tsx`/`MyQuotesPage.test.tsx`): the tag-specific empty-state message (filtered to a tag with zero matching quotes), Escape canceling an in-progress tag rename without committing, a declined delete confirmation being a no-op, and the page resetting to `0` when the active filter changes.

### Frontend (timeline detail modal — `QuoteDetailModal`/`QuoteTagEditor`)

Verified manually end-to-end in a real browser against the running dev servers, on a quote saved with an existing tag, opened from its bookmark on the `/mes-citations` timeline.

- Open the modal → the comment field is empty (no comment saved yet) and the existing tag shows as a removable chip.
- Type a comment with leading/trailing spaces, close via the × button → reopening the same quote shows the trimmed comment, confirmed against the database directly (`quote_selections.comment`).
- Same, closing via Escape instead of the × → same result (both routes call the same close handler).
- Remove the existing tag chip → it disappears immediately (no page reload), and also disappears from the quote's card on `/mes-citations` below; the removed tag reappears as a suggestion in the "Ajouter un tag..." field.
- Type a name that doesn't exist yet and click "Créer « nom »" → the tag is attached immediately, appears as a chip with a remove button.
- Reopen the modal on the same quote after these changes → both the comment and the tag list reflect the values just saved, not stale values left over from before closing (regression: see below).
- Close the modal without changing the comment → confirmed via network inspection that no `PATCH /api/quotes/{id}` request is sent (the unchanged-value guard works).

**Bug found and fixed during this verification**: reopening the *same* quote (not a different one) left the comment textarea showing whatever was last typed locally, rather than the actual saved value — `QuoteDetailModal` stays mounted across opens/closes, and the draft-reset logic only checked whether the quote's *id* had changed, never re-triggering for the same id. Fixed by also resetting the tracked id to `null` when the modal closes, so every reopen — same quote or not — re-syncs the draft from the current `quote.comment`. Covered by a new test (`QuoteDetailModal.test.tsx`, "re-syncs the draft from the server value when the same quote is reopened") in addition to the manual check above.
