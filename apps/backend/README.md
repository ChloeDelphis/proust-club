# Backend — Proust Club

Spring Boot 4.1.0 (Java 21, jOOQ, PostgreSQL 16, Flyway). Requires a running PostgreSQL instance (see `docker-compose.yml` at the repo root).

## Commands

```bash
./gradlew bootRun                                      # start dev server (port 8080)
./gradlew build                                        # compile + test + build jar
./gradlew test                                         # run all tests
./gradlew test --tests "com.proustclub.SomeTest"       # run a single test class
./gradlew jooqCodegen                                  # apply Flyway migrations and regenerate jOOQ references
./gradlew importProust                                 # import the Proust corpus into the database (one-shot)
```

Code generation and compilation require PostgreSQL to be running. Start the local database from the repository root with `docker compose up -d postgres`. Generated sources live under `build/generated-src/jooq/main` and are recreated automatically before Java compilation. Set `JOOQ_DB_URL`, `JOOQ_DB_USERNAME`, and `JOOQ_DB_PASSWORD` to override the code generation connection; these are separate from the application's `DB_*` connection settings. The codegen migration task only accepts a loopback database URL.

## API

Swagger UI available at `http://localhost:8080/swagger-ui.html` when the server is running.

OpenAPI spec at `http://localhost:8080/v3/api-docs` (used by the frontend to generate TypeScript types).
