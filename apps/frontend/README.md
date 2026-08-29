# Frontend — Proust Club

React + Vite + TypeScript. Requires Node 24 LTS and pnpm 11.

## Prerequisites

The backend must be running on `localhost:8080` for API calls (the dev server proxies `/api` automatically).

## Commands

```bash
pnpm install        # install dependencies
pnpm dev            # development server (port 5173)
pnpm build          # TypeScript check + production build
pnpm preview        # serve the production build locally
pnpm lint           # ESLint
pnpm test           # tests in watch mode (Vitest)
pnpm test:run       # one-shot tests, no watch — CI command
pnpm generate:api   # regenerate src/api/schema.generated.ts and src/api/generated/validationConstraints.generated.ts from the backend OpenAPI spec
```

## Tests

Stack: Vitest + React Testing Library + jsdom.

```bash
pnpm test:run
```

Tests cover the full search flow: input, results, loading state, API error, empty state, form validation.
