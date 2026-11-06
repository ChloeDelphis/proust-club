-- A tag's display color, as a position in a fixed palette rather than a stored literal color value —
-- the frontend can change the palette without touching any row. Existing tags default to slot 0.

ALTER TABLE tags ADD COLUMN color_index SMALLINT NOT NULL DEFAULT 0 CHECK (color_index BETWEEN 0 AND 9);
