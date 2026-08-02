# Backend — Proust Club

Spring Boot 4.1.0 (Java 21, jOOQ, PostgreSQL 16, Flyway). Requires a running PostgreSQL instance (see `docker-compose.yml` at the repo root).

## Commands

```bash
./gradlew bootRun                                      # start dev server (port 8080)
./gradlew build                                        # compile + test + build jar
./gradlew test                                         # run all tests
./gradlew test --tests "com.proustclub.SomeTest"       # run a single test class
./gradlew importProust                                 # import the Proust corpus into the database (one-shot)
```

## API

Swagger UI available at `http://localhost:8080/swagger-ui.html` when the server is running.

OpenAPI spec at `http://localhost:8080/v3/api-docs` (used by the frontend to generate TypeScript types).
