# ADR-012: Native browser text selection, replacing point-and-click markers

## Decision

**Detect the browser's native `Selection`/`Range` via a `selectionchange` listener, converting it to a paragraph-relative character offset with a `TreeWalker`.** Replaces the point-and-click marker mechanism ("début"/"fin" placed by clicking between words) built for `citation-sauvegarde`.

## Context

The original design for saving a quote considered native drag-select first, but rejected it before any code was written (see `citation-sauvegarde-0-ticket.md`), for two stated reasons:

1. Mapping a native `Range` boundary back to a character offset in the paragraph's plain text is awkward once the paragraph is rendered as several DOM nodes — the search-match `<mark>` splits it into `before`/`match`/`after`.
2. A dragged selection gives no control over snapping to word boundaries, whereas two repositionable markers do.

The marker mechanism shipped and worked, but carried real cost: an unnatural gesture compared to the universal "select to highlight" pattern used elsewhere on the web (Medium, Kindle, Hypothesis), a multi-step flow (enter selection mode → place two markers → validate → tag), and a cursor-precision bug that was never resolved (`precision-repere-selection.md`).

**Option A — Keep the marker mechanism, refine cursor-snapping precision instead**
No architectural change. But the underlying gesture stays unnatural regardless of how precise the snapping gets, and the precision bug's root cause was never diagnosed — refining it blind isn't guaranteed to actually fix it.

**Option B — Native text selection**
Matches the standard web gesture. Requires solving the two problems that motivated Option A in the first place.

## Why B

Both original objections turned out to be solvable, not structural:

- **DOM-splitting problem**: `characterOffsetForRangeBoundary` (`selectionRangeOffset.ts`) walks the container with a `TreeWalker` restricted to text nodes, so it doesn't matter how many wrapping elements (`<span>`/`<mark>`) sit between them — a `Range` boundary anywhere in that structure resolves to a plain character offset. Getting every edge case of this right took several rounds of review (a leaf single-child element being mistaken for having no text, an empty sibling breaking a naive lookup), but each was a genuine, fixable bug in a self-contained utility, not a sign the whole approach doesn't work.
- **Word-boundary problem**: `snapSelectionOutward` (`selectionOffsets.ts`) extends a raw selection outward to the nearest word edges by scanning characters directly, giving the same "never cuts off a word" guarantee the markers provided — without needing the user to place anything by hand.
- **Bonus, not designed for**: `SelectionContext`/`useSelectionContext` (the mechanism that disabled every other paragraph's "Sauvegarder" button while one was mid-selection) became entirely unnecessary. The browser's native `Selection` is unique per document, so "only one selection active at a time" falls out for free from checking that a `Range` is fully contained in a given paragraph's own container — no shared React context needed to coordinate across paragraphs.
- The cursor-precision bug disappears structurally: there's no click-to-place-a-marker gesture left for imprecise cursor snapping to affect.

## Tradeoff accepted

The native-selection mechanism is more subtle to get exactly right than the guided marker clicks were: correctness depends on real browser DOM/Selection behavior (leaf-element Range boundaries, whitespace-gap positions, `selectionchange` firing continuously during a drag, React 18 StrictMode's double-invoke affecting a lifecycle guard) rather than a small, fully-controlled click state machine. Five distinct bugs of this kind were found and fixed across repeated `/code-review` passes before the branch stabilized (see `private/impl/citation-selection-contextuelle-3-review.md`) — a materially higher review cost than the original marker implementation needed. Judged worth it for the UX payoff: a standard, one-gesture interaction instead of a four-step guided flow.

The old marker-based implementation is preserved, unmodified, on the local branch `archive/quote-selection-point-and-click` (branched from `master` before this feature started), in case it's ever needed again.

## Date

2026-08-17
