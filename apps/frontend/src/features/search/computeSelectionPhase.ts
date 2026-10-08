import { snapSelectionOutward, trimSelection } from './selectionOffsets'
import { getSelectionOffsets } from './selectionRangeOffset'
import type { Phase } from './QuoteSelection/QuoteSelection.types'

/**
 * A single functional update, so the tag panel (once open) is never yanked away by a
 * selectionchange firing while it's up — the original text selection is deliberately left
 * intact behind it (see QuoteSelection's "Sauvegarder" button onMouseDown), so it can still
 * report a live, non-collapsed selection at that point.
 */
export function computeSelectionPhase(
  current: Phase,
  container: HTMLElement | null,
  selection: Selection | null,
  text: string,
): Phase {
  if (current.kind === 'tagPanel') return current
  const toIdle: Phase = current.kind === 'selected' ? { kind: 'idle' } : current

  if (!container || !selection || selection.isCollapsed || selection.rangeCount === 0) return toIdle

  const offsets = getSelectionOffsets(container, selection.getRangeAt(0))
  if (!offsets) return toIdle

  const extended = snapSelectionOutward(text, offsets.start, offsets.end)
  const trimmed = trimSelection(text, extended.start, extended.end)
  if (trimmed.start >= trimmed.end) return toIdle

  return { kind: 'selected', start: trimmed.start, end: trimmed.end }
}
