export interface TagPickerPopupProps {
  /** "Enregistrer" clicked — save the quote with these tag names (possibly none). */
  onSave: (tagNames: string[]) => void
  /** Closed via the ×, a click outside, or Escape — cancel entirely, nothing is saved. */
  onCancel: () => void
}
