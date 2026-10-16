# Backend — Proust Club

Spring Boot 4.1.0 (Java 21, jOOQ, PostgreSQL 18, Flyway). Requires a running PostgreSQL instance (see `docker-compose.yml` at the repo root).

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

## Local database data and PostgreSQL 18

The local PostgreSQL 18 service uses the `pgdata-pg18` named volume mounted at `/var/lib/postgresql`, the data path used by the official PostgreSQL 18 image. PostgreSQL 16 used a different data directory and volume. Do not mount a PostgreSQL 16 data directory into PostgreSQL 18; major-version changes require a logical dump and restore or another supported upgrade method.

To preserve an existing local database during an upgrade, create a custom-format dump before replacing the PostgreSQL 16 container, keep that dump outside the repository, start PostgreSQL 18 on its separate volume, and restore into the initialized `proustclub` database:

```bash
docker compose exec -T postgres pg_dump -U proustclub -d proustclub -Fc -f /tmp/proustclub.dump
docker compose cp postgres:/tmp/proustclub.dump "$HOME/proustclub.dump"
docker compose stop postgres
# Update the compose service to PostgreSQL 18 and its separate pgdata-pg18 volume.
docker compose up -d postgres
docker compose cp "$HOME/proustclub.dump" postgres:/tmp/proustclub.dump
docker compose exec -T postgres pg_restore -U proustclub --no-owner --exit-on-error -d proustclub /tmp/proustclub.dump
```

Verify the restored data and the application before removing the old PostgreSQL 16 volume or the temporary dump. Delete the dump from `$HOME` only after verification. Do not use `docker compose down -v` as part of the upgrade. The corpus import command only imports the literary corpus; it does not restore user accounts, saved quotes, or tags.

## API

Swagger UI available at `http://localhost:8080/swagger-ui.html` when the server is running.

OpenAPI spec at `http://localhost:8080/v3/api-docs` (used by the frontend to generate TypeScript types).
