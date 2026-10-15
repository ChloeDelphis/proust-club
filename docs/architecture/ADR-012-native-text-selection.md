# ADR-012: Native browser text selection for saving quotes

## Decision

Use the browser's `Selection` and `Range` APIs. Convert a selection to paragraph-relative offsets with a text-node `TreeWalker`, then snap the offsets outward to word boundaries. This replaces the earlier point-and-click start/end markers.

## Context and rationale

The marker flow required several steps and had a cursor-precision bug. Native selection matches standard browser behavior. A `TreeWalker` maps ranges across text split by React markup such as search highlights; character scanning preserves whole-word boundaries.

The browser has one document selection at a time, so no shared React context is needed to coordinate active paragraph selections.

## Trade-off

Native DOM selection behavior has edge cases around element boundaries and selection events. The mapping and snapping logic is isolated in utilities and covered by frontend tests.

## Date

2026-08-17
