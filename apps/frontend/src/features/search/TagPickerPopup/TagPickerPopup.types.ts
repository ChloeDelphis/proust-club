export interface TagPickerPopupProps {
  /** "Terminer" clicked — save the quote with these tag names. */
  onFinish: (tagNames: string[]) => void
  /** Closed via the × or a click outside — the caller saves the quote without any tag. */
  onDismiss: () => void
}
