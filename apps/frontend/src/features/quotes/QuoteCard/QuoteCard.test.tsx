import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import QuoteCard from './QuoteCard'
import * as quoteApi from '../../../api/quote'
import ToastProvider from '../../../components/Toast/ToastProvider'
import type { QuoteSelectionResponse } from '../../../api/quote'
import { quoteId } from '../TimelineBar/timelineTestFixtures'

vi.mock('../../../api/quote')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}

const QUOTE_ID = quoteId(7)

const quote: QuoteSelectionResponse = {
  id: QUOTE_ID,
  paragraphId: 42,
  startOffset: 0,
  endOffset: 11,
  selectedText: 'hello world',
  comment: null,
  tags: [{ id: '00000000-0000-4000-8000-000000000101', name: 'Combray' }],
  createdAt: '2026-08-05T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

it('shows the selected text, tags and formatted date', () => {
  render(<QuoteCard quote={quote} />, { wrapper })

  expect(screen.getByText('hello world')).toBeInTheDocument()
  expect(screen.getByText('Combray')).toBeInTheDocument()
  expect(screen.getByText('5 août 2026')).toBeInTheDocument()
})

it('does nothing if the delete confirmation is declined', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<QuoteCard quote={quote} />, { wrapper })

  await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

  expect(quoteApi.deleteQuote).not.toHaveBeenCalled()
})

it('deletes the quote when the confirmation is accepted', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.mocked(quoteApi.deleteQuote).mockResolvedValue(undefined)
  render(<QuoteCard quote={quote} />, { wrapper })

  await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

  expect(quoteApi.deleteQuote).toHaveBeenCalledWith(QUOTE_ID)
})

it('shows an error toast if deletion fails', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.mocked(quoteApi.deleteQuote).mockRejectedValue(new Error('HTTP 500'))
  render(<QuoteCard quote={quote} />, { wrapper })

  await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

  expect(await screen.findByText("La citation n'a pas pu être supprimée.")).toBeInTheDocument()
})
