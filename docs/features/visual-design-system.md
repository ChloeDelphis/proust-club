# Visual design system — Technical Design

A single CSS token source (`apps/frontend/src/styles/tokens.css`) consolidating colors, typography, spacing, radii, shadows, and motion that were previously duplicated as literals across 25 `.module.css` files. See ADR-016 for why plain CSS custom properties were chosen over Tailwind/CSS-in-JS/an animation library.

## Why this exists

An audit of the existing frontend found a visual identity that already worked in practice (a purple accent, warm neutrals, a Georgia/system-ui serif-sans pairing for titles/body) but was never declared anywhere — every component re-typed its own literals. That let real drift accumulate silently: three different purple hover shades, 13 distinct `font-size` values (several under a pixel apart), three "large overlay" shadows that only differed by a fraction of their blur. This feature extracts and consolidates what already existed into a single source of truth, rather than introducing a new visual language.

## Where the tokens live

`apps/frontend/src/styles/tokens.css`, a plain (non-module) CSS file imported once by `index.css`. Not a `.module.css` — its custom property names and `@keyframes` are global on purpose, so any component can reference them without an import.

## Token categories

- **Color** — two tiers. `--palette-*` holds the raw hex values; `--color-*` (the only tier components should ever consume) names them by role: `--color-accent`, `--color-text-muted`, `--color-danger-bg`, etc.
- **Typography** — three font-family tokens (`--font-display`/`--font-reading`/`--font-ui`, see "Direction B" below), an 8-step type scale (`--text-2xs` through `--text-3xl`), line-height and letter-spacing tokens.
- **Spacing** — `--space-0-5` through `--space-12`, numbered in quarter-rem units rather than t-shirt sizes (`xs`/`sm`/`md`...). See ADR-016 for why: the existing values didn't fall on a clean power-of-two scale, and a numbered scale absorbs an in-between value later without a renaming collision.
- **Radius** — `--radius-sm` through `--radius-full` (pill shape). A literal `border-radius: 50%` (a true circle, `Spinner`) is left as a literal — it isn't a point on a radius scale.
- **Elevation** — `--shadow-sm` and `--shadow-lg`, plus a standalone `--shadow-focus-ring` for input focus rings. Pure black at low opacity regardless of the active color palette — an overlay shadow is a lighting effect, not a themed color, so it wasn't re-derived when the palette changed.
- **Motion** — `--motion-duration-fast`/`--motion-duration-spin` and `--motion-ease-standard`/`--motion-ease-out`. No "slow" tier exists: nothing has needed one yet, and one wasn't added speculatively.

## Direction B — the current palette and typography

The original tokens extraction (above categories) captured an existing-but-undeclared visual identity as-is. That identity was later replaced wholesale: after comparing four distinct art-direction options (built as separate artifacts, not in this repo), direction B — "Club joyeux" — was chosen and applied to `tokens.css`.

**Palette** — warm/joyful, not the original purple-on-white:

| Raw token | Hex | Role |
|---|---|---|
| `--palette-bg` | `#FFF1DF` | Page background (`body`, via `--color-page-bg`) |
| `--palette-surface` | `#FFFAF2` | Cards, popups, inputs (`--color-surface`) |
| `--palette-ink` | `#3A2430` | Primary text (`--color-text`) |
| `--palette-ink-soft` | `#7E656D` | Muted text, strong borders — darkened ~15% from the source artifact's `#8A7078`, which measured below the 4.5:1 WCAG AA threshold for normal text against both backgrounds (real relative-luminance calculation, not estimated) |
| `--palette-signature` / `-hover` | `#884D69` / `#6E3C54` | `--color-accent` / `--color-accent-hover` |
| `--palette-rule` | `#F3DEC4` | Borders, subtle surfaces (`--color-border`, `--color-surface-subtle`) |
| `--palette-accent-coral`/`-lavender`/`-mint` | `#E78C6B`/`#D5D0EF`/`#BFDCCE` | Not yet consumed by a semantic token — no real feature needs them today (the 10-color personal-list palette from the same art direction isn't wired in either, for the same reason: no "Mes listes" feature exists in the real app yet) |

`--color-highlight-bg` (search-match highlighting) is mint at 45% opacity over transparent, not a solid fill — the source artifact's own answer for this role, not an independent choice.

**Typography** — three roles instead of two, self-hosted (CLAUDE.md forbids external font URLs under this project's CSP):

- `--font-display` (Fraunces, italic, weight 500 only) — page/section titles, the "Proust Club" logo.
- `--font-reading` (Source Serif 4, regular + italic) — quote and paragraph text specifically (search results, saved quotes, the quote detail modal) — not page chrome.
- `--font-ui` (DM Sans, weights 400–600 via one variable-font `@font-face` block) — everything else: body default, buttons, labels, menus.

Font files live under `apps/frontend/src/styles/fonts/` (`.woff2`, Latin subset only — covers French diacritics), fetched from Google Fonts' CSS2 API and hosted locally rather than linked externally. Only the weights/styles actually consumed by a token are included — e.g. Fraunces ships italic/500 only, since no token uses it any other way.

## What was deliberately left out

- **An animation library.** Rejected outright — see ADR-016; the project's CSP conventions already forbid libraries that inject styles into `<head>` at runtime.
- **A shared `Modal`/`Overlay` component.** `QuoteDetailModal` and `TagPickerPopup` duplicate their `.backdrop`/`.popup` structure (beyond the `@keyframes`, which *are* shared — see below); unifying them into one component would mean touching both `.tsx` files. Flagged as a follow-up if a third modal appears.
- **The 10-color personal-list palette and the coral/lavender/mint accent tokens.** Part of the same direction-B decision, not wired into any semantic token — no feature consumes them yet (no "Mes listes" in the real app). Adding unused tokens speculatively was rejected the same way an unused motion tier was.
- **Dark mode.** Not implemented. The two-tier color token structure (raw palette → semantic names) is specifically there so a dark theme could be added later by re-pointing the semantic tier, without this being a commitment to build one.

## Shared entrance animation

`@keyframes backdrop-in`/`modal-in` are defined once in `tokens.css` (not per-component) and referenced by both `QuoteDetailModal` and `TagPickerPopup` — the second consumer of an identical pattern outside its originating feature is exactly the threshold `CLAUDE.md`'s promotion rule describes for shared CSS, even though full modal-shell promotion (see above) wasn't done.

## Accessibility

A global `@media (prefers-reduced-motion: reduce)` rule in `index.css` collapses all animation/transition durations to near-zero for users who request it — including the `Spinner`'s indefinite rotation, which is the standard, expected tradeoff for that rule (a reduced-motion user gets a static spinner rather than no loading indicator at all). This is not a substitute for a full accessibility audit (tracked separately, not yet scoped).

Contrast is checked by real computation (relative-luminance formula, not an estimate) against every text/background pair the palette actually produces, each time the palette changes — this caught the `--palette-ink-soft` issue documented above when direction B was applied; the original value measured 4.05:1/4.33:1, re-verified at 4.76:1/4.33:1 → 5.09:1 after the fix, both above the 4.5:1 AA threshold for normal-size text.

## Manual verification

- Every page (`/`, `/login`, `/register`, `/mes-citations`, `/account`) renders with the direction-B palette and typography — no layout shift, no missing color/spacing/font.
- Hover/focus states on buttons, links, and the timeline's SVG markers show a smooth transition rather than an instant snap.
- Opening `QuoteDetailModal` (click a timeline bookmark) and `TagPickerPopup` (save a text selection) shows the backdrop fade and popup fade/scale-in.
- A toast notification fades/rises in on appearance.
- With OS-level "reduce motion" enabled, none of the above transitions/animations are perceptible.
- Quote/paragraph text (search results, saved quotes, the detail modal) renders in the reading serif; titles and the header logo render in the display serif, italic; everything else renders in the UI sans.
