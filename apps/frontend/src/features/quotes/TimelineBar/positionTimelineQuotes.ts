import type { TimelineQuote } from '../../../api/quote'

export type PageRange = { minPage: number; maxPage: number }

// A group always holds exactly one quote today — every consumer of this shape (TimelineBar,
// QuoteHoverPreview, QuoteDetailModal) still reads `quotes[0]` and stays single-quote-only.
// The array is a deliberately cheap hook for later, not a finished contract: a future
// clustering pass can start merging entries here without changing this function's signature,
// but the rendering layer would still need
// real work (plural aria-labels, a multi-quote preview/modal) — this shape saves that one
// rewrite, not the whole feature.
export interface TimelineGroup {
  quotes: TimelineQuote[]
  offsetPercent: number
  isExtended: boolean
}

const DEFAULT_OVERLAP_THRESHOLD_PERCENT = 1.5
const SAME_PAGE_BOOKMARK_SPACING_PERCENT = 1.6

// Shared by bookmark positioning and volume delimiter placement — both are "where does this
// page fall between minPage and maxPage" in the end.
export function pageToPercent(page: number, pageRange: PageRange): number {
  const span = pageRange.maxPage - pageRange.minPage || 1
  return Math.min(100, Math.max(0, ((page - pageRange.minPage) / span) * 100))
}

// Pure by design: no DOM measurement (no getBoundingClientRect/ResizeObserver anywhere in
// this codebase yet) — the component converts offsetPercent to a CSS `left` percentage,
// this function never needs to know the container's actual pixel width.
export function positionTimelineQuotes(
  quotes: TimelineQuote[],
  pageRange: PageRange,
  overlapThresholdPercent = DEFAULT_OVERLAP_THRESHOLD_PERCENT,
): TimelineGroup[] {
  const sorted = [...quotes].sort((a, b) => a.pageNumber - b.pageNumber)

  const groups: TimelineGroup[] = sorted.map((quote) => ({
    quotes: [quote],
    offsetPercent: pageToPercent(quote.pageNumber, pageRange),
    isExtended: false,
  }))

  // A group stays one quote wide, but quotes on the same page need distinct hit targets. Spread
  // them around their true page position; at either edge, shift the whole run inward to avoid
  // clamping multiple bookmarks onto the same x coordinate.
  for (let start = 0; start < groups.length;) {
    let end = start + 1
    while (end < groups.length && groups[end].quotes[0].pageNumber === groups[start].quotes[0].pageNumber) end++

    const count = end - start
    if (count > 1) {
      const span = (count - 1) * SAME_PAGE_BOOKMARK_SPACING_PERCENT
      const center = groups[start].offsetPercent
      const firstOffset = Math.min(Math.max(center - span / 2, 0), 100 - span)
      for (let index = start; index < end; index++) {
        groups[index].offsetPercent = firstOffset + (index - start) * SAME_PAGE_BOOKMARK_SPACING_PERCENT
      }
    }
    start = end
  }

  for (let i = 1; i < groups.length; i++) {
    const distance = groups[i].offsetPercent - groups[i - 1].offsetPercent
    if (distance < overlapThresholdPercent) {
      groups[i].isExtended = !groups[i - 1].isExtended
    }
  }

  return groups
}
