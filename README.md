# Proust Club

> _"Longtemps, je me suis couché de bonne heure."_

**Proust Club** is a full-stack application for searching, rediscovering and organizing passages from Marcel Proust's _In Search of Lost Time_.

The project combines literary exploration with modern software engineering, providing contextual search, personal annotations and tools for revisiting the work over time.

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
pnpm install
pnpm dev
```

---

## License

All rights reserved.

---

Created by **Chloé Delphis**.
