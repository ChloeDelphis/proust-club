# ADR-009: First UI primitives dependency — Base UI, for the personal timeline's modal

## Decision

**`@base-ui/react`, specifically its `Dialog` primitive.**

## Context

The personal timeline (a graphical bar on `/mes-citations` showing saved quotes positioned on the work's structure) needs a modal that opens when a bookmark is clicked, showing the full quote. Every interactive overlay built so far in this frontend (`Toast`, `TagPickerPopup`) has been hand-built from scratch — no UI primitives library has been a real dependency until now, even though "Base UI" was already listed in `CLAUDE.md`'s stack table as the intended choice.

A true modal dialog has real accessibility requirements a from-scratch build would have to reinvent correctly: focus trap while open, `Escape` to close, `aria-modal`/focus restoration on close, click-outside dismissal. `TagPickerPopup`'s hand-rolled `useClickOutside` hook covers the simpler "anchored popup" case, but not a full page-level modal.

**Option A — Build it by hand, like `Toast`/`TagPickerPopup`**
No new dependency. But a correct focus trap and full keyboard/screen-reader behavior for a modal is a meaningfully bigger surface than a click-outside hook — reinventing it risks getting the accessibility details wrong on the first real "true modal" use case.

**Option B — `@base-ui/react`'s `Dialog`**
Unstyled, composable (`Dialog.Root`/`Trigger`/`Portal`/`Backdrop`/`Popup`/`Close`), ships focus trap, `Escape`, `aria-modal`, and outside-press dismissal out of the box. Already the intended stack choice per `CLAUDE.md`, just never previously needed.

## Why Option B

The timeline's citation modal is exactly the kind of component where getting accessibility "for free" is worth a first dependency: a real focus trap is not trivial to get right, and this is the first feature that actually needs one. Styling stays fully custom (CSS Modules, same as every other component) — Base UI only supplies behavior, not appearance.

```tsx
<Dialog.Root open={quote !== null} onOpenChange={open => { if (!open) onClose() }}>
  <Dialog.Portal>
    <Dialog.Backdrop className={styles.backdrop} />
    <Dialog.Popup className={styles.popup} aria-label="Citation">
      <Dialog.Close className={styles.closeButton} aria-label="Fermer">×</Dialog.Close>
      {/* ... */}
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

## Correction made during installation

The package was originally going to be installed as `@base-ui-components/react` (the name checked during technical analysis). `pnpm add` surfaced a deprecation warning at install time: the package was renamed to `@base-ui/react`, with real stable releases since (`1.0.0` through `1.7.0`, versus the `1.0.0-rc.0` originally targeted under the old name). Installed `@base-ui/react@1.7.0` instead — caught before it shipped, not after.

## Tradeoff accepted

First real UI-primitives dependency in a frontend that has otherwise built everything by hand. Scoped narrowly: only `Dialog` is used for now. Passes the existing supply-chain gate (`minimumReleaseAge`/`minimumReleaseAgeStrict` in `apps/frontend/pnpm-workspace.yaml`, see ADR-008) like any other dependency — no exception made for it.

## Date

2026-08-07
