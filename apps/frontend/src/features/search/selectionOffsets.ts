function isSpace(char: string): boolean {
  return /\s/.test(char)
}

/**
 * Valid marker positions within `text`: start of text, end of text, and the start of every
 * word that follows a run of whitespace. A single boundary per gap (not one on each side of
 * the whitespace run) — trimming leading/trailing whitespace off the final selection is handled
 * separately by `trimSelection`, so the exact boundary chosen within a gap doesn't matter here.
 */
export function getWordBoundaries(text: string): number[] {
  const boundaries = [0]
  for (let i = 1; i < text.length; i++) {
    if (isSpace(text[i - 1]) && !isSpace(text[i])) {
      boundaries.push(i)
    }
  }
  boundaries.push(text.length)
  return boundaries
}

export function snapToNearestBoundary(rawOffset: number, boundaries: number[]): number {
  return boundaries.reduce((closest, boundary) =>
    Math.abs(boundary - rawOffset) < Math.abs(closest - rawOffset) ? boundary : closest
  )
}

/**
 * Marker roles are never stored, only derived from the numeric order of the two placed offsets —
 * dragging a marker past the other one "swaps" start/end for free, with no explicit swap logic.
 */
export function deriveMarkerLabels(a: number, b: number): { start: number; end: number } {
  return a <= b ? { start: a, end: b } : { start: b, end: a }
}

/** Excludes leading/trailing whitespace from a [start, end) range without changing what it points at. */
export function trimSelection(text: string, start: number, end: number): { start: number; end: number } {
  let trimmedStart = start
  let trimmedEnd = end
  while (trimmedStart < trimmedEnd && isSpace(text[trimmedStart])) trimmedStart++
  while (trimmedEnd > trimmedStart && isSpace(text[trimmedEnd - 1])) trimmedEnd--
  return { start: trimmedStart, end: trimmedEnd }
}
