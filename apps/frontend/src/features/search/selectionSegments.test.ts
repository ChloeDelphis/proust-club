import { buildSelectionSegments } from './selectionSegments'

describe('buildSelectionSegments', () => {
  it('keeps search highlighting separate from the selected text', () => {
    expect(buildSelectionSegments('hello world today', { start: 6, end: 11 }, { start: 0, end: 5 })).toEqual([
      { text: 'hello', highlighted: false, selected: true },
      { text: ' ', highlighted: false, selected: false },
      { text: 'world', highlighted: true, selected: false },
      { text: ' today', highlighted: false, selected: false },
    ])
  })

  it('splits overlapping search and selection ranges', () => {
    expect(buildSelectionSegments('hello world today', { start: 6, end: 11 }, { start: 8, end: 14 })).toEqual([
      { text: 'hello ', highlighted: false, selected: false },
      { text: 'wo', highlighted: true, selected: false },
      { text: 'rld', highlighted: true, selected: true },
      { text: ' to', highlighted: false, selected: true },
      { text: 'day', highlighted: false, selected: false },
    ])
  })
})
