import { characterOffsetForRangeBoundary, getSelectionOffsets } from './selectionRangeOffset'

// Mirrors how QuoteSelection actually renders a paragraph's segments: every run (plain or
// highlighted) is wrapped in its own element (<span> or <mark>) — there are no bare text-node
// children directly under the paragraph. "hello world today" with "world" (6-11) highlighted.
function buildParagraph(): { container: HTMLParagraphElement; before: Text; markText: Text; after: Text } {
  const container = document.createElement('p')
  const beforeSpan = document.createElement('span')
  const before = document.createTextNode('hello ')
  beforeSpan.appendChild(before)
  const mark = document.createElement('mark')
  const markText = document.createTextNode('world')
  mark.appendChild(markText)
  const afterSpan = document.createElement('span')
  const after = document.createTextNode(' today')
  afterSpan.appendChild(after)
  container.append(beforeSpan, mark, afterSpan)
  return { container, before, markText, after }
}

describe('characterOffsetForRangeBoundary', () => {
  it('resolves an offset directly inside a text node', () => {
    const { container, markText } = buildParagraph()
    expect(characterOffsetForRangeBoundary(container, markText, 2)).toBe(8) // "hello wo|rld today"
  })

  it('resolves an offset in the first text node before the <mark>', () => {
    const { container, before } = buildParagraph()
    expect(characterOffsetForRangeBoundary(container, before, 0)).toBe(0)
  })

  it('resolves an element boundary (child index) to the start of the next element\'s text', () => {
    const { container } = buildParagraph()
    // Range boundary reported as "container, offset 1" (right after the first <span>, before <mark>)
    expect(characterOffsetForRangeBoundary(container, container, 1)).toBe(6)
  })

  it('resolves an element boundary past the last child to the end of the previous element\'s text', () => {
    const { container } = buildParagraph()
    expect(characterOffsetForRangeBoundary(container, container, container.childNodes.length)).toBe(17)
  })

  it('skips over an empty sibling element to find text on either side', () => {
    const { container } = buildParagraph()
    const empty = document.createElement('span') // e.g. a decorative icon with no text
    container.insertBefore(empty, container.childNodes[1]) // between the first span and the <mark>
    const emptyIndex = 1

    // Forward search from right before the empty element finds "world" (start of the <mark>).
    expect(characterOffsetForRangeBoundary(container, container, emptyIndex)).toBe(6)
    // Forward search starting from right after the empty element (i.e. at the <mark>) — same offset.
    expect(characterOffsetForRangeBoundary(container, container, emptyIndex + 1)).toBe(6)
  })

  it('returns null for a node not present in the container', () => {
    const { container } = buildParagraph()
    const foreign = document.createTextNode('nope')
    expect(characterOffsetForRangeBoundary(container, foreign, 0)).toBeNull()
  })
})

describe('getSelectionOffsets', () => {
  it('converts a Range spanning across the <mark> into paragraph-relative offsets', () => {
    const { container, before, after } = buildParagraph()
    const range = document.createRange()
    range.setStart(before, 2) // "he|llo world today"
    range.setEnd(after, 3) // "hello world to|day"

    expect(getSelectionOffsets(container, range)).toEqual({ start: 2, end: 14 })
  })

  it('returns null when the range extends outside the container', () => {
    const { container } = buildParagraph()
    const outside = document.createTextNode('elsewhere')
    document.body.append(outside)
    const range = document.createRange()
    range.setStart(container.querySelector('span')!.firstChild!, 0)
    range.setEnd(outside, 3)

    expect(getSelectionOffsets(container, range)).toBeNull()
    outside.remove()
  })
})
