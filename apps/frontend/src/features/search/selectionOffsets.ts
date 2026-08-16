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

/**
 * Extends a raw `[start, end)` range outward to the nearest word boundaries — never inward, so a
 * word the user visibly selected is never cut off. `boundaries` always includes 0 and the text's
 * full length (see `getWordBoundaries`), so this never runs off either end.
 */
export function snapSelectionOutward(start: number, end: number, boundaries: number[]): { start: number; end: number } {
  let snappedStart = boundaries[0]
  for (const boundary of boundaries) {
    if (boundary > start) break
    snappedStart = boundary
  }

  let snappedEnd = boundaries[boundaries.length - 1]
  for (let i = boundaries.length - 1; i >= 0; i--) {
    if (boundaries[i] < end) break
    snappedEnd = boundaries[i]
  }

  return { start: snappedStart, end: snappedEnd }
}

/** Excludes leading/trailing whitespace from a [start, end) range without changing what it points at. */
export function trimSelection(text: string, start: number, end: number): { start: number; end: number } {
  let trimmedStart = start
  let trimmedEnd = end
  while (trimmedStart < trimmedEnd && isSpace(text[trimmedStart])) trimmedStart++
  while (trimmedEnd > trimmedStart && isSpace(text[trimmedEnd - 1])) trimmedEnd--
  return { start: trimmedStart, end: trimmedEnd }
}
