# Proust Club

> _« Longtemps, je me suis couché de bonne heure. »_

Have you ever wished you could collect your favorite passages from Marcel Proust's _In Search of Lost Time_, without writing in the margins or filling your books with dog-eared pages?

**Proust Club** lets you find and save the passages you love, add your own notes and tags, and return to them whenever you like.

🚧 Work in progress.

---

## Features

### Available

- **Find passages** — Search the original French text of _In Search of Lost Time_, with matching fragments highlighted and passages displayed in context.
- **Build your collection** — Save your favorite quotes, add personal comments and tags, and browse, filter and manage your collection.
- **Track your reading** — Keep bookmarks organized by volume and page.
- **Manage your account** — Sign up, confirm your email address, sign in and reset your password.

### Planned

- **Community features** — Share and discover passages with other readers.

---

## Tech Stack

- **Backend** — Java, Spring Boot, jOOQ, Flyway, PostgreSQL
- **Frontend** — React, TypeScript, Vite
- **Dev environment** — Docker Compose (PostgreSQL, Mailhog)

---

## Getting Started

### Prerequisites

- Java 21 (the Gradle Wrapper is included, no separate Gradle install needed)
- Node.js 24 and pnpm 11
- Docker (for PostgreSQL and Mailhog)

Run the commands below from the repository root. Use separate terminals for the backend and frontend.

**1. Start PostgreSQL and Mailhog**

```bash
docker compose up -d
```

**2. Start the backend**

```bash
cd apps/backend
./gradlew importProust  # first time only, to import the corpus
./gradlew bootRun
```

**3. Start the frontend**

```bash
cd apps/frontend
pnpm safe:install
pnpm dev
```

---

## License

All rights reserved.

---

Created by **Chloé Delphis**.
