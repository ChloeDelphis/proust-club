import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import TimelineBar from './TimelineBar'
import * as quoteApi from '../../../api/quote'
import type { TimelineResponse } from '../../../api/quote'
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

const volumes: TimelineResponse['volumes'] = [
  { id: 1, title: 'Du Côté de Chez Swann', position: 1, minPage: 1, maxPage: 103 },
  { id: 2, title: "À l'Ombre des Jeunes Filles en Fleurs", position: 2, minPage: 104, maxPage: 183 },
]

function makeQuote(id: number, pageNumber: number, volumeId: number, selectedText = `citation ${id}`): TimelineResponse['quotes'][number] {
  return { id, paragraphId: id, pageNumber, volumeId, selectedText, comment: null, tags: [], createdAt: '2026-08-07T00:00:00Z' }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(tagApi.listTags).mockResolvedValue([])
})

it('shows a spinner while loading', () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockReturnValue(new Promise(() => {}))

  render(<TimelineBar activeTagId={null} />, { wrapper })

  expect(screen.getByRole('status')).toBeInTheDocument()
})

it('shows an error message when the request fails', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockRejectedValue(new Error('HTTP 500'))

  render(<TimelineBar activeTagId={null} />, { wrapper })

  expect(await screen.findByRole('alert')).toBeInTheDocument()
})

it('always shows a filter button for every volume, plus "Tous les tomes"', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({ volumes, quotes: [] })

  render(<TimelineBar activeTagId={null} />, { wrapper })

  expect(await screen.findByRole('button', { name: 'Tous les tomes' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Du Côté de Chez Swann' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: "À l'Ombre des Jeunes Filles en Fleurs" })).toBeInTheDocument()
})

it('renders one bookmark per saved quote', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({
    volumes,
    quotes: [makeQuote(1, 9, 1), makeQuote(2, 150, 2)],
  })

  render(<TimelineBar activeTagId={null} />, { wrapper })

  expect(await screen.findByRole('button', { name: 'Citation page 9' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Citation page 150' })).toBeInTheDocument()
})

it('zooming on a volume hides bookmarks from other volumes', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({
    volumes,
    quotes: [makeQuote(1, 9, 1), makeQuote(2, 150, 2)],
  })
  const user = userEvent.setup()

  render(<TimelineBar activeTagId={null} />, { wrapper })
  await screen.findByRole('button', { name: 'Citation page 150' })

  await user.click(screen.getByRole('button', { name: 'Du Côté de Chez Swann' }))

  expect(screen.getByRole('button', { name: 'Citation page 9' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Citation page 150' })).not.toBeInTheDocument()
})

it('zooming by clicking directly on a volume zone in the bar also hides other volumes', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({
    volumes,
    quotes: [makeQuote(1, 9, 1), makeQuote(2, 150, 2)],
  })
  const user = userEvent.setup()

  render(<TimelineBar activeTagId={null} />, { wrapper })
  await screen.findByRole('button', { name: 'Citation page 150' })

  await user.click(screen.getByRole('button', { name: 'Zoomer sur Du Côté de Chez Swann' }))

  expect(screen.getByRole('button', { name: 'Citation page 9' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Citation page 150' })).not.toBeInTheDocument()
})

it('returns to the full view when "Tous les tomes" is clicked again', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({
    volumes,
    quotes: [makeQuote(1, 9, 1), makeQuote(2, 150, 2)],
  })
  const user = userEvent.setup()

  render(<TimelineBar activeTagId={null} />, { wrapper })
  await screen.findByRole('button', { name: 'Citation page 150' })
  await user.click(screen.getByRole('button', { name: 'Du Côté de Chez Swann' }))
  await user.click(screen.getByRole('button', { name: 'Tous les tomes' }))

  expect(screen.getByRole('button', { name: 'Citation page 9' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Citation page 150' })).toBeInTheDocument()
})

it('clicking a bookmark opens the quote in a modal', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({
    volumes,
    quotes: [makeQuote(1, 9, 1, 'Il y avait déjà bien des années')],
  })
  const user = userEvent.setup()

  render(<TimelineBar activeTagId={null} />, { wrapper })
  await user.click(await screen.findByRole('button', { name: 'Citation page 9' }))

  expect(screen.getByText('Il y avait déjà bien des années')).toBeInTheDocument()
})

it('hovering a bookmark shows a preview, leaving hides it', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({
    volumes,
    quotes: [makeQuote(1, 9, 1, 'Il y avait déjà bien des années')],
  })
  const user = userEvent.setup()

  render(<TimelineBar activeTagId={null} />, { wrapper })
  const bookmark = await screen.findByRole('button', { name: 'Citation page 9' })

  await user.hover(bookmark)
  expect(screen.getByRole('tooltip')).toHaveTextContent('Il y avait déjà bien des années')

  await user.unhover(bookmark)
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})

it('refetches with the active tag filter', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({ volumes, quotes: [] })

  render(<TimelineBar activeTagId={7} />, { wrapper })

  await waitFor(() => {
    expect(quoteApi.getQuoteTimeline).toHaveBeenCalledWith({ tagId: 7 }, expect.anything())
  })
})
