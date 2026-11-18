export interface TagPickerContentProps {
  /** "Enregistrer" clicked — save with these tag names (possibly none). */
  onSave: (tagNames: string[], newTagName?: string) => void
  /** Return to the selected passage without saving it. */
  onCancel: () => void
  /** The save request triggered by a previous "Enregistrer" click is still in flight. */
  isSaving: boolean
  initialNewListName?: string
  errorMessage?: string | null
}
