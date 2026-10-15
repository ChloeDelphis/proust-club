# ADR-009: UI primitives — Base UI

## Decision

Use `@base-ui/react` for accessible interactive primitives. It was introduced for the personal timeline's modal; the frontend now uses its `Dialog` and `Menu` primitives.

## Context

A modal requires focus management, keyboard dismissal, and focus restoration. Reimplementing those behaviors for the timeline introduced avoidable accessibility risk. Base UI provides unstyled primitives that preserve the project's CSS Modules styling approach.

## Rationale and scope

Use Base UI where a component's interaction behavior is non-trivial. Current uses are `Dialog` for detail and selection modals and `Menu` for the account menu. Styling remains in CSS Modules; no general component library or visual system is adopted.

## Trade-off

The frontend gains a runtime dependency. Keep usage limited to primitives that provide meaningful interaction or accessibility behavior, and apply the normal dependency-security checks from ADR-008.

## Date

2026-08-07
