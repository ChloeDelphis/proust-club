# Visual design system — Technical Design

A single CSS token source (`apps/frontend/src/styles/tokens.css`) consolidating colors, typography, spacing, radii, shadows, and motion. See ADR-016 for why plain CSS custom properties were chosen over Tailwind/CSS-in-JS/an animation library.

## Overview

The design system is the single source of truth for Proust Club's visual language: color, typography, spacing, radii, shadows, and motion. Components consume tokens rather than literal values, so a palette or scale change propagates from one file instead of requiring a per-component edit.

## Where the tokens live

`apps/frontend/src/styles/tokens.css`, a plain (non-module) CSS file imported once by `index.css`. Not a `.module.css` — its custom property names and `@keyframes` are global on purpose, so any component can reference them without an import.

## Token categories

- **Color** — two tiers. `--palette-*` holds the raw hex values; `--color-*` (the only tier components should ever consume) names them by role: `--color-accent`, `--color-text-muted`, `--color-danger-bg`, etc.
- **Typography** — three font-family tokens (`--font-display`/`--font-reading`/`--font-ui`, see below), an 8-step type scale (`--text-2xs` through `--text-3xl`), line-height and letter-spacing tokens.
- **Spacing** — `--space-0-5` through `--space-12`, numbered in quarter-rem units rather than t-shirt sizes (`xs`/`sm`/`md`...). See ADR-016 for the scale's design.
- **Radius** — `--radius-sm` through `--radius-full` (pill shape). A literal `border-radius: 50%` (a true circle, `Spinner`) is left as a literal — it isn't a point on a radius scale.
- **Elevation** — `--shadow-sm` and `--shadow-lg`, plus a standalone `--shadow-focus-ring` for input focus rings. Pure black at low opacity regardless of the active color palette — an overlay shadow is a lighting effect, not a themed color, so it isn't re-derived when the palette changes.
- **Motion** — `--motion-duration-fast`/`--motion-duration-spin` and `--motion-ease-standard`/`--motion-ease-out`. No "slow" tier exists.

## Palette and typography

**Palette** — warm/joyful:

| Raw token | Hex | Role |
|---|---|---|
| `--palette-bg` | `#FFF1DF` | Page background (`body`, via `--color-page-bg`) |
| `--palette-surface` | `#FFFAF2` | Cards, popups, inputs (`--color-surface`) |
| `--palette-ink` | `#3A2430` | Primary text (`--color-text`) |
| `--palette-ink-soft` | `#7E656D` | Muted text, strong borders — measures 4.76:1/5.09:1 against the page/surface backgrounds, above the 4.5:1 WCAG AA threshold for normal-size text |
| `--palette-signature` / `-hover` | `#884D69` / `#6E3C54` | `--color-accent` / `--color-accent-hover` |
| `--palette-rule` | `#F3DEC4` | Borders, subtle surfaces (`--color-border`, `--color-surface-subtle`) |
| `--palette-accent-coral`/`-lavender`/`-mint` | `#E78C6B`/`#D5D0EF`/`#BFDCCE` | Not yet consumed by a semantic token — reserved for features not yet built (e.g. a future personal-list color coding) |

`--color-highlight-bg` (search-match highlighting) is mint at 45% opacity over transparent, not a solid fill.

**Typography** — three roles, self-hosted (no external font URLs, per the project's CSP):

- `--font-display` (Fraunces, italic, weight 500 only) — page/section titles, the "Proust Club" logo.
- `--font-reading` (Source Serif 4, regular + italic) — quote and paragraph text specifically (search results, saved quotes, the quote detail modal) — not page chrome.
- `--font-ui` (DM Sans, weights 400–600 via one variable-font `@font-face` block) — everything else: body default, buttons, labels, menus.

Font files live under `apps/frontend/src/styles/fonts/` (`.woff2`, Latin subset only — covers French diacritics), hosted locally. Only the weights/styles actually consumed by a token are included — e.g. Fraunces ships italic/500 only, since no token uses it any other way.

## Current limitations

- **No shared `Modal`/`Overlay` component.** `QuoteDetailModal` and `TagPickerPopup` duplicate their `.backdrop`/`.popup` structure (beyond the shared `@keyframes`, see below).
- **The 10-color personal-list palette and the coral/lavender/mint accent tokens** are defined but not wired into any semantic token — no feature consumes them yet.
- **No dark mode.** The two-tier color token structure (raw palette → semantic names) allows a dark theme to be added later by re-pointing the semantic tier.

## Shared entrance animation

`@keyframes backdrop-in`/`modal-in` are defined once in `tokens.css` (not per-component) and referenced by both `QuoteDetailModal` and `TagPickerPopup`.

## Accessibility

A global `@media (prefers-reduced-motion: reduce)` rule in `index.css` collapses all animation/transition durations to near-zero for users who request it — including the `Spinner`'s indefinite rotation, which continues to render statically rather than disappearing. This is not a substitute for a full accessibility audit.

Contrast is checked against every text/background pair the palette produces using the real relative-luminance formula (not an estimate), each time the palette changes.
