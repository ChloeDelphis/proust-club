# Frontend — Proust Club

React + Vite + TypeScript. Requires Node 24 LTS and pnpm 11.

## Prerequisites

The backend must be running on `localhost:8080` for API calls (the dev server proxies `/api` automatically).

## Commands

```bash
pnpm safe:install   # install dependencies (runs the supply-chain check first — see below)
pnpm dev            # development server (port 5173)
pnpm build          # TypeScript check + production build
pnpm preview        # serve the production build locally
pnpm lint           # ESLint
pnpm test           # tests in watch mode (Vitest)
pnpm test:run       # one-shot tests, no watch
pnpm test:coverage  # one-shot tests with coverage — CI command
pnpm generate:api   # regenerate src/api/schema.generated.ts and src/api/generated/validationConstraints.generated.ts from the backend OpenAPI spec
```

### Adding or updating a dependency

A plain `pnpm add`/`update`/`install`/`remove` is blocked (`apps/frontend/.pnpmfile.mjs`) — use these instead, they run the OSV supply-chain check (`check:supply-chain`) before anything gets installed:

```bash
pnpm safe:add <package>      # add a dependency
pnpm safe:update [package]   # update one dependency, or all of them
pnpm safe:install            # plain install (e.g. after a fresh clone or pulling a branch)
pnpm safe:remove <package>   # remove a dependency
```

See `docs/features/supply-chain-check.md` for why.

## Tests

Stack: Vitest + React Testing Library + jsdom.

```bash
pnpm test:run       # quick local run
pnpm test:coverage  # what CI runs — also enforces the coverage threshold (see CLAUDE.md)
```

Tests cover the full search flow: input, results, loading state, API error, empty state, form validation.
