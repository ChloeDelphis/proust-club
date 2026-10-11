-- A tag's display color, as a position in a fixed, predefined palette (see
-- docs/features/visual-design-system.md) rather than a stored literal color value — the palette
-- itself can change without touching any row. Existing tags default to palette slot 0.

ALTER TABLE tags ADD COLUMN color_index SMALLINT NOT NULL DEFAULT 0 CHECK (color_index BETWEEN 0 AND 9);
