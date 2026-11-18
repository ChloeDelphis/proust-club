export interface SelectionSegment {
  text: string
  highlighted: boolean
  selected: boolean
}

/**
 * Splits a paragraph wherever either the search match or the user's saved selection begins or
 * ends, so both visual states can be rendered independently and can overlap safely.
 */
export function buildSelectionSegments(
  text: string,
  highlightRange: { start: number; end: number },
  selectionRange: { start: number; end: number } | null,
): SelectionSegment[] {
  const boundaries = new Set([0, text.length, highlightRange.start, highlightRange.end])
  if (selectionRange) {
    boundaries.add(selectionRange.start)
    boundaries.add(selectionRange.end)
  }

  const points = [...boundaries].filter(point => point >= 0 && point <= text.length).sort((a, b) => a - b)
  const segments: SelectionSegment[] = []

  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index]
    const end = points[index + 1]
    if (start === end) continue
    segments.push({
      text: text.slice(start, end),
      highlighted: start >= highlightRange.start && end <= highlightRange.end,
      selected: selectionRange !== null && start >= selectionRange.start && end <= selectionRange.end,
    })
  }

  return segments
}
