# Visual design system — Technical Design

A single CSS token source (`apps/frontend/src/styles/tokens.css`) consolidating colors, typography, spacing, radii, shadows, and motion that were previously duplicated as literals across 25 `.module.css` files. See ADR-016 for why plain CSS custom properties were chosen over Tailwind/CSS-in-JS/an animation library.

## Why this exists

An audit of the existing frontend found a visual identity that already worked in practice (a purple accent, warm neutrals, a Georgia/system-ui serif-sans pairing for titles/body) but was never declared anywhere — every component re-typed its own literals. That let real drift accumulate silently: three different purple hover shades, 13 distinct `font-size` values (several under a pixel apart), three "large overlay" shadows that only differed by a fraction of their blur. This feature extracts and consolidates what already existed into a single source of truth, rather than introducing a new visual language.

## Where the tokens live

`apps/frontend/src/styles/tokens.css`, a plain (non-module) CSS file imported once by `index.css`. Not a `.module.css` — its custom property names and `@keyframes` are global on purpose, so any component can reference them without an import.

## Token categories

- **Color** — two tiers. `--palette-*` holds the raw hex values; `--color-*` (the only tier components should ever consume) names them by role: `--color-accent`, `--color-text-muted`, `--color-danger-bg`, etc.
- **Typography** — `--font-serif`/`--font-sans` (unchanged from before — still system fonts, no webfont; see the ticket's decision on this), an 8-step type scale (`--text-2xs` through `--text-3xl`), line-height and letter-spacing tokens, and `--font-weight-regular` (the only weight actually in use today).
- **Spacing** — `--space-0-5` through `--space-12`, numbered in quarter-rem units rather than t-shirt sizes (`xs`/`sm`/`md`...). See ADR-016 for why: the existing values didn't fall on a clean power-of-two scale, and a numbered scale absorbs an in-between value later without a renaming collision.
- **Radius** — `--radius-sm` through `--radius-full` (pill shape). A literal `border-radius: 50%` (a true circle, `Spinner`) is left as a literal — it isn't a point on a radius scale.
- **Elevation** — `--shadow-sm` and `--shadow-lg`, plus a standalone `--shadow-focus-ring` for input focus rings.
- **Motion** — `--motion-duration-fast`/`--motion-duration-spin` and `--motion-ease-standard`/`--motion-ease-out`. No "slow" tier exists: nothing in this diff needed one, and one wasn't added speculatively (see "What was deliberately left out" below).

## Resolving drift: what was merged, and what wasn't

Each consolidation below collapsed values that were close enough to be indistinguishable or that served the exact same UI role in different places, snapped to whichever of the close values was already more common:

- Three purple shades (`#6b3fa0`/`#5a3490`/`#4a2b70`) → two tokens (`--color-accent`, `--color-accent-hover`). The darkest one, previously only used for a timeline bookmark's hover state, was folded into `--color-accent-hover` — see the open note below, this one specific merge is flagged for a second look rather than treated as settled.
- 13 raw `font-size` values → 8 scale steps. Values under roughly 2% apart (e.g. `0.8rem`/`0.8125rem`/`0.85rem`, or `1.0625rem`/`1.1rem`/`1.125rem`) were treated as drift and merged; values further apart (`0.875rem` vs `0.9375rem`, a real ~7% step) were kept distinct.
- Two near-identical "large overlay" shadows (`0 8px 30px`/`0 8px 24px`, same offset, blur within 25% of each other) → one `--shadow-lg`. A third shadow (`0 4px 16px`, on a small floating action button, not a full-screen overlay) has a different *offset*, not just a rounding difference — it was **not** folded into `--shadow-lg`; it maps to `--shadow-sm` instead (same 4px offset), a decision corrected during `/code-review` after an initial pass had merged it too aggressively.
- `--color-danger-text` (`#b91c1c`, static validation-error text) and `--color-danger-accent` (`#b3423f`, a destructive action's hover accent) were **not** merged despite both being "a shade of red" — each has exactly one, distinct semantic role, unlike the cases above where the same role had multiple arbitrary values. Merging them would reduce expressiveness without fixing real drift.

## What was deliberately left out

- **Webfonts.** `CLAUDE.md` requires an explicit CSP decision (`font-src`) before loading an external font; the existing Georgia/system-ui pairing already works, so this wasn't revisited.
- **An animation library.** Rejected outright — see ADR-016; the project's CSP conventions already forbid libraries that inject styles into `<head>` at runtime.
- **A shared `Modal`/`Overlay` component.** `QuoteDetailModal` and `TagPickerPopup` duplicate their `.backdrop`/`.popup` structure (beyond the `@keyframes`, which *are* shared — see below); unifying them into one component would mean touching both `.tsx` files, outside the scope of a tokens-only change. Flagged as a follow-up if a third modal appears.
- **Dark mode.** Not implemented. The two-tier color token structure (raw palette → semantic names) is specifically there so a dark theme could be added later by re-pointing the semantic tier, without this being a commitment to build one.

## Shared entrance animation

`@keyframes backdrop-in`/`modal-in` are defined once in `tokens.css` (not per-component) and referenced by both `QuoteDetailModal` and `TagPickerPopup` — the second consumer of an identical pattern outside its originating feature is exactly the threshold `CLAUDE.md`'s promotion rule describes for shared CSS, even though full modal-shell promotion (see above) wasn't done.

## Accessibility

A global `@media (prefers-reduced-motion: reduce)` rule in `index.css` collapses all animation/transition durations to near-zero for users who request it — including the `Spinner`'s indefinite rotation, which is the standard, expected tradeoff for that rule (a reduced-motion user gets a static spinner rather than no loading indicator at all). This is not a substitute for a full accessibility audit (tracked separately, not yet scoped) — only a spot-check that newly-added motion respects the preference, and that none of the consolidated color pairs regressed WCAG AA contrast for text.

## Manual verification

- Every page (`/`, `/login`, `/register`, `/mes-citations`, `/account`) renders with the new tokens — no layout shift, no missing color/spacing compared to before the migration.
- Hover/focus states on buttons, links, and the timeline's SVG markers show a smooth transition rather than an instant snap.
- Opening `QuoteDetailModal` (click a timeline bookmark) and `TagPickerPopup` (save a text selection) shows the backdrop fade and popup fade/scale-in.
- A toast notification fades/rises in on appearance.
- With OS-level "reduce motion" enabled, none of the above transitions/animations are perceptible.
