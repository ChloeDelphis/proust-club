# PostgreSQL domain schemas

V17 organizes the 14 application tables into the four schemas listed in [Data Model](../architecture/data-model.md#postgresql-schemas). It moves existing tables in place, preserving their data, indexes, constraints, owned sequences and cross-schema foreign keys.

`flyway_schema_history` and `pg_trgm` remain in `public`. Spring Security uses in-memory HTTP sessions; no Spring Session tables exist. jOOQ generates references from all four schemas and renders schema-qualified names, so runtime queries do not depend on `search_path`.

Flyway uses `DB_MIGRATION_USERNAME` / `DB_MIGRATION_PASSWORD` when set, otherwise the runtime `DB_USERNAME` / `DB_PASSWORD`. A separate migration role must own (or assume the owner of) the Flyway objects and have `CREATE` on target schemas. The runtime role needs explicit schema `USAGE`, table DML and sequence privileges. These grants are not created by the migration. `USER` / `ADMIN` authorization remains enforced by Spring Security and application logic, independently of PostgreSQL roles.

## Manual verification

- Run `./gradlew build` against PostgreSQL; Flyway must apply V17 and the integration tests must pass without resetting a database.
- Confirm all 14 application tables are in the listed schemas, and that Flyway history and `pg_trgm` remain in `public`.
- Confirm a separate migration role can apply DDL and the runtime role has only its explicitly granted schema, table and sequence privileges.
