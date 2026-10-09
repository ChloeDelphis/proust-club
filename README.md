# Proust Club

> _« Longtemps, je me suis couché de bonne heure. »_

Have you ever wished you could collect your favorite passages from Marcel Proust's _In Search of Lost Time_, without writing in the margins or filling your books with dog-eared pages?

**Proust Club** lets you find and save the passages you love, add your own notes and tags, and return to them whenever you like.

Explore the original French text, rediscover passages in context, and build your own personal collection of quotes.

🚧 Work in progress.

---

## Features

### Current

- Search passages by text
- Read passages in context
- Highlight matching fragments
- Create an account and sign in (email confirmation, password reset)
- Save personal quotes with an optional comment and tags
- Browse, filter and manage your saved quotes
- Personal reading timeline (bookmarks positioned by volume and page)

### Planned

- Community features (sharing, discovery)

---

## Getting Started

**1. Start PostgreSQL and Mailhog**

```bash
docker compose up -d
```

**2. Import the corpus** _(first time only)_

```bash
cd apps/backend
./gradlew importProust
```

**3. Start the backend**

```bash
cd apps/backend
./gradlew bootRun
```

**4. Start the frontend**

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
