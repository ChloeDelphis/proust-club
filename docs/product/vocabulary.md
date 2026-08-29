# Vocabulary

Shared domain vocabulary for Proust Club.

These definitions are the canonical meanings of the terms used throughout the project, including the codebase, documentation and API.

---

### Volume

One of the seven books of _À la recherche du temps perdu_ (e.g. _Du côté de chez Swann_).

Database: `volumes`

---

### Part (_partie_)

A named section within a volume (e.g. _Combray_).

The work is divided into 25 parts.

Database: `parts`

---

### Paragraph (_paragraphe_)

The atomic reading unit of the corpus.

A paragraph is a block of text delimited by blank lines in the source text. Search results, annotations and quote selections are all anchored to paragraphs.

Database: `paragraphs`

---

### Position

The unique reading-order index of a paragraph across the entire work.

Positions are 1-based and preserve the original order of the novel, regardless of volume or part. They are used for navigation, search result ordering and timeline visualizations.

---

### Quote Selection (_citation_)

A portion of text selected by a reader within a paragraph and saved as a personal reference.

A quote selection is defined by:

- `paragraphId`
- `startOffset`
- `endOffset`
- `selectedText`
- an optional personal `comment`
- zero or more tags

Database: `quote_selections`

---

### Tag

A personal label attached to one or more quote selections.

Tags belong to a user and are never part of the original corpus. They allow readers to organize passages into meaningful collections and connect ideas across the work.

Database: `tags`
