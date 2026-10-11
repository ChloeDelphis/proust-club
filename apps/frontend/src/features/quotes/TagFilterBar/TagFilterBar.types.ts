export interface TagFilterBarProps {
  scope: 'corpus' | 'saved'
  activeTagId: string | null
  // All three setters are idempotent (no internal toggle logic) — TagFilterBar itself decides
  // when a click should toggle back to corpus scope (clicking the already-active entry again).
  onSelectSavedScope: () => void
  onSelectTag: (tagId: string) => void
  onSelectCorpusScope: () => void
}
