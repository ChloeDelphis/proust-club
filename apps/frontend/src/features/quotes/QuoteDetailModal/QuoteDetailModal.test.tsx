import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import QuoteDetailModal from './QuoteDetailModal'
import type { TimelineQuote } from '../../../api/quote'
import * as quoteApi from '../../../api/quote'
import * as tagApi from '../../../api/tag'
import ToastProvider from '../../../components/Toast/ToastProvider'

vi.mock('../../../api/quote')
vi.mock('../../../api/tag')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}

const QUOTE_ID = '00000000-0000-4000-8000-000000000001'
const TAG_ID = '00000000-0000-4000-8000-000000000101'

const quote: TimelineQuote = {
  id: QUOTE_ID,
  paragraphId: 45,
  pageNumber: 9,
  volumeId: 1,
  selectedText: 'Il y avait déjà bien des années',
  comment: null,
  tags: [{ id: TAG_ID, name: 'Combray' }],
  createdAt: '2026-08-07T11:09:15.787282Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(tagApi.listTags).mockResolvedValue([{ id: TAG_ID, name: 'Combray' }])
})

describe('QuoteDetailModal', () => {
  it('renders nothing visible when there is no open quote', () => {
    render(<QuoteDetailModal quote={null} volumeTitle={undefined} onClose={vi.fn()} />, { wrapper })
    expect(screen.queryByText(quote.selectedText)).not.toBeInTheDocument()
  })

  it('shows the full quote, tags and volume/page metadata when a quote is open', () => {
    render(<QuoteDetailModal quote={quote} volumeTitle="Du Côté de Chez Swann" onClose={vi.fn()} />, { wrapper })

    expect(screen.getByText(quote.selectedText)).toBeInTheDocument()
    expect(screen.getByText('Combray')).toBeInTheDocument()
    expect(screen.getByText(/Du Côté de Chez Swann — page 9/)).toBeInTheDocument()
  })

  it('pre-fills the comment field with the quote\'s existing comment', () => {
    render(
      <QuoteDetailModal quote={{ ...quote, comment: 'Un souvenir marquant.' }} volumeTitle={undefined} onClose={vi.fn()} />,
      { wrapper },
    )

    expect(screen.getByRole('textbox', { name: 'Commentaire personnel' })).toHaveValue('Un souvenir marquant.')
  })

  it('re-syncs the draft from the server value when the same quote is reopened', () => {
    const { rerender } = render(<QuoteDetailModal quote={quote} volumeTitle={undefined} onClose={vi.fn()} />, { wrapper })

    const textarea = screen.getByRole('textbox', { name: 'Commentaire personnel' })
    fireEvent.change(textarea, { target: { value: 'Brouillon jamais sauvegardé' } })

    // Modal closes, then reopens on the same quote (same id) with a fresh comment from the server —
    // the leftover local draft above must not stick around instead of it.
    rerender(<QuoteDetailModal quote={null} volumeTitle={undefined} onClose={vi.fn()} />)
    rerender(<QuoteDetailModal quote={{ ...quote, comment: 'Valeur serveur à jour' }} volumeTitle={undefined} onClose={vi.fn()} />)

    expect(screen.getByRole('textbox', { name: 'Commentaire personnel' })).toHaveValue('Valeur serveur à jour')
  })

  it('allows adding/removing tags from within the modal', async () => {
    render(<QuoteDetailModal quote={quote} volumeTitle={undefined} onClose={vi.fn()} />, { wrapper })

    expect(await screen.findByRole('button', { name: 'Retirer Combray' })).toBeInTheDocument()
  })

  it('calls onClose when the close button is pressed', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<QuoteDetailModal quote={quote} volumeTitle={undefined} onClose={onClose} />, { wrapper })

    await user.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<QuoteDetailModal quote={quote} volumeTitle={undefined} onClose={onClose} />, { wrapper })

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })

  it('saves a trimmed comment when closing via the close button', async () => {
    vi.mocked(quoteApi.updateQuoteComment).mockResolvedValue({} as quoteApi.QuoteSelectionResponse)
    const user = userEvent.setup()
    render(<QuoteDetailModal quote={quote} volumeTitle={undefined} onClose={vi.fn()} />, { wrapper })

    await user.type(screen.getByRole('textbox', { name: 'Commentaire personnel' }), '  Un souvenir marquant.  ')
    await user.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(quoteApi.updateQuoteComment).toHaveBeenCalledWith(QUOTE_ID, { comment: 'Un souvenir marquant.' })
  })

  it('saves a trimmed comment when closing via Escape', async () => {
    vi.mocked(quoteApi.updateQuoteComment).mockResolvedValue({} as quoteApi.QuoteSelectionResponse)
    const user = userEvent.setup()
    render(<QuoteDetailModal quote={quote} volumeTitle={undefined} onClose={vi.fn()} />, { wrapper })

    await user.type(screen.getByRole('textbox', { name: 'Commentaire personnel' }), 'Un souvenir marquant.')
    await user.keyboard('{Escape}')

    expect(quoteApi.updateQuoteComment).toHaveBeenCalledWith(QUOTE_ID, { comment: 'Un souvenir marquant.' })
  })

  it('does not call the API when the comment is unchanged on close', async () => {
    const user = userEvent.setup()
    render(<QuoteDetailModal quote={{ ...quote, comment: 'Déjà là.' }} volumeTitle={undefined} onClose={vi.fn()} />, { wrapper })

    await user.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(quoteApi.updateQuoteComment).not.toHaveBeenCalled()
  })

  it('shows an error toast when saving the comment fails', async () => {
    vi.mocked(quoteApi.updateQuoteComment).mockRejectedValue(new Error('network error'))
    const user = userEvent.setup()
    render(<QuoteDetailModal quote={quote} volumeTitle={undefined} onClose={vi.fn()} />, { wrapper })

    await user.type(screen.getByRole('textbox', { name: 'Commentaire personnel' }), 'Un souvenir marquant.')
    await user.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(await screen.findByText("Le commentaire n'a pas pu être enregistré.")).toBeInTheDocument()
  })
})
