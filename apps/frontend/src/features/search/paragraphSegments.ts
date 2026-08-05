export type TextSegment = { type: 'text'; text: string; highlighted: boolean }
export type MarkerSegment = { type: 'marker'; role: 'start' | 'end' }
export type ParagraphSegment = TextSegment | MarkerSegment

export type SelectionMarkers = { start: number | null; end: number | null }

/**
 * Interleaves the paragraph's search-match highlight with the "début"/"fin" selection markers
 * (if placed), producing a left-to-right sequence of text runs and marker points to render.
 * Cut points always include the highlight boundaries, so a text run is either fully highlighted
 * or fully plain, never partially overlapping.
 */
export function buildParagraphSegments(
  text: string,
  highlightRange: { start: number; end: number },
  markers: SelectionMarkers,
): ParagraphSegment[] {
  const cutPoints = new Set<number>([0, text.length, highlightRange.start, highlightRange.end])
  if (markers.start !== null) cutPoints.add(markers.start)
  if (markers.end !== null) cutPoints.add(markers.end)
  const sorted = Array.from(cutPoints).sort((a, b) => a - b)

  const segments: ParagraphSegment[] = []
  for (let i = 0; i < sorted.length; i++) {
    const offset = sorted[i]
    if (offset === markers.start) segments.push({ type: 'marker', role: 'start' })
    if (offset === markers.end) segments.push({ type: 'marker', role: 'end' })

    const next = sorted[i + 1]
    if (next !== undefined && next > offset) {
      segments.push({
        type: 'text',
        text: text.slice(offset, next),
        highlighted: offset >= highlightRange.start && next <= highlightRange.end,
      })
    }
  }
  return segments
}
