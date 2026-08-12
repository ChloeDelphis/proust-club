import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import QuoteSelection from './QuoteSelection'
import * as authApi from '../../../api/auth'
import * as tagApi from '../../../api/tag'
import * as quoteApi from '../../../api/quote'
import * as cursorOffset from './cursorOffset'
import { ApiError } from '../../../api/client'
import ToastProvider from '../../../components/Toast/ToastProvider'
import { SelectionContext } from '../SelectionContext'
import type { SelectionContextValue } from '../SelectionContext'

vi.mock('../../../api/auth')
vi.mock('../../../api/tag')
vi.mock('../../../api/quote')
vi.mock('./cursorOffset')

function makeWrapper(selectionValue: SelectionContextValue) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <SelectionContext.Provider value={selectionValue}>{children}</SelectionContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    )
  }
}

const connectedUser: authApi.UserResponse = {
  uuid: '11111111-1111-1111-1111-111111111111',
  username: 'marcel',
  email: 'marcel@example.com',
  role: 'USER',
  emailVerified: true,
}

// "hello world today" — boundaries at 0, 6, 12, 18. Highlight covers "world" (6-11).
const TEXT = 'hello world today'
const HIGHLIGHT = { start: 6, end: 11 }
const PARAGRAPH_ID = 42

function renderConnected({ disabled = false }: { disabled?: boolean } = {}) {
  const startSelection = vi.fn()
  const endSelection = vi.fn()
  render(<QuoteSelection paragraphId={PARAGRAPH_ID} text={TEXT} highlightRange={HIGHLIGHT} />, {
    wrapper: makeWrapper({
      activeParagraphId: disabled ? PARAGRAPH_ID + 1 : null,
      startSelection,
      endSelection,
    }),
  })
  return { startSelection, endSelection }
}

function moveAndClickAt(offset: number) {
  vi.mocked(cursorOffset.getOffsetFromPoint).mockReturnValue(offset)
  const paragraph = screen.getByText(/hello/).closest('p')!
  return { paragraph }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(authApi.getCurrentUser).mockResolvedValue(connectedUser)
  vi.mocked(tagApi.listTags).mockResolvedValue([])
})

describe('QuoteSelection — not connected', () => {
  it('shows the plain highlighted text and no button', async () => {
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new ApiError(401))

    renderConnected()

    expect(await screen.findByText('world')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sauvegarder une citation' })).not.toBeInTheDocument()
  })
})

describe('QuoteSelection — connected', () => {
  it('shows the save button, disabled when another selection is active', async () => {
    renderConnected({ disabled: true })

    const button = await screen.findByRole('button', { name: 'Sauvegarder une citation' })
    expect(button).toBeDisabled()
  })

  it('enters placing mode and calls startSelection with its paragraph id when clicking the save button', async () => {
    const { startSelection } = renderConnected()

    await userEvent.click(await screen.findByRole('button', { name: 'Sauvegarder une citation' }))

    expect(startSelection).toHaveBeenCalledWith(PARAGRAPH_ID)
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument()
  })

  it('places both markers and shows "Valider la sélection"', async () => {
    renderConnected()
    await userEvent.click(await screen.findByRole('button', { name: 'Sauvegarder une citation' }))

    const { paragraph } = moveAndClickAt(0)
    act(() => paragraph.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })))
    await userEvent.click(paragraph)
    // still placing the second marker — markers are plain (non-interactive) previews at this point
    expect(screen.getByText('début')).toBeInTheDocument()

    vi.mocked(cursorOffset.getOffsetFromPoint).mockReturnValue(12)
    act(() => paragraph.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })))
    await userEvent.click(paragraph)

    // both placed — markers become interactive buttons (repositionable) and validation is available
    expect(screen.getByRole('button', { name: 'Valider la sélection' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'début' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'fin' })).toBeInTheDocument()
  })

  it('ignores dropping the second marker on the same boundary as the first', async () => {
    renderConnected()
    await userEvent.click(await screen.findByRole('button', { name: 'Sauvegarder une citation' }))

    const { paragraph } = moveAndClickAt(6)
    act(() => paragraph.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })))
    await userEvent.click(paragraph)

    // second marker dropped on the exact same boundary — should be a no-op
    act(() => paragraph.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })))
    await userEvent.click(paragraph)

    expect(screen.queryByRole('button', { name: 'Valider la sélection' })).not.toBeInTheDocument()
  })

  it('lets a placed marker be repositioned, swapping roles if it crosses the other one', async () => {
    renderConnected()
    await userEvent.click(await screen.findByRole('button', { name: 'Sauvegarder une citation' }))

    // place début at 0, fin at 12
    let { paragraph } = moveAndClickAt(0)
    act(() => paragraph.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })))
    await userEvent.click(paragraph)
    vi.mocked(cursorOffset.getOffsetFromPoint).mockReturnValue(12)
    act(() => paragraph.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })))
    await userEvent.click(paragraph)

    // grab "début" (currently at 0) and drop it past "fin" (12), at 18 — roles should swap
    await userEvent.click(screen.getByRole('button', { name: 'début' }))
    vi.mocked(cursorOffset.getOffsetFromPoint).mockReturnValue(18)
    ;({ paragraph } = { paragraph: screen.getByText(/hello/).closest('p')! })
    act(() => paragraph.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })))
    await userEvent.click(paragraph)

    expect(screen.getByRole('button', { name: 'Valider la sélection' })).toBeInTheDocument()
    // the marker still at offset 12 is now labelled "début" since 12 < 18
    expect(screen.getByRole('button', { name: 'début' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'fin' })).toBeInTheDocument()
  })

  it('cancel resets to idle and calls endSelection', async () => {
    const { endSelection } = renderConnected()
    await userEvent.click(await screen.findByRole('button', { name: 'Sauvegarder une citation' }))

    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(endSelection).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Sauvegarder une citation' })).toBeInTheDocument()
  })

  it('validating opens the tag popup, and Terminer saves the quote with the checked tags', async () => {
    vi.mocked(tagApi.listTags).mockResolvedValue([{ id: 1, name: 'Combray' }])
    vi.mocked(quoteApi.createQuote).mockResolvedValue({
      id: 1,
      paragraphId: PARAGRAPH_ID,
      startOffset: 0,
      endOffset: 11,
      selectedText: 'hello world',
      comment: null,
      tags: [],
      createdAt: '2026-08-05T00:00:00Z',
    })
    const { endSelection } = renderConnected()
    await userEvent.click(await screen.findByRole('button', { name: 'Sauvegarder une citation' }))

    const { paragraph } = moveAndClickAt(0)
    act(() => paragraph.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })))
    await userEvent.click(paragraph)
    vi.mocked(cursorOffset.getOffsetFromPoint).mockReturnValue(12)
    act(() => paragraph.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })))
    await userEvent.click(paragraph)

    await userEvent.click(screen.getByRole('button', { name: 'Valider la sélection' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Combray' }))
    await userEvent.click(screen.getByRole('button', { name: 'Terminer' }))

    expect(quoteApi.createQuote).toHaveBeenCalledWith({
      paragraphId: PARAGRAPH_ID,
      startOffset: 0,
      endOffset: 11,
      selectedText: 'hello world',
      tagNames: ['Combray'],
    })
    expect(await screen.findByText('Citation enregistrée.')).toBeInTheDocument()
    expect(endSelection).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Sauvegarder une citation' })).toBeInTheDocument()
  })

  it('dismissing the popup via the × saves the quote without any tag', async () => {
    vi.mocked(quoteApi.createQuote).mockResolvedValue({
      id: 1,
      paragraphId: PARAGRAPH_ID,
      startOffset: 0,
      endOffset: 11,
      selectedText: 'hello world',
      comment: null,
      tags: [],
      createdAt: '2026-08-05T00:00:00Z',
    })
    renderConnected()
    await userEvent.click(await screen.findByRole('button', { name: 'Sauvegarder une citation' }))

    const { paragraph } = moveAndClickAt(0)
    act(() => paragraph.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })))
    await userEvent.click(paragraph)
    vi.mocked(cursorOffset.getOffsetFromPoint).mockReturnValue(12)
    act(() => paragraph.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })))
    await userEvent.click(paragraph)

    await userEvent.click(screen.getByRole('button', { name: 'Valider la sélection' }))
    await screen.findByRole('dialog')

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(quoteApi.createQuote).toHaveBeenCalledWith(
      expect.objectContaining({ tagNames: [] }),
    )
  })

  it('shows an error toast and returns to "ready" if saving fails', async () => {
    vi.mocked(quoteApi.createQuote).mockRejectedValue(new Error('HTTP 500'))
    renderConnected()
    await userEvent.click(await screen.findByRole('button', { name: 'Sauvegarder une citation' }))

    const { paragraph } = moveAndClickAt(0)
    act(() => paragraph.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })))
    await userEvent.click(paragraph)
    vi.mocked(cursorOffset.getOffsetFromPoint).mockReturnValue(12)
    act(() => paragraph.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })))
    await userEvent.click(paragraph)

    await userEvent.click(screen.getByRole('button', { name: 'Valider la sélection' }))
    await screen.findByRole('dialog')
    await userEvent.click(screen.getByRole('button', { name: 'Terminer' }))

    expect(await screen.findByText("La citation n'a pas pu être enregistrée.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Valider la sélection' })).toBeInTheDocument()
  })
})
