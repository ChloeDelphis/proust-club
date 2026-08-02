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

### Planned

- Personal annotations
- Personal tags
- Bookmarks
- Reading timeline
- Collections

---

## Getting Started

**1. Start the database**

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
