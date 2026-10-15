import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import QuoteTagEditor from './QuoteTagEditor'
import * as quoteApi from '../../../api/quote'
import * as tagApi from '../../../api/tag'
import { ApiError } from '../../../api/client'
import ToastProvider from '../../../components/Toast/ToastProvider'
import { quoteId } from '../TimelineBar/timelineTestFixtures'

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

const QUOTE_ID = quoteId(7)
const COMBRAY_ID = '00000000-0000-4000-8000-000000000101'
const BALBEC_ID = '00000000-0000-4000-8000-000000000102'
const JALOUSIE_ID = '00000000-0000-4000-8000-000000000103'
const MAX_TAGS = 20

const ALL_TAGS = [
  { id: COMBRAY_ID, name: 'Combray', colorIndex: 0 },
  { id: BALBEC_ID, name: 'Balbec', colorIndex: 1 },
  { id: JALOUSIE_ID, name: 'jalousie', colorIndex: 2 },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(tagApi.listTags).mockResolvedValue(ALL_TAGS)
})

it('renders attached tags as chips and excludes them from suggestions', async () => {
  render(<QuoteTagEditor quoteId={QUOTE_ID} tags={[{ id: COMBRAY_ID, name: 'Combray', colorIndex: 0 }]} />, { wrapper })

  expect(screen.getByText('Combray')).toBeInTheDocument()
  await userEvent.type(await screen.findByRole('textbox', { name: 'Ajouter un tag' }), 'a')

  expect(screen.queryByRole('button', { name: 'Combray' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Balbec' })).toBeInTheDocument()
})

it('adds a tag when a suggestion is clicked', async () => {
  vi.mocked(quoteApi.addTagToQuote).mockResolvedValue({} as quoteApi.QuoteSelectionResponse)
  render(<QuoteTagEditor quoteId={QUOTE_ID} tags={[]} />, { wrapper })

  await userEvent.type(await screen.findByRole('textbox', { name: 'Ajouter un tag' }), 'Balbec')
  await userEvent.click(await screen.findByRole('button', { name: 'Balbec' }))

  expect(quoteApi.addTagToQuote).toHaveBeenCalledWith(QUOTE_ID, { name: 'Balbec' })
})

it('creates a new tag from the search field when no exact match exists', async () => {
  vi.mocked(quoteApi.addTagToQuote).mockResolvedValue({} as quoteApi.QuoteSelectionResponse)
  render(<QuoteTagEditor quoteId={QUOTE_ID} tags={[]} />, { wrapper })

  await userEvent.type(await screen.findByRole('textbox', { name: 'Ajouter un tag' }), 'Guermantes')
  await userEvent.click(await screen.findByRole('button', { name: 'Créer « Guermantes »' }))

  expect(quoteApi.addTagToQuote).toHaveBeenCalledWith(QUOTE_ID, { name: 'Guermantes' })
})

it('disables adding tags at the maximum while keeping removal available', async () => {
  const tags = Array.from({ length: MAX_TAGS }, (_, index) => ({
    id: `tag-${index + 1}`,
    name: `Tag ${index + 1}`,
    colorIndex: index % 10,
  }))
  vi.mocked(quoteApi.removeTagFromQuote).mockResolvedValue(undefined)
  render(<QuoteTagEditor quoteId={QUOTE_ID} tags={tags} />, { wrapper })

  expect(await screen.findByText(`Maximum : ${MAX_TAGS} tags par citation.`)).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Ajouter un tag' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Retirer Tag 1' })).toBeEnabled()

  await userEvent.click(screen.getByRole('button', { name: 'Retirer Tag 1' }))

  expect(quoteApi.removeTagFromQuote).toHaveBeenCalledWith(QUOTE_ID, 'tag-1')
})

it('does not offer to create a tag that already exists', async () => {
  render(<QuoteTagEditor quoteId={QUOTE_ID} tags={[]} />, { wrapper })

  await userEvent.type(await screen.findByRole('textbox', { name: 'Ajouter un tag' }), 'combray')

  expect(screen.queryByRole('button', { name: /Créer/ })).not.toBeInTheDocument()
})

it('removes a tag when its chip button is clicked', async () => {
  vi.mocked(quoteApi.removeTagFromQuote).mockResolvedValue(undefined)
  render(<QuoteTagEditor quoteId={QUOTE_ID} tags={[{ id: COMBRAY_ID, name: 'Combray', colorIndex: 0 }]} />, { wrapper })

  await userEvent.click(screen.getByRole('button', { name: 'Retirer Combray' }))

  expect(quoteApi.removeTagFromQuote).toHaveBeenCalledWith(QUOTE_ID, COMBRAY_ID)
})

it('disables removal while the request is pending to prevent repeated deletes', async () => {
  let finishRemoval: (() => void) | undefined
  vi.mocked(quoteApi.removeTagFromQuote).mockImplementation(() => new Promise<void>(resolve => { finishRemoval = () => resolve() }))
  const user = userEvent.setup()
  render(<QuoteTagEditor quoteId={QUOTE_ID} tags={[{ id: COMBRAY_ID, name: 'Combray', colorIndex: 0 }]} />, { wrapper })

  const removeButton = screen.getByRole('button', { name: 'Retirer Combray' })
  await user.click(removeButton)

  expect(removeButton).toBeDisabled()
  await user.click(removeButton)
  expect(quoteApi.removeTagFromQuote).toHaveBeenCalledTimes(1)

  finishRemoval?.()
})

it('shows an error toast when adding a tag fails', async () => {
  vi.mocked(quoteApi.addTagToQuote).mockRejectedValue(new Error('network error'))
  render(<QuoteTagEditor quoteId={QUOTE_ID} tags={[]} />, { wrapper })

  await userEvent.type(await screen.findByRole('textbox', { name: 'Ajouter un tag' }), 'Guermantes')
  await userEvent.click(await screen.findByRole('button', { name: 'Créer « Guermantes »' }))

  expect(await screen.findByText("Le tag n'a pas pu être ajouté.")).toBeInTheDocument()
})

it('shows the tag limit when the server rejects an add because another view filled the quote', async () => {
  vi.mocked(quoteApi.addTagToQuote).mockRejectedValue(new ApiError(409))
  render(<QuoteTagEditor quoteId={QUOTE_ID} tags={[]} />, { wrapper })

  await userEvent.type(await screen.findByRole('textbox', { name: 'Ajouter un tag' }), 'Guermantes')
  await userEvent.click(await screen.findByRole('button', { name: 'Créer « Guermantes »' }))

  expect(await screen.findByText('Maximum : 20 tags par citation.')).toBeInTheDocument()
})

it('shows an error toast when removing a tag fails', async () => {
  vi.mocked(quoteApi.removeTagFromQuote).mockRejectedValue(new Error('network error'))
  render(<QuoteTagEditor quoteId={QUOTE_ID} tags={[{ id: COMBRAY_ID, name: 'Combray', colorIndex: 0 }]} />, { wrapper })

  await userEvent.click(screen.getByRole('button', { name: 'Retirer Combray' }))

  expect(await screen.findByText("Le tag n'a pas pu être retiré.")).toBeInTheDocument()
})
