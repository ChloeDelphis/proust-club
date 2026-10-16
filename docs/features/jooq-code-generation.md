# jOOQ code generation

## Purpose

The backend uses jOOQ's generated table and column references for queries against the PostgreSQL schema. A misspelled or removed schema column now fails Java compilation instead of being accepted as an unverified string until the query runs.

Flyway migrations remain the sole schema source of truth. The official jOOQ Gradle plugin reads the live PostgreSQL schema after Flyway has applied pending migrations. Generated Java sources are derived build output under `apps/backend/build/generated-src/jooq/main`; they are not checked into version control.

## Data flow

```text
Flyway migration files
        ↓
PostgreSQL (local Docker Compose database or CI PostgreSQL service)
        ↓
Flyway migration task → jOOQ code generation
        ↓
Generated table and column references → Java compilation → backend repositories
```

The `jooqCodegen` Gradle task first runs `migrateSchemaForCodegen`, a small Java entry point that invokes Flyway with the same migration directory as the application. jOOQ then inspects the `public` schema and generates only the table metadata needed by the backend. The `compileJava` task depends on code generation, so a normal build uses references generated from the current schema.

The project generates jOOQ table, column, and record classes but no POJOs, DAOs, or database routines. Repositories retain their existing query structure, transaction boundaries, internal read models, and API mappings. `TIMESTAMPTZ` fields are generated as `OffsetDateTime`; the repositories convert those values to `Instant` at their existing domain boundaries. PostgreSQL `SMALLINT` fields are generated as `Short` and converted to the existing integer read model where needed.

## Local development

From the repository root, start PostgreSQL:

```bash
docker compose up -d postgres
```

From `apps/backend`, generate the references explicitly:

```bash
./gradlew jooqCodegen
```

The task applies any pending Flyway migrations to the configured code generation database before generation. A regular `./gradlew build` also runs code generation before Java compilation. Set `JOOQ_DB_URL`, `JOOQ_DB_USERNAME`, and `JOOQ_DB_PASSWORD` to use a different local database; they default to the local Docker Compose settings and are separate from the application's `DB_*` settings. The migration helper rejects non-loopback hosts so a build cannot accidentally migrate a remote database.

Do not edit files under `build/generated-src/jooq/main`; update the Flyway migration and regenerate instead. Database credentials supplied through environment variables are used only for the local code generation connection and are not written into generated sources.

## CI

The backend CI job provides a PostgreSQL service with the same development-only credentials. The Gradle build applies Flyway migrations and generates references before compilation and the existing backend test suite.

## Manual verification

- Start PostgreSQL and run `./gradlew jooqCodegen` from `apps/backend`; confirm Flyway reports the schema current and jOOQ completes generation.
- Run `./gradlew build` and confirm the generated code is available before compilation.
- When a schema column is renamed or removed in a migration, regenerate and confirm stale repository references fail compilation until updated.
- Review `DSL.field(String...)` / `DSL.table(String)` usages in production backend Java sources; static schema references should use generated objects. Test fixtures still use string-based DSL helpers and are outside this migration.
