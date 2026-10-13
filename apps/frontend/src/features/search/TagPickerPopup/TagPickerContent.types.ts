export interface TagPickerContentProps {
  /** "Enregistrer" clicked — save with these tag names (possibly none). */
  onSave: (tagNames: string[]) => void
  /** The save request triggered by a previous "Enregistrer" click is still in flight. */
  isSaving: boolean
}
