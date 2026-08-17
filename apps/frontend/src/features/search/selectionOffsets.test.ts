import { snapSelectionOutward, trimSelection } from './selectionOffsets'

describe('snapSelectionOutward', () => {
  // "hello world today" (length 17): h0 e1 l2 l3 o4 ' '5 w6 o7 r8 l9 d10 ' '11 t12 o13 d14 a15 y16
  const text = 'hello world today'

  it('leaves a range already aligned to word edges untouched', () => {
    expect(snapSelectionOutward(text, 6, 11)).toEqual({ start: 6, end: 11 })
  })

  it('extends both ends outward when they land inside a word', () => {
    // "hel|lo wor|ld today" -> extends to "hello world"
    expect(snapSelectionOutward(text, 3, 8)).toEqual({ start: 0, end: 11 })
  })

  it('extends only the end when the start is already on a word edge', () => {
    expect(snapSelectionOutward(text, 6, 8)).toEqual({ start: 6, end: 11 })
  })

  it('extends only the start when the end is already on a word edge', () => {
    expect(snapSelectionOutward(text, 3, 11)).toEqual({ start: 0, end: 11 })
  })

  it('never extends past the start or end of the text', () => {
    expect(snapSelectionOutward(text, 0, 17)).toEqual({ start: 0, end: 17 })
  })

  it('leaves a selection confined to whitespace untouched on both sides', () => {
    // Offset 5 is the single space between "hello" and "world" — neither edge sits inside a word.
    expect(snapSelectionOutward(text, 5, 6)).toEqual({ start: 5, end: 6 })
  })

  it('does not reach backward across a whitespace gap into the previous word', () => {
    // Regression: a raw start that lands in the gap right after "hello" (offset 5, not inside any
    // word) must not snap backward to "hello"'s own start just because it's the nearest earlier
    // boundary — only the end (inside "world") should extend, forward, to "world"'s edges.
    expect(snapSelectionOutward(text, 5, 8)).toEqual({ start: 5, end: 11 })
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
