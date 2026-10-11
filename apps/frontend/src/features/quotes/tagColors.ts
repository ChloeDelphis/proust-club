// Predefined palette a tag's color is chosen from — index-matched to the backend's
// Tag.colorIndex (0-9, see docs/features/quote-save-tags.md). The backend only stores and
// validates the index, never a color value, so this array is the single source of truth for what
// each slot actually looks like; changing a hex here never requires a migration.
//
// Values are the 10-color list palette chosen alongside this project's "Club joyeux" visual
// direction — a separate, parallel piece of work is applying that direction's main palette and
// typography to tokens.css/docs/features/visual-design-system.md, which doesn't cover these list
// colors yet. This file is the first place they're written down as literal hex values.
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
