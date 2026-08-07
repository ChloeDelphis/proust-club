-- Populated by the corpus importer once paragraphs exist (volumes are seeded before any
-- paragraph in V2, so these bounds cannot be known at seed time). Used by the personal
-- timeline to position bookmarks and draw volume delimiters without recomputing an
-- aggregate on every request.
ALTER TABLE volumes
    ADD COLUMN min_page INTEGER NULL,
    ADD COLUMN max_page INTEGER NULL;
