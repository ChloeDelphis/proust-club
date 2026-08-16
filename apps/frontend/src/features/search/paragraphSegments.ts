export type TextSegment = { text: string; highlighted: boolean }

/**
 * Splits `text` into up to three runs around `highlightRange` (the search-match highlight):
 * before, the highlighted match, and after. Each run is rendered as its own DOM node (plain
 * `<span>` or `<mark>`), so a native text selection spanning the highlight naturally lands on
 * separate text nodes — exactly the DOM shape `selectionRangeOffset.ts` is built to walk through.
 */
export function buildHighlightSegments(text: string, highlightRange: { start: number; end: number }): TextSegment[] {
  const segments: TextSegment[] = []
  if (highlightRange.start > 0) {
    segments.push({ text: text.slice(0, highlightRange.start), highlighted: false })
  }
  if (highlightRange.end > highlightRange.start) {
    segments.push({ text: text.slice(highlightRange.start, highlightRange.end), highlighted: true })
  }
  if (highlightRange.end < text.length) {
    segments.push({ text: text.slice(highlightRange.end), highlighted: false })
  }
  return segments
}
