-- Recherche sous-chaîne (ILIKE) rapide sur le corpus
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX paragraphs_text_trgm_idx ON paragraphs USING GIN (text gin_trgm_ops);
