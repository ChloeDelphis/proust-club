-- Corpus : structure hiérarchique du texte de Proust
-- volumes → parts → paragraphs

CREATE TABLE volumes (
    id       INTEGER      PRIMARY KEY,
    title    VARCHAR(255) NOT NULL,
    position INTEGER      NOT NULL UNIQUE
);

CREATE TABLE parts (
    id         INTEGER      PRIMARY KEY,
    volume_id  INTEGER      NOT NULL REFERENCES volumes(id),
    title      VARCHAR(255) NOT NULL,
    position   INTEGER      NOT NULL,
    start_page INTEGER      NOT NULL,

    UNIQUE (volume_id, position)
);

CREATE INDEX parts_start_page_idx ON parts(start_page);

CREATE TABLE paragraphs (
    id          SERIAL       PRIMARY KEY,
    volume_id   INTEGER      NOT NULL REFERENCES volumes(id),
    part_id     INTEGER      NOT NULL REFERENCES parts(id),
    position    INTEGER      NOT NULL UNIQUE,
    page_number INTEGER      NOT NULL,
    text        TEXT         NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX paragraphs_page_number_idx ON paragraphs(page_number);
CREATE INDEX paragraphs_part_id_idx     ON paragraphs(part_id);
