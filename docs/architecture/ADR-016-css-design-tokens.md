# ADR-016: CSS design tokens

## Decision

Define shared design values in `apps/frontend/src/styles/tokens.css`, imported by `index.css`, using CSS custom properties. Components consume semantic tokens; raw palette values stay in the token file. Use CSS Modules and native CSS motion, with no CSS-in-JS or animation-library dependency.

Tokenize reusable design choices such as colors, spacing, typography, radii, shadows, and motion. Structural CSS values (for example `0`, percentages, or one-off text-relative offsets) may remain literal where they do not represent a shared design token.

## Context and rationale

The frontend had repeated color, spacing, typography, and shadow literals that had drifted. CSS custom properties consolidate these values without changing the CSS Modules workflow or adding a runtime dependency. A semantic layer separates component intent from the palette and allows theme values to change centrally.

A numbered spacing scale preserves existing intermediate values. Motion remains in CSS so styles are not injected dynamically by JavaScript.

## Trade-off

CSS does not enforce token use at build time. New reusable design values must use the tokens and are checked in review.

## Date

2026-10-09
