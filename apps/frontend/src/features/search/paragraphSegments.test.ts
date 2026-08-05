import { buildParagraphSegments } from './paragraphSegments'

const text = 'abcdefghij'
const highlight = { start: 3, end: 6 } // "def"

describe('buildParagraphSegments', () => {
  it('renders before/highlighted/after when no marker is placed', () => {
    expect(buildParagraphSegments(text, highlight, { start: null, end: null })).toEqual([
      { type: 'text', text: 'abc', highlighted: false },
      { type: 'text', text: 'def', highlighted: true },
      { type: 'text', text: 'ghij', highlighted: false },
    ])
  })

  it('interleaves both markers with the highlight when they fall outside it', () => {
    expect(buildParagraphSegments(text, highlight, { start: 1, end: 8 })).toEqual([
      { type: 'text', text: 'a', highlighted: false },
      { type: 'marker', role: 'start' },
      { type: 'text', text: 'bc', highlighted: false },
      { type: 'text', text: 'def', highlighted: true },
      { type: 'text', text: 'gh', highlighted: false },
      { type: 'marker', role: 'end' },
      { type: 'text', text: 'ij', highlighted: false },
    ])
  })

  it('places a marker exactly at a highlight boundary without duplicating the cut point', () => {
    expect(buildParagraphSegments(text, highlight, { start: 3, end: 6 })).toEqual([
      { type: 'text', text: 'abc', highlighted: false },
      { type: 'marker', role: 'start' },
      { type: 'text', text: 'def', highlighted: true },
      { type: 'marker', role: 'end' },
      { type: 'text', text: 'ghij', highlighted: false },
    ])
  })

  it('renders only the start marker when the end marker is not placed yet', () => {
    expect(buildParagraphSegments(text, highlight, { start: 2, end: null })).toEqual([
      { type: 'text', text: 'ab', highlighted: false },
      { type: 'marker', role: 'start' },
      { type: 'text', text: 'c', highlighted: false },
      { type: 'text', text: 'def', highlighted: true },
      { type: 'text', text: 'ghij', highlighted: false },
    ])
  })

  it('renders both markers adjacently, start before end, when they land on the same offset', () => {
    expect(buildParagraphSegments(text, highlight, { start: 4, end: 4 })).toEqual([
      { type: 'text', text: 'abc', highlighted: false },
      { type: 'text', text: 'd', highlighted: true },
      { type: 'marker', role: 'start' },
      { type: 'marker', role: 'end' },
      { type: 'text', text: 'ef', highlighted: true },
      { type: 'text', text: 'ghij', highlighted: false },
    ])
  })
})
