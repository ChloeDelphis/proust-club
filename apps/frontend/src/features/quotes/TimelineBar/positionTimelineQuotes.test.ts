import { describe, expect, it } from 'vitest'
import { positionTimelineQuotes } from './positionTimelineQuotes'
import type { TimelineQuote } from '../../../api/quote'

function quote(id: number, pageNumber: number): TimelineQuote {
  return { id, paragraphId: id, pageNumber, volumeId: 1, selectedText: `quote ${id}`, tags: [], createdAt: '2026-08-07T00:00:00Z' }
}

describe('positionTimelineQuotes', () => {
  it('places a quote at the start of the range at offset 0', () => {
    const groups = positionTimelineQuotes([quote(1, 1)], { minPage: 1, maxPage: 486 })
    expect(groups[0].offsetPercent).toBe(0)
  })

  it('places a quote at the end of the range at offset 100', () => {
    const groups = positionTimelineQuotes([quote(1, 486)], { minPage: 1, maxPage: 486 })
    expect(groups[0].offsetPercent).toBe(100)
  })

  it('clamps a page outside the given range instead of overflowing', () => {
    const groups = positionTimelineQuotes([quote(1, 500)], { minPage: 104, maxPage: 183 })
    expect(groups[0].offsetPercent).toBe(100)
  })

  it('sorts quotes by page regardless of input order', () => {
    const groups = positionTimelineQuotes([quote(2, 300), quote(1, 50)], { minPage: 1, maxPage: 486 })
    expect(groups.map((g) => g.quotes[0].id)).toEqual([1, 2])
  })

  it('keeps every quote in its own group (no merging in v1)', () => {
    const groups = positionTimelineQuotes([quote(1, 50), quote(2, 50)], { minPage: 1, maxPage: 486 })
    expect(groups).toHaveLength(2)
  })

  it('marks close quotes as extended, alternating so consecutive close bars differ', () => {
    const groups = positionTimelineQuotes(
      [quote(1, 100), quote(2, 101), quote(3, 102)],
      { minPage: 1, maxPage: 486 },
      5,
    )
    expect(groups[0].isExtended).toBe(false)
    expect(groups[1].isExtended).toBe(true)
    expect(groups[2].isExtended).toBe(false)
  })

  it('does not mark far-apart quotes as extended', () => {
    const groups = positionTimelineQuotes([quote(1, 10), quote(2, 400)], { minPage: 1, maxPage: 486 })
    expect(groups[0].isExtended).toBe(false)
    expect(groups[1].isExtended).toBe(false)
  })

  it('returns an empty list for no quotes', () => {
    expect(positionTimelineQuotes([], { minPage: 1, maxPage: 486 })).toEqual([])
  })

  it('does not divide by zero for a single-page range', () => {
    const groups = positionTimelineQuotes([quote(1, 5)], { minPage: 5, maxPage: 5 })
    expect(groups[0].offsetPercent).toBe(0)
  })
})
