import { deriveMarkerLabels, getWordBoundaries, snapToNearestBoundary, trimSelection } from './selectionOffsets'

describe('getWordBoundaries', () => {
  it('includes the start and end of the text', () => {
    expect(getWordBoundaries('hello')).toEqual([0, 5])
  })

  it('adds one boundary per word gap', () => {
    // "hello world" -> h(0)ello world(11)
    //                            ^6 = start of "world"
    expect(getWordBoundaries('hello world')).toEqual([0, 6, 11])
  })

  it('collapses a run of multiple spaces into a single boundary', () => {
    expect(getWordBoundaries('hello   world')).toEqual([0, 8, 13])
  })

  it('does not add an extra boundary for punctuation glued to a word', () => {
    expect(getWordBoundaries('Longtemps, je me suis couché.')).toEqual([0, 11, 14, 17, 22, 29])
  })
})

describe('snapToNearestBoundary', () => {
  const boundaries = [0, 6, 11]

  it('snaps to the closest boundary', () => {
    expect(snapToNearestBoundary(1, boundaries)).toBe(0)
    expect(snapToNearestBoundary(4, boundaries)).toBe(6)
    expect(snapToNearestBoundary(10, boundaries)).toBe(11)
  })

  it('snaps to the lower boundary on an exact tie', () => {
    expect(snapToNearestBoundary(3, boundaries)).toBe(0)
  })

  it('returns the boundary itself when the offset already matches one', () => {
    expect(snapToNearestBoundary(6, boundaries)).toBe(6)
  })
})

describe('deriveMarkerLabels', () => {
  it('keeps the order when the first offset is already the smaller one', () => {
    expect(deriveMarkerLabels(3, 8)).toEqual({ start: 3, end: 8 })
  })

  it('swaps the roles when the first offset is the larger one', () => {
    expect(deriveMarkerLabels(8, 3)).toEqual({ start: 3, end: 8 })
  })

  it('treats equal offsets as a zero-length range without erroring', () => {
    expect(deriveMarkerLabels(5, 5)).toEqual({ start: 5, end: 5 })
  })
})

describe('trimSelection', () => {
  const text = 'hello   world'

  it('leaves an already-trimmed range untouched', () => {
    expect(trimSelection(text, 0, 5)).toEqual({ start: 0, end: 5 })
  })

  it('trims leading whitespace', () => {
    expect(trimSelection(text, 5, 13)).toEqual({ start: 8, end: 13 })
  })

  it('trims trailing whitespace', () => {
    expect(trimSelection(text, 0, 8)).toEqual({ start: 0, end: 5 })
  })

  it('trims both sides at once', () => {
    expect(trimSelection(text, 5, 8)).toEqual({ start: 8, end: 8 })
  })

  it('never lets start cross past end on a whitespace-only range not aligned to a boundary', () => {
    expect(trimSelection(text, 5, 7)).toEqual({ start: 7, end: 7 })
  })
})
