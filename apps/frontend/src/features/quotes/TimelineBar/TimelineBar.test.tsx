import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import TimelineBar from './TimelineBar'
import * as quoteApi from '../../../api/quote'
import type { TimelineResponse } from '../../../api/quote'
import * as tagApi from '../../../api/tag'
import ToastProvider from '../../../components/Toast/ToastProvider'
import { quoteId } from './timelineTestFixtures'

// TimelineBar is controlled (selectedVolumeId/onSelectVolume owned by the parent in real usage,
// MyQuotesPage) — this feeds the prop back so tests can observe the effect of clicking a zone
// directly in the bar, same pattern as any other controlled-component test in this codebase.
function ControlledTimelineBar({ activeTagId }: { activeTagId: string | null }) {
  const [selectedVolumeId, setSelectedVolumeId] = useState<number | null>(null)
  return <TimelineBar activeTagId={activeTagId} selectedVolumeId={selectedVolumeId} onSelectVolume={setSelectedVolumeId} />
}

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

function makeQuote(n: number, pageNumber: number, volumeId: number, selectedText = `citation ${n}`): TimelineResponse['quotes'][number] {
  return { id: quoteId(n), paragraphId: n, pageNumber, volumeId, selectedText, comment: null, tags: [], createdAt: '2026-08-07T00:00:00Z' }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(tagApi.listTags).mockResolvedValue([])
})

it('shows a spinner while loading', () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockReturnValue(new Promise(() => {}))

  render(<TimelineBar activeTagId={null} selectedVolumeId={null} onSelectVolume={vi.fn()} />, { wrapper })

  expect(screen.getByRole('status')).toBeInTheDocument()
})

it('shows an error message when the request fails', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockRejectedValue(new Error('HTTP 500'))

  render(<TimelineBar activeTagId={null} selectedVolumeId={null} onSelectVolume={vi.fn()} />, { wrapper })

  expect(await screen.findByRole('alert')).toBeInTheDocument()
})

it('renders one bookmark per saved quote', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({
    volumes,
    quotes: [makeQuote(1, 9, 1), makeQuote(2, 150, 2)],
  })

  render(<TimelineBar activeTagId={null} selectedVolumeId={null} onSelectVolume={vi.fn()} />, { wrapper })

  expect(await screen.findByRole('button', { name: 'Citation page 9' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Citation page 150' })).toBeInTheDocument()
})

it('zooming by clicking directly on a volume zone in the bar hides bookmarks from other volumes', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({
    volumes,
    quotes: [makeQuote(1, 9, 1), makeQuote(2, 150, 2)],
  })
  const user = userEvent.setup()

  render(<ControlledTimelineBar activeTagId={null} />, { wrapper })
  await screen.findByRole('button', { name: 'Citation page 150' })

  await user.click(screen.getByRole('button', { name: 'Zoomer sur Du Côté de Chez Swann' }))

  expect(screen.getByRole('button', { name: 'Citation page 9' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Citation page 150' })).not.toBeInTheDocument()
})

it('keeps the selected volume zone reachable while hiding the others from the accessibility tree', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({
    volumes,
    quotes: [makeQuote(1, 9, 1), makeQuote(2, 150, 2)],
  })
  const user = userEvent.setup()

  const { container } = render(<ControlledTimelineBar activeTagId={null} />, { wrapper })
  await screen.findByRole('button', { name: 'Zoomer sur Du Côté de Chez Swann' })

  await user.click(screen.getByRole('button', { name: 'Zoomer sur Du Côté de Chez Swann' }))

  // The selected zone stays reachable — its accessible name now reflects that clicking it again
  // zooms back out, not further in.
  expect(screen.getByRole('button', { name: 'Revenir à tous les tomes' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Zoomer sur Du Côté de Chez Swann' })).not.toBeInTheDocument()

  // The other volume's zone is unreachable via role query — aria-hidden + tabIndex={-1}, not just
  // visually faded via CSS pointer-events. Note: `{ hidden: true }` does *not* help here — per the
  // ARIA spec aria-hidden removes the element's exposed role entirely, so role-based queries can't
  // find it even with that option; a direct DOM query is the only way to check it is still mounted.
  expect(screen.queryByRole('button', { name: "Zoomer sur À l'Ombre des Jeunes Filles en Fleurs" })).not.toBeInTheDocument()
  // ...but still physically in the DOM (kept mounted on purpose, for the CSS opacity transition).
  expect(container.querySelector('[aria-label="Zoomer sur À l\'Ombre des Jeunes Filles en Fleurs"]')).toBeInTheDocument()
})

it('returns to the full view when selectedVolumeId goes back to null', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({
    volumes,
    quotes: [makeQuote(1, 9, 1), makeQuote(2, 150, 2)],
  })

  const { rerender } = render(<TimelineBar activeTagId={null} selectedVolumeId={1} onSelectVolume={vi.fn()} />, { wrapper })
  await screen.findByRole('button', { name: 'Citation page 9' })
  expect(screen.queryByRole('button', { name: 'Citation page 150' })).not.toBeInTheDocument()

  rerender(<TimelineBar activeTagId={null} selectedVolumeId={null} onSelectVolume={vi.fn()} />)

  expect(screen.getByRole('button', { name: 'Citation page 9' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Citation page 150' })).toBeInTheDocument()
})

it('clicking a bookmark opens the quote in a modal', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({
    volumes,
    quotes: [makeQuote(1, 9, 1, 'Il y avait déjà bien des années')],
  })
  const user = userEvent.setup()

  render(<TimelineBar activeTagId={null} selectedVolumeId={null} onSelectVolume={vi.fn()} />, { wrapper })
  await user.click(await screen.findByRole('button', { name: 'Citation page 9' }))

  expect(screen.getByText('Il y avait déjà bien des années')).toBeInTheDocument()
})

it('hovering a bookmark shows a preview, leaving hides it', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({
    volumes,
    quotes: [makeQuote(1, 9, 1, 'Il y avait déjà bien des années')],
  })
  const user = userEvent.setup()

  render(<TimelineBar activeTagId={null} selectedVolumeId={null} onSelectVolume={vi.fn()} />, { wrapper })
  const bookmark = await screen.findByRole('button', { name: 'Citation page 9' })

  await user.hover(bookmark)
  expect(screen.getByRole('tooltip')).toHaveTextContent('Il y avait déjà bien des années')

  await user.unhover(bookmark)
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})

it('refetches with the active tag filter', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({ volumes, quotes: [] })
  const tagId = '00000000-0000-4000-8000-000000000101'

  render(<TimelineBar activeTagId={tagId} selectedVolumeId={null} onSelectVolume={vi.fn()} />, { wrapper })

  await waitFor(() => {
    expect(quoteApi.getQuoteTimeline).toHaveBeenCalledWith({ tagId }, expect.anything())
  })
})
