import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import QuoteSelection from './QuoteSelection'
import * as authApi from '../../../api/auth'
import * as tagApi from '../../../api/tag'
import * as quoteApi from '../../../api/quote'
import * as selectionRangeOffset from '../selectionRangeOffset'
import { ApiError } from '../../../api/client'
import ToastProvider from '../../../components/Toast/ToastProvider'

vi.mock('../../../api/auth')
vi.mock('../../../api/tag')
vi.mock('../../../api/quote')
vi.mock('../selectionRangeOffset')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}

const connectedUser: authApi.UserResponse = {
  uuid: '11111111-1111-1111-1111-111111111111',
  username: 'marcel',
  email: 'marcel@example.com',
  role: 'USER',
  emailVerified: true,
}

// "hello world today" — word boundaries at 0, 6, 12, 18. Highlight covers "world" (6-11).
const TEXT = 'hello world today'
const HIGHLIGHT = { start: 6, end: 11 }
const PARAGRAPH_ID = 42

// The DOM boundary of Range -> character-offset conversion is mocked out (same philosophy as the
// old cursorOffset.ts: neither jsdom's Selection API nor real drag gestures are meaningfully
// testable here), so a fake Range object is enough — only `getSelectionOffsets`'s mocked return
// value is actually read by the component. Word-boundary extension and whitespace trimming below
// it are real, unmocked logic.
const fakeRange = {} as Range

function fakeSelection(collapsed: boolean): Selection {
  return {
    isCollapsed: collapsed,
    rangeCount: collapsed ? 0 : 1,
    getRangeAt: () => fakeRange,
    removeAllRanges: vi.fn(),
  } as unknown as Selection
}

function setSelection(rawOffsets: { start: number; end: number } | null) {
  if (rawOffsets === null) {
    vi.spyOn(window, 'getSelection').mockReturnValue(fakeSelection(true))
  } else {
    vi.mocked(selectionRangeOffset.getSelectionOffsets).mockReturnValue(rawOffsets)
    vi.spyOn(window, 'getSelection').mockReturnValue(fakeSelection(false))
  }
  act(() => {
    document.dispatchEvent(new Event('selectionchange'))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(authApi.getCurrentUser).mockResolvedValue(connectedUser)
  vi.mocked(tagApi.listTags).mockResolvedValue([])
})

describe('QuoteSelection — not connected', () => {
  it('shows the plain highlighted text and no contextual menu, even with a selection', async () => {
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new ApiError(401))
    render(<QuoteSelection paragraphId={PARAGRAPH_ID} text={TEXT} highlightRange={HIGHLIGHT} />, { wrapper })

    expect(await screen.findByText('world')).toBeInTheDocument()
    setSelection({ start: 0, end: 5 })

    expect(screen.queryByRole('button', { name: 'Sauvegarder' })).not.toBeInTheDocument()
  })
})

describe('QuoteSelection — connected', () => {
  it('shows no contextual menu while there is no selection', async () => {
    render(<QuoteSelection paragraphId={PARAGRAPH_ID} text={TEXT} highlightRange={HIGHLIGHT} />, { wrapper })
    await screen.findByText('world')

    expect(screen.queryByRole('button', { name: 'Sauvegarder' })).not.toBeInTheDocument()
  })

  it('shows the contextual menu once a selection inside the paragraph stabilizes', async () => {
    render(<QuoteSelection paragraphId={PARAGRAPH_ID} text={TEXT} highlightRange={HIGHLIGHT} />, { wrapper })
    await screen.findByText('world')

    setSelection({ start: 8, end: 9 }) // mid-"world"

    expect(await screen.findByRole('button', { name: 'Sauvegarder' })).toBeInTheDocument()
  })

  it('hides the menu again once the selection is cleared', async () => {
    render(<QuoteSelection paragraphId={PARAGRAPH_ID} text={TEXT} highlightRange={HIGHLIGHT} />, { wrapper })
    await screen.findByText('world')

    setSelection({ start: 8, end: 9 })
    await screen.findByRole('button', { name: 'Sauvegarder' })

    setSelection(null)

    expect(screen.queryByRole('button', { name: 'Sauvegarder' })).not.toBeInTheDocument()
  })

  it('ignores a selection outside this paragraph (getSelectionOffsets returns null)', async () => {
    render(<QuoteSelection paragraphId={PARAGRAPH_ID} text={TEXT} highlightRange={HIGHLIGHT} />, { wrapper })
    await screen.findByText('world')

    vi.mocked(selectionRangeOffset.getSelectionOffsets).mockReturnValue(null)
    vi.spyOn(window, 'getSelection').mockReturnValue(fakeSelection(false))
    act(() => document.dispatchEvent(new Event('selectionchange')))

    expect(screen.queryByRole('button', { name: 'Sauvegarder' })).not.toBeInTheDocument()
  })

  it('ignores a selection confined to whitespace, rather than snapping it out to an adjacent word', async () => {
    render(<QuoteSelection paragraphId={PARAGRAPH_ID} text={TEXT} highlightRange={HIGHLIGHT} />, { wrapper })
    await screen.findByText('world')

    // "hello world today" — index 5 is the single space between "hello" and "world". Extending
    // this outward to the nearest word boundaries would silently produce "hello", a word the
    // user never touched — the selection should be treated as empty instead.
    setSelection({ start: 5, end: 6 })

    expect(screen.queryByRole('button', { name: 'Sauvegarder' })).not.toBeInTheDocument()
  })

  it('does not reach backward across a whitespace gap when only one end lands inside a word', async () => {
    vi.mocked(quoteApi.createQuote).mockResolvedValue({
      id: 1,
      paragraphId: PARAGRAPH_ID,
      startOffset: 6,
      endOffset: 11,
      selectedText: 'world',
      comment: null,
      tags: [],
      createdAt: '2026-08-16T00:00:00Z',
    })
    render(<QuoteSelection paragraphId={PARAGRAPH_ID} text={TEXT} highlightRange={HIGHLIGHT} />, { wrapper })
    await screen.findByText('world')

    // Raw start (5) is the space right after "hello" — not inside any word — while the end (9)
    // lands mid-"world". Only the end should extend; the start must stay put rather than reaching
    // backward across the gap into "hello", which the user's selection never touched at all.
    setSelection({ start: 5, end: 9 })
    await userEvent.click(await screen.findByRole('button', { name: 'Sauvegarder' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(quoteApi.createQuote).toHaveBeenCalledWith(
      expect.objectContaining({ startOffset: 6, endOffset: 11, selectedText: 'world' }),
    )
  })

  it('clicking Sauvegarder opens the tag panel with the word-extended, trimmed selection', async () => {
    vi.mocked(tagApi.listTags).mockResolvedValue([{ id: 1, name: 'Combray' }])
    vi.mocked(quoteApi.createQuote).mockResolvedValue({
      id: 1,
      paragraphId: PARAGRAPH_ID,
      startOffset: 6,
      endOffset: 11,
      selectedText: 'world',
      comment: null,
      tags: [],
      createdAt: '2026-08-16T00:00:00Z',
    })
    render(<QuoteSelection paragraphId={PARAGRAPH_ID} text={TEXT} highlightRange={HIGHLIGHT} />, { wrapper })
    await screen.findByText('world')

    // raw selection lands mid-word on both ends; the trailing edge also lands in the
    // whitespace after "world" — extension snaps outward to [6, 12), then trimming drops
    // the trailing space back down to [6, 11), i.e. exactly "world".
    setSelection({ start: 8, end: 9 })
    await userEvent.click(await screen.findByRole('button', { name: 'Sauvegarder' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Combray' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(quoteApi.createQuote).toHaveBeenCalledWith({
      paragraphId: PARAGRAPH_ID,
      startOffset: 6,
      endOffset: 11,
      selectedText: 'world',
      tagNames: ['Combray'],
    })
    expect(await screen.findByText('Citation enregistrée.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cancelling the tag panel (Escape) saves nothing', async () => {
    render(<QuoteSelection paragraphId={PARAGRAPH_ID} text={TEXT} highlightRange={HIGHLIGHT} />, { wrapper })
    await screen.findByText('world')

    setSelection({ start: 8, end: 9 })
    await userEvent.click(await screen.findByRole('button', { name: 'Sauvegarder' }))
    await screen.findByRole('dialog')

    await userEvent.keyboard('{Escape}')

    expect(quoteApi.createQuote).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sauvegarder' })).not.toBeInTheDocument()
  })

  it('closing the tag panel via the × saves nothing', async () => {
    render(<QuoteSelection paragraphId={PARAGRAPH_ID} text={TEXT} highlightRange={HIGHLIGHT} />, { wrapper })
    await screen.findByText('world')

    setSelection({ start: 8, end: 9 })
    await userEvent.click(await screen.findByRole('button', { name: 'Sauvegarder' }))
    await screen.findByRole('dialog')

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(quoteApi.createQuote).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows an error toast and returns to the contextual menu if saving fails', async () => {
    vi.mocked(quoteApi.createQuote).mockRejectedValue(new Error('HTTP 500'))
    render(<QuoteSelection paragraphId={PARAGRAPH_ID} text={TEXT} highlightRange={HIGHLIGHT} />, { wrapper })
    await screen.findByText('world')

    setSelection({ start: 8, end: 9 })
    await userEvent.click(await screen.findByRole('button', { name: 'Sauvegarder' }))
    await screen.findByRole('dialog')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText("La citation n'a pas pu être enregistrée.")).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sauvegarder' })).toBeInTheDocument()
  })
})
