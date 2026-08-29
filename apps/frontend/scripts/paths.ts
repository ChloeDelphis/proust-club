// Shared between fetch-openapi-snapshot.ts (writes it) and generate-validation-constraints.ts
// (reads it) — a single source of truth for the filename, since the two scripts run as separate
// Node processes chained in package.json's generate:api and can't share an in-memory constant.
export const SNAPSHOT_PATH = new URL('../.openapi-snapshot.json', import.meta.url)
