import { computeSelectionPhase } from './computeSelectionPhase'
import * as selectionRangeOffset from './selectionRangeOffset'
import type { Phase } from './QuoteSelection/QuoteSelection.types'

vi.mock('./selectionRangeOffset')

// "hello world today" (length 17).
const TEXT = 'hello world today'
const fakeContainer = {} as HTMLElement
const fakeRange = {} as Range

function fakeSelection(collapsed: boolean): Selection {
  return {
    isCollapsed: collapsed,
    rangeCount: collapsed ? 0 : 1,
    getRangeAt: () => fakeRange,
  } as unknown as Selection
}

describe('computeSelectionPhase', () => {
  it('leaves the tag panel untouched regardless of the current native selection', () => {
    const tagPanel: Phase = { kind: 'tagPanel', start: 0, end: 5 }
    expect(computeSelectionPhase(tagPanel, fakeContainer, fakeSelection(true), TEXT)).toBe(tagPanel)
  })

  it('falls back to idle when there is no container', () => {
    const selected: Phase = { kind: 'selected', start: 0, end: 5 }
    expect(computeSelectionPhase(selected, null, fakeSelection(false), TEXT)).toEqual({ kind: 'idle' })
  })

  it('falls back to idle when the native selection is collapsed', () => {
    const selected: Phase = { kind: 'selected', start: 0, end: 5 }
    expect(computeSelectionPhase(selected, fakeContainer, fakeSelection(true), TEXT)).toEqual({ kind: 'idle' })
  })

  it('stays idle (not selected) when already idle and the selection is collapsed', () => {
    expect(computeSelectionPhase({ kind: 'idle' }, fakeContainer, fakeSelection(true), TEXT)).toEqual({ kind: 'idle' })
  })

  it('falls back to idle when getSelectionOffsets finds the range outside the paragraph', () => {
    vi.mocked(selectionRangeOffset.getSelectionOffsets).mockReturnValue(null)
    const selected: Phase = { kind: 'selected', start: 0, end: 5 }
    expect(computeSelectionPhase(selected, fakeContainer, fakeSelection(false), TEXT)).toEqual({ kind: 'idle' })
  })

  it('snaps and trims the raw offsets into a selected phase', () => {
    // "he|llo world today" -> "to|day" (6-14), snapped outward to the full "world today" (6-17)
    vi.mocked(selectionRangeOffset.getSelectionOffsets).mockReturnValue({ start: 6, end: 14 })
    expect(computeSelectionPhase({ kind: 'idle' }, fakeContainer, fakeSelection(false), TEXT))
      .toEqual({ kind: 'selected', start: 6, end: 17 })
  })

  it('falls back to idle when the trimmed range is empty (whitespace-only selection)', () => {
    vi.mocked(selectionRangeOffset.getSelectionOffsets).mockReturnValue({ start: 5, end: 6 }) // the space after "hello"
    expect(computeSelectionPhase({ kind: 'idle' }, fakeContainer, fakeSelection(false), TEXT)).toEqual({ kind: 'idle' })
  })
})
