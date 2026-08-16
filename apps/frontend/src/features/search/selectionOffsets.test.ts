import { getWordBoundaries, snapSelectionOutward, trimSelection } from './selectionOffsets'

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

describe('snapSelectionOutward', () => {
  // "hello world today" -> boundaries at 0, 6, 12, 18
  const boundaries = [0, 6, 12, 18]

  it('leaves a range already aligned to boundaries untouched', () => {
    expect(snapSelectionOutward(6, 12, boundaries)).toEqual({ start: 6, end: 12 })
  })

  it('extends both ends outward when they land inside a word', () => {
    // "hel|lo wor|ld today" -> extends to "hello world"
    expect(snapSelectionOutward(3, 9, boundaries)).toEqual({ start: 0, end: 12 })
  })

  it('extends only the end when the start is already on a boundary', () => {
    expect(snapSelectionOutward(6, 9, boundaries)).toEqual({ start: 6, end: 12 })
  })

  it('extends only the start when the end is already on a boundary', () => {
    expect(snapSelectionOutward(3, 12, boundaries)).toEqual({ start: 0, end: 12 })
  })

  it('never extends past the start or end of the text', () => {
    expect(snapSelectionOutward(0, 18, boundaries)).toEqual({ start: 0, end: 18 })
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
