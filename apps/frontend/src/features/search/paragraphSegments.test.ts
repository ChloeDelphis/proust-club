import { buildHighlightSegments } from './paragraphSegments'

const text = 'abcdefghij'

describe('buildHighlightSegments', () => {
  it('splits into before/highlighted/after when the match is in the middle', () => {
    expect(buildHighlightSegments(text, { start: 3, end: 6 })).toEqual([
      { text: 'abc', highlighted: false },
      { text: 'def', highlighted: true },
      { text: 'ghij', highlighted: false },
    ])
  })

  it('omits the "before" run when the match starts at the beginning', () => {
    expect(buildHighlightSegments(text, { start: 0, end: 4 })).toEqual([
      { text: 'abcd', highlighted: true },
      { text: 'efghij', highlighted: false },
    ])
  })

  it('omits the "after" run when the match ends at the end', () => {
    expect(buildHighlightSegments(text, { start: 6, end: 10 })).toEqual([
      { text: 'abcdef', highlighted: false },
      { text: 'ghij', highlighted: true },
    ])
  })

  it('returns a single highlighted run when the match covers the whole text', () => {
    expect(buildHighlightSegments(text, { start: 0, end: 10 })).toEqual([
      { text: 'abcdefghij', highlighted: true },
    ])
  })
})
