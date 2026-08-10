import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import QuoteTagEditor from './QuoteTagEditor'
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

const ALL_TAGS = [
  { id: 1, name: 'Combray' },
  { id: 2, name: 'Balbec' },
  { id: 3, name: 'jalousie' },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(tagApi.listTags).mockResolvedValue(ALL_TAGS)
})

it('renders attached tags as chips and excludes them from suggestions', async () => {
  render(<QuoteTagEditor quoteId={7} tags={[{ id: 1, name: 'Combray' }]} />, { wrapper })

  expect(screen.getByText('Combray')).toBeInTheDocument()
  await userEvent.type(await screen.findByRole('textbox', { name: 'Ajouter un tag' }), 'a')

  expect(screen.queryByRole('button', { name: 'Combray' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Balbec' })).toBeInTheDocument()
})

it('adds a tag when a suggestion is clicked', async () => {
  vi.mocked(quoteApi.addTagToQuote).mockResolvedValue({} as quoteApi.QuoteSelectionResponse)
  render(<QuoteTagEditor quoteId={7} tags={[]} />, { wrapper })

  await userEvent.type(await screen.findByRole('textbox', { name: 'Ajouter un tag' }), 'Balbec')
  await userEvent.click(await screen.findByRole('button', { name: 'Balbec' }))

  expect(quoteApi.addTagToQuote).toHaveBeenCalledWith(7, { name: 'Balbec' })
})

it('creates a new tag from the search field when no exact match exists', async () => {
  vi.mocked(quoteApi.addTagToQuote).mockResolvedValue({} as quoteApi.QuoteSelectionResponse)
  render(<QuoteTagEditor quoteId={7} tags={[]} />, { wrapper })

  await userEvent.type(await screen.findByRole('textbox', { name: 'Ajouter un tag' }), 'Guermantes')
  await userEvent.click(await screen.findByRole('button', { name: 'Créer « Guermantes »' }))

  expect(quoteApi.addTagToQuote).toHaveBeenCalledWith(7, { name: 'Guermantes' })
})

it('does not offer to create a tag that already exists', async () => {
  render(<QuoteTagEditor quoteId={7} tags={[]} />, { wrapper })

  await userEvent.type(await screen.findByRole('textbox', { name: 'Ajouter un tag' }), 'combray')

  expect(screen.queryByRole('button', { name: /Créer/ })).not.toBeInTheDocument()
})

it('removes a tag when its chip button is clicked', async () => {
  vi.mocked(quoteApi.removeTagFromQuote).mockResolvedValue(undefined)
  render(<QuoteTagEditor quoteId={7} tags={[{ id: 1, name: 'Combray' }]} />, { wrapper })

  await userEvent.click(screen.getByRole('button', { name: 'Retirer Combray' }))

  expect(quoteApi.removeTagFromQuote).toHaveBeenCalledWith(7, 1)
})

it('shows an error toast when adding a tag fails', async () => {
  vi.mocked(quoteApi.addTagToQuote).mockRejectedValue(new Error('network error'))
  render(<QuoteTagEditor quoteId={7} tags={[]} />, { wrapper })

  await userEvent.type(await screen.findByRole('textbox', { name: 'Ajouter un tag' }), 'Guermantes')
  await userEvent.click(await screen.findByRole('button', { name: 'Créer « Guermantes »' }))

  expect(await screen.findByText("Le tag n'a pas pu être ajouté.")).toBeInTheDocument()
})

it('shows an error toast when removing a tag fails', async () => {
  vi.mocked(quoteApi.removeTagFromQuote).mockRejectedValue(new Error('network error'))
  render(<QuoteTagEditor quoteId={7} tags={[{ id: 1, name: 'Combray' }]} />, { wrapper })

  await userEvent.click(screen.getByRole('button', { name: 'Retirer Combray' }))

  expect(await screen.findByText("Le tag n'a pas pu être retiré.")).toBeInTheDocument()
})
