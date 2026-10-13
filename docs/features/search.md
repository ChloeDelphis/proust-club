# Search — Technical Design

How phrase search works in Proust Club: from user input to highlighted paragraph.

---

## The search unit: one paragraph, one row

The corpus is stored with one paragraph per database row. Blank lines in the source text mark paragraph boundaries; everything between two blank lines becomes a single `text` column value.

This makes the search result natural: a query returns a paragraph, which is already a coherent reading unit. There is no need to reassemble chunks or deal with cross-boundary matches.

---

## Why ILIKE and not full-text search

The core use case is *"I remember this phrase"* — the user pastes something they have read. This calls for **substring matching**, not relevance ranking.

PostgreSQL full-text search (`tsvector` / `tsquery`) tokenizes and stems the input. It is well-suited for keyword search across documents, but it does not guarantee that the exact phrase appears in the result, and it does not give back a character offset usable for highlighting.

ILIKE matches the literal string, case-insensitively, and returns the exact position. That is what we need.

```sql
WHERE text ILIKE '%petite madeleine%'
```

The tradeoff: ILIKE without an index scans every row. This is where `pg_trgm` comes in.

---

## pg_trgm: making ILIKE fast

A trigram is a sequence of three consecutive characters. `pg_trgm` decomposes each text value into its trigrams and stores them in a GIN index. When PostgreSQL evaluates an ILIKE pattern, it can intersect the trigrams of the search term against the index to quickly identify candidate rows, then apply the full ILIKE check only on those.

```sql
-- Flyway V3
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX paragraphs_text_trgm_idx ON paragraphs USING GIN (text gin_trgm_ops);
```

At 5 000 paragraphs the gain is modest. At 50 000 it becomes necessary. Adding the index from the start costs nothing and avoids a migration under load later.

---

## Computing offsets

The frontend needs to know exactly where in the paragraph text the match starts and ends, in order to split the string into three parts: before / match / after.

PostgreSQL's `strpos()` returns a **1-based** character position. We subtract 1 to get a **0-based** offset. For the current Proust corpus, whose text contains no supplementary Unicode characters, this position is usable by the Java and JavaScript string operations below. PostgreSQL character positions are not generally equivalent to Java/JavaScript UTF-16 indexes, so this assumption must be revisited if the corpus or supported text expands.

```sql
strpos(lower(p.text), lower('petite madeleine')) - 1  AS start_offset
```

`end_offset` is derived in the application layer:

```java
int endOffset = startOffset + query.length();
```

The calculation assumes case conversion preserves the match's character positions and length in the supported corpus. The implementation does not convert PostgreSQL character positions to UTF-16 indexes; corpus or search changes that break this assumption require updating the offset calculation as well.

One edge case handled explicitly: the characters `%`, `_`, and `\` have special meaning in SQL LIKE patterns. They are escaped before the query is built.

---

## Response shape

Each search hit includes everything the frontend needs to display the result in context:

| Field | Source | Purpose |
|---|---|---|
| `text` | `paragraphs.text` | Full paragraph for display |
| `startOffset` | `strpos()` − 1 | Start of highlight (0-based, inclusive) |
| `endOffset` | startOffset + query length | End of highlight (0-based, exclusive) |
| `volume` | `volumes.title` | Location breadcrumb |
| `part` | `parts.title` | Location breadcrumb |
| `pageNumber` | `paragraphs.page_number` | Position in the work |

Results are ordered by `paragraphs.position`, which reflects the reading order of the work.

Note: `paragraphs` holds both `part_id` and `volume_id` directly (denormalized). The JOIN to `volumes` goes straight from `paragraphs`, not through `parts`.

---

## Rate limiting

`GET /api/search` is rate-limited per client IP (60 requests/minute by default) — see [Rate limiting](rate-limiting.md).
