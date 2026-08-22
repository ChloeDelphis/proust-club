# Internationalisation — Technical Design

How UI text is externalized from components into a translation catalog, and what that does and does not cover today.

---

## Scope: interface text only, not the corpus

Proust Club has two kinds of user-visible text with very different treatment:

- **Interface chrome** — labels, buttons, toasts, error messages, aria-labels. This is what this feature moves into a catalog.
- **Corpus content** — search results, saved quotes, timeline previews. This is Marcel Proust's actual text and is never translated; it stays French regardless of the interface language.

Today the interface itself is still French-only — this feature is the extraction step, not the translation step. A language switcher and additional catalogs (starting with English) are tracked separately in `activation-multilingue` (see `private/tickets/`).

## Why react-i18next

`react-i18next` + `i18next` were chosen over `react-intl` (FormatJS) and Lingui: no build-time extraction tooling to add to the Vite pipeline, mature plural handling via `Intl.PluralRules`, and a much larger body of prior art than Lingui for a team new to i18n tooling. The tradeoff — translation keys are maintained by hand rather than extracted from source — is acceptable at this app's size.

## Catalog structure

`src/locales/fr.json` is a single flat file, one entry per locale (only `fr` today). Keys are dot-nested and named after the component that owns the string, e.g. `loginForm.usernameLabel`, `tagPicker.createButton`. This keeps the catalog navigable without per-feature namespace files — namespacing is deferred until a flat file actually becomes hard to work with, consistent with how shared components/hooks in this codebase are only promoted out of their owning feature once a second real consumer appears.

```ts
// src/i18n/index.ts
i18next.use(initReactI18next).init({
  resources: { fr: { translation: fr } },
  lng: 'fr',
  fallbackLng: 'fr',
})
```

No backend or language-detector plugin is registered, so `init()` completes synchronously. This matters for the one non-component consumer pattern below.

## Reading translations outside a React component

Most call sites use the `useTranslation()` hook. Three validation modules (`emailValidation.ts`, `passwordValidation.ts`, `passwordIdentifierValidation.ts`) are plain functions with no component context, so they import the initialized `i18next` instance directly and call `i18n.t(...)` imperatively instead. This only works because `init()` is synchronous (see above) — if a backend or detector plugin is ever added, module-scope calls to `i18n.t(...)` would no longer be safe and would need to move inside a function body.

## Sharing keys across components

A key is reused across files only when the string plays the **same UI role** in both places — e.g. `common.genericError` (a generic "something went wrong, retry" fallback shown on two different pages), `tagPicker.close` (a dialog close button's aria-label, used by two different dialogs), or a form field's label reused between two forms that both collect the same field.

Keys are **not** shared just because today's French text happens to coincide across different roles (a page title, a nav link, and a button, for example) — that class of sharing caused a real bug during review: a form field's label ("Nouveau mot de passe") was briefly reused as the grammatical subject of a validation sentence ("Le nouveau mot de passe doit contenir...", which needs the article), producing broken grammar. Each UI role gets its own key even when the wording is identical today, since a future translation is free to phrase a title, a nav link, and a button differently even where French did not need to.

## Verifying nothing is left hardcoded

No lint rule enforces this yet (deferred — see below). The check is a grep for accented French characters (and the curly apostrophe `'`) across `src/`, excluding test files (which intentionally still assert against the French catalog values) and `src/api/schema.generated.ts` (generated from the backend OpenAPI spec, never hand-edited).

## What's deliberately out of scope

- **A second language, and the language switcher** — tracked in `activation-multilingue`. `localStorage` is the agreed persistence mechanism for the chosen language once it exists; not implemented yet since there is nothing to persist with only one language.
- **URL-based locale routing** (`/en/...`) — not needed while there's no SEO/shareable-link requirement for a per-language URL.
- **Date/number formatting beyond what `Intl` already provides** — `QuoteCard`/`QuoteDetailModal` still hardcode `Intl.DateTimeFormat('fr-FR', ...)`; revisited when a second language exists.
- **A dedicated ESLint rule** (e.g. `eslint-plugin-i18next`) to catch future hardcoded strings automatically — grep is enough for the app's current size.

## Manual verification

- Every page renders identically to before the extraction — no visible translation key, no `undefined`, no missing punctuation/article.
- Toast messages, `window.confirm` dialogs, and aria-labels all resolve to real text, not raw keys.
- The plural result count (`ResultList`) reads correctly for 0, 1, and N results.
