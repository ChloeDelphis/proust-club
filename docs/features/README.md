# Features

Technical design of each feature — how it works, the decisions behind it, and the data it operates on.

## Index

- [Data model](data-model.md) — corpus hierarchy, user data, key decisions
- [Search](search.md) — phrase search: ILIKE, pg_trgm, offset computation
- [Search — Frontend](search-frontend.md) — search UI, highlighting, pagination
- [Auth](auth.md) — session-based login, CSRF, no user enumeration
- [Rate limiting](rate-limiting.md) — Bucket4j token buckets on login, register, search
