-- Personal quote selections and tags

CREATE TABLE tags (
    id         SERIAL       PRIMARY KEY,
    user_id    UUID         NOT NULL REFERENCES users(uuid),
    name       VARCHAR(50)  NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CHECK (name = BTRIM(name) AND name <> '')
);

-- Case-insensitive uniqueness per user; the stored/displayed name keeps the user's
-- original casing, only this comparison ignores it. Safe to compare on name directly
-- (not BTRIM(name)) because the CHECK above already guarantees name is trimmed.
CREATE UNIQUE INDEX tags_user_id_lower_name_idx ON tags(user_id, LOWER(name));

CREATE TABLE quote_selections (
    id            SERIAL       PRIMARY KEY,
    user_id       UUID         NOT NULL REFERENCES users(uuid),
    paragraph_id  INTEGER      NOT NULL REFERENCES paragraphs(id),
    start_offset  INTEGER      NOT NULL,
    end_offset    INTEGER      NOT NULL,
    selected_text TEXT         NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CHECK (start_offset >= 0 AND end_offset > start_offset)
);

CREATE INDEX quote_selections_user_id_idx      ON quote_selections(user_id);
CREATE INDEX quote_selections_paragraph_id_idx ON quote_selections(paragraph_id);

CREATE TABLE quote_selection_tags (
    quote_selection_id INTEGER NOT NULL REFERENCES quote_selections(id) ON DELETE CASCADE,
    tag_id              INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,

    PRIMARY KEY (quote_selection_id, tag_id)
);

-- The PK (quote_selection_id, tag_id) serves the quote -> tags direction well, but not
-- tag -> quotes, which is exactly what GET /api/quotes?tagId=... needs.
CREATE INDEX quote_selection_tags_tag_id_idx ON quote_selection_tags(tag_id);
