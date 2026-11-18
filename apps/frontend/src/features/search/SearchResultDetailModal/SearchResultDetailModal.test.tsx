import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import type { ReactNode } from 'react'
import SearchResultDetailModal from './SearchResultDetailModal'
import * as authApi from '../../../api/auth'
import * as paragraphApi from '../../../api/paragraph'
import * as quoteApi from '../../../api/quote'
import * as selectionRangeOffset from '../selectionRangeOffset'
import * as tagApi from '../../../api/tag'
import ToastProvider from '../../../components/Toast/ToastProvider'
import GuestQuoteSaveProvider from '../GuestQuoteSaveProvider'
import type { SearchHit } from '../../../api/search'

vi.mock('../../../api/auth')
vi.mock('../../../api/paragraph')
vi.mock('../../../api/quote')
vi.mock('../../../api/tag')
vi.mock('../selectionRangeOffset')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <GuestQuoteSaveProvider>
          <ToastProvider>{children}</ToastProvider>
        </GuestQuoteSaveProvider>
      </MemoryRouter>
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

const firstHit: SearchHit = {
  paragraphId: 42,
  text: 'hello world today',
  startOffset: 6,
  endOffset: 11,
  volume: 'Du côté de chez Swann',
  part: 'Combray',
  pageNumber: 10,
}

const secondHit: SearchHit = { ...firstHit, paragraphId: 43, text: 'another passage' }
const fakeRange = {} as Range

function fakeSelection(collapsed: boolean): Selection {
  return {
    isCollapsed: collapsed,
    rangeCount: collapsed ? 0 : 1,
    getRangeAt: () => fakeRange,
    removeAllRanges: vi.fn(),
  } as unknown as Selection
}

function setSelection(offsets: { start: number; end: number } | null) {
  if (offsets) {
    vi.mocked(selectionRangeOffset.getSelectionOffsets).mockReturnValue(offsets)
    vi.spyOn(window, 'getSelection').mockReturnValue(fakeSelection(false))
  } else {
    vi.spyOn(window, 'getSelection').mockReturnValue(fakeSelection(true))
  }
  act(() => document.dispatchEvent(new Event('selectionchange')))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(authApi.getCurrentUser).mockResolvedValue(connectedUser)
  vi.mocked(tagApi.listTags).mockResolvedValue([])
  vi.mocked(paragraphApi.getParagraphContext).mockImplementation(async paragraphId => ({
    paragraphId,
    before: [],
    after: [],
    hasMoreBefore: false,
    hasMoreAfter: false,
  }))
  vi.mocked(quoteApi.createQuote).mockResolvedValue({
    id: '00000000-0000-4000-8000-000000000001',
    paragraphId: firstHit.paragraphId,
    startOffset: 6,
    endOffset: 11,
    selectedText: 'world',
    comment: null,
    tags: [],
    createdAt: '2026-08-16T00:00:00Z',
  })
})

describe('SearchResultDetailModal selection flow', () => {
  it('saves a selection that excludes the original search match', async () => {
    render(<SearchResultDetailModal hit={firstHit} onClose={vi.fn()} />, { wrapper })

    setSelection({ start: 0, end: 5 })
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer ce passage' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer sans tag' }))

    expect(quoteApi.createQuote).toHaveBeenCalledWith(expect.objectContaining({
      paragraphId: firstHit.paragraphId,
      startOffset: 0,
      endOffset: 5,
      selectedText: 'hello',
    }))
  })

  it('keeps the selected passage while the tag panel is open and saves its offsets', async () => {
    const user = userEvent.setup()
    render(<SearchResultDetailModal hit={firstHit} onClose={vi.fn()} />, { wrapper })

    setSelection({ start: 8, end: 9 })
    await user.click(await screen.findByRole('button', { name: 'Enregistrer ce passage' }))
    expect(await screen.findByRole('textbox', { name: 'Chercher un tag' })).toBeInTheDocument()
    expect(screen.getByText('world').getAttribute('class')).toContain('selectedText')
    expect(screen.getByText('Du côté de chez Swann')).toBeInTheDocument()
    expect(screen.getByText('Combray')).toBeInTheDocument()

    setSelection(null)
    expect(screen.getByRole('button', { name: 'Enregistrer sans tag' })).toBeInTheDocument()
    expect(screen.getByText('world').getAttribute('class')).toContain('selectedText')

    const tagSearch = screen.getByRole('textbox', { name: 'Chercher un tag' })
    await user.type(tagSearch, 'Jojo{Enter}')
    expect(screen.getByText('Jojo')).toBeInTheDocument()
    expect(quoteApi.createQuote).not.toHaveBeenCalled()

    await user.click(screen.getByText('hello'))
    expect(screen.getByRole('textbox', { name: 'Chercher un tag' })).toBeInTheDocument()
    expect(screen.getByText('world').getAttribute('class')).toContain('selectedText')
    expect(screen.getByText('Jojo')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('button', { name: 'Enregistrer ce passage' })).not.toBeInTheDocument()
    expect(screen.getByText('world').getAttribute('class')).not.toContain('selectedText')
    expect(screen.queryByRole('textbox', { name: 'Chercher un tag' })).not.toBeInTheDocument()
    expect(quoteApi.createQuote).not.toHaveBeenCalled()

    setSelection({ start: 8, end: 9 })
    await user.click(await screen.findByRole('button', { name: 'Enregistrer ce passage' }))
    await user.click(await screen.findByRole('button', { name: 'Enregistrer sans tag' }))

    expect(quoteApi.createQuote).toHaveBeenCalledWith(expect.objectContaining({
      paragraphId: firstHit.paragraphId,
      startOffset: 6,
      endOffset: 11,
      selectedText: 'world',
      tagNames: [],
    }))
  })

  it('does not carry a selection over to a different paragraph', async () => {
    const { rerender } = render(<SearchResultDetailModal hit={firstHit} onClose={vi.fn()} />, { wrapper })
    setSelection({ start: 8, end: 9 })
    expect(await screen.findByRole('button', { name: 'Enregistrer ce passage' })).toBeInTheDocument()

    rerender(<SearchResultDetailModal hit={secondHit} onClose={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Enregistrer ce passage' })).not.toBeInTheDocument()
  })

  it('clears the selection action when the user clicks elsewhere', async () => {
    render(<SearchResultDetailModal hit={firstHit} onClose={vi.fn()} />, { wrapper })
    setSelection({ start: 8, end: 9 })
    expect(await screen.findByRole('button', { name: 'Enregistrer ce passage' })).toBeInTheDocument()

    act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })))

    expect(screen.queryByRole('button', { name: 'Enregistrer ce passage' })).not.toBeInTheDocument()
    expect(screen.getByText('Sélectionnez un passage dans le texte pour le conserver.')).toBeInTheDocument()
  })

  it('clears the selection when the modal closes', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { rerender } = render(<SearchResultDetailModal hit={firstHit} onClose={onClose} />, { wrapper })
    setSelection({ start: 8, end: 9 })
    await screen.findByRole('button', { name: 'Enregistrer ce passage' })

    await user.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalledOnce()
    rerender(<SearchResultDetailModal hit={null} onClose={onClose} />)
    setSelection(null)
    rerender(<SearchResultDetailModal hit={firstHit} onClose={onClose} />)

    expect(screen.queryByRole('button', { name: 'Enregistrer ce passage' })).not.toBeInTheDocument()
  })
})
