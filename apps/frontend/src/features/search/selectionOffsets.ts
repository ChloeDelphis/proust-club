function isSpace(char: string): boolean {
  return /\s/.test(char)
}

/**
 * Extends a raw `[start, end)` range outward to the edges of the words it touches — never
 * inward, so a word the user visibly selected is never cut off. A side is only extended when the
 * raw offset actually sits inside a word (the character right at that edge is non-whitespace);
 * an offset that already sits on whitespace — including a selection confined entirely to a gap
 * between two words — is left untouched on that side, since there's no word there to extend to.
 * This is a plain character scan rather than a snap against a precomputed boundary list: a coarse
 * "nearest word-start" lookup can't distinguish "inside a word" from "in the gap right after it",
 * and would otherwise reach backward across an entire untouched word from a gap position.
 */
export function snapSelectionOutward(text: string, start: number, end: number): { start: number; end: number } {
  let snappedStart = start
  if (start < text.length && !isSpace(text[start])) {
    while (snappedStart > 0 && !isSpace(text[snappedStart - 1])) snappedStart--
  }

  let snappedEnd = end
  if (end > 0 && !isSpace(text[end - 1])) {
    while (snappedEnd < text.length && !isSpace(text[snappedEnd])) snappedEnd++
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
