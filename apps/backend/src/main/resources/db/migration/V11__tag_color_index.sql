-- Palette slot used to render each tag's display color.

ALTER TABLE tags ADD COLUMN color_index SMALLINT NOT NULL DEFAULT 0 CHECK (color_index BETWEEN 0 AND 9);
