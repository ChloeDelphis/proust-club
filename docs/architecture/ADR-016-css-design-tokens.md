# ADR-016: CSS design tokens — custom properties, semantic naming, no animation library

## Decision

**A single `apps/frontend/src/styles/tokens.css`, imported once by `index.css`, defining plain CSS custom properties (`:root`). Components consume semantic tokens (`var(--color-accent)`, `var(--space-4)`) — never a raw literal, never the raw palette tier directly.**

## Context

An audit of the existing frontend (2026-10-09) found no design system at all: 25 `.module.css` files each re-declared colors, font sizes, spacing, radii, and shadows as literals. Several values that should have been identical had drifted into near-duplicates — e.g. three purple hover shades (`#6b3fa0`/`#5a3490`/`#4a2b70`), 13 distinct `font-size` values where several differed by under a pixel, three "large overlay" shadows that only differed by a fraction of their blur radius. There was no mechanism to notice or prevent this drift.

**Option A — Tailwind CSS**
Would give a token system and a utility-class workflow in one dependency. Rejected: the project has no utility-class convention anywhere in the frontend (CSS Modules throughout, `CLAUDE.md`'s CSS conventions section is written entirely in terms of `.module.css` files), and adopting Tailwind now would mean rewriting every component's markup, not just its styles — far beyond the scope of consolidating existing values.

**Option B — CSS-in-JS (e.g. a theming library with a JS token object)**
Rejected outright: the project's CSP conventions already forbid libraries that inject styles dynamically into `<head>` (see `CLAUDE.md`, "Contraintes CSP"). Any CSS-in-JS runtime theming solution would violate that constraint.

**Option C — Plain CSS custom properties (chosen)**
No new dependency, no new build step, works natively with CSS Modules (`var(--token)` inside any `.module.css`), and keeps every existing styling convention (BEM-free class names, `is`/`has` state prefixes) unchanged — only the right-hand side of each declaration changes.

## Why

- **Semantic tokens over raw values, uniformly.** Every color token is defined in two tiers: a raw `--palette-*` tier (the actual hex value) and a semantic `--color-*` tier that components actually consume (`--color-accent: var(--palette-purple)`). This costs nothing today and means a future dark theme — not planned now, but not foreclosed either — only requires re-pointing the semantic tier, not touching any component.
- **A numbered spacing scale, not t-shirt sizes.** Tokens are named `--space-1`, `--space-1-5`, `--space-2`, ... in quarter-rem units, rather than `--space-xs`/`--space-sm`/`--space-md`. The existing spacing values didn't fall on a clean power-of-two scale (`0.625rem`, `0.875rem` both needed real steps), and a numbered scale absorbs a future in-between value without a renaming collision the way t-shirt sizes would.
- **No animation/motion library.** Motion lives as plain `@keyframes`/`transition` in `.module.css` files, driven by `--motion-duration-*`/`--motion-ease-*` tokens. A library like Framer Motion sets inline styles via JS — the same CSP constraint that ruled out CSS-in-JS rules this out too.
- **Drift gets resolved, not preserved.** Near-identical values (the three purples, three shadows, a dozen near-identical font sizes) were consolidated into single tokens rather than kept as separate tokens that merely document the existing inconsistency — see `docs/features/visual-design-system.md` for the specific consolidations and the one case (`--color-danger-text` vs `--color-danger-accent`) that was *not* merged because the two values serve genuinely distinct roles.

## Tradeoff accepted

No build-time enforcement that a future component actually uses the tokens instead of a new literal — unlike Tailwind, which makes an arbitrary value visually stand out in JSX, a plain CSS custom property is just as easy to type as a literal. This is mitigated by convention (`CLAUDE.md`'s CSS Modules section now says new styles must consume `tokens.css`) rather than tooling, consistent with how this project already handles most conventions (documented and checked at review time, not lint-enforced) — see `CLAUDE.md`'s note on `max-lines-per-function`-style lint rules being deliberately avoided in favor of qualitative review.

## Date

2026-10-09
