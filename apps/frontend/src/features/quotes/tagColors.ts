// Predefined palette a tag's color is chosen from — index-matched to the backend's
// Tag.colorIndex (0-9, see docs/features/quote-save-tags.md). The backend only stores and
// validates the index, never a color value, so this array is the single source of truth for what
// each slot actually looks like; changing a hex here never requires a migration.
//
// Values are the 10 list colors from the already-chosen visual direction (see
// docs/features/visual-design-system.md) — not yet reflected in tokens.css itself, since no
// component here consumes them as CSS custom properties yet.
export const TAG_COLORS: readonly string[] = [
  '#E78C6B',
  '#D5D0EF',
  '#BFDCCE',
  '#F0C24B',
  '#E8A7B7',
  '#A8C9E0',
  '#B280A0',
  '#A8CC8C',
  '#F3B88A',
  '#A89BD4',
]
