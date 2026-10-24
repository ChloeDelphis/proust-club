const TARGET_EXCERPT_LENGTH = 200
const SENTENCE_BOUNDARY_WINDOW = 36
const SENTENCE_END = /[.!?…;:]["'’”»)]*\s+/g
const SENTENCE_END_AFTER = /[.!?…;:]["'’”»)]*(?=\s)/

export type SearchExcerpt = {
  start: number
  end: number
  hasLeadingEllipsis: boolean
  hasTrailingEllipsis: boolean
}

function previousSentenceStart(text: string, index: number): number | null {
  const windowStart = Math.max(0, index - SENTENCE_BOUNDARY_WINDOW)
  const matches = [...text.slice(windowStart, index).matchAll(SENTENCE_END)]
  const lastMatch = matches.at(-1)
  return lastMatch?.index === undefined ? null : windowStart + lastMatch.index + lastMatch[0].length
}

function nextSentenceEnd(text: string, index: number): number | null {
  const match = SENTENCE_END_AFTER.exec(text.slice(index, index + SENTENCE_BOUNDARY_WINDOW))
  return match ? index + match.index + match[0].length : null
}

function moveToWordStart(text: string, index: number): number {
  let boundary = index
  while (boundary < text.length && /\s/.test(text[boundary])) boundary += 1
  while (boundary > 0 && !/\s/.test(text[boundary - 1])) boundary -= 1
  return boundary
}

function moveToWordEnd(text: string, index: number): number {
  let boundary = index
  while (boundary < text.length && !/\s/.test(text[boundary])) boundary += 1
  return boundary
}

export function createSearchExcerpt(
  text: string,
  matchRange: { start: number; end: number },
): SearchExcerpt {
  const matchStart = Math.max(0, Math.min(text.length, matchRange.start))
  const matchEnd = Math.max(matchStart, Math.min(text.length, matchRange.end))

  if (text.length <= TARGET_EXCERPT_LENGTH) {
    return { start: 0, end: text.length, hasLeadingEllipsis: false, hasTrailingEllipsis: false }
  }

  const matchLength = matchEnd - matchStart
  const excerptLength = Math.max(TARGET_EXCERPT_LENGTH, matchLength)
  const contextLength = excerptLength - matchLength
  let desiredStart = matchStart - Math.floor(contextLength / 2)
  let desiredEnd = matchEnd + Math.ceil(contextLength / 2)

  if (desiredStart < 0) {
    desiredEnd = Math.min(text.length, desiredEnd - desiredStart)
    desiredStart = 0
  }
  if (desiredEnd > text.length) {
    desiredStart = Math.max(0, desiredStart - (desiredEnd - text.length))
    desiredEnd = text.length
  }

  let start = moveToWordStart(text, desiredStart)
  const sentenceStart = previousSentenceStart(text, desiredStart)
  if (sentenceStart !== null && desiredStart - sentenceStart <= SENTENCE_BOUNDARY_WINDOW) {
    start = sentenceStart
  }
  start = Math.min(start, matchStart)

  let end = moveToWordEnd(text, desiredEnd)
  const sentenceEnd = nextSentenceEnd(text, desiredEnd)
  if (sentenceEnd !== null && sentenceEnd - desiredEnd <= SENTENCE_BOUNDARY_WINDOW) {
    end = sentenceEnd
  }
  end = Math.max(end, matchEnd)

  return {
    start,
    end,
    hasLeadingEllipsis: start > 0,
    hasTrailingEllipsis: end < text.length,
  }
}
