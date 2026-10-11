import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import VolumeList from './VolumeList'
import * as quoteApi from '../../../api/quote'
import type { TimelineResponse } from '../../../api/quote'

vi.mock('../../../api/quote')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const volumes: TimelineResponse['volumes'] = [
  { id: 1, title: 'Du Côté de Chez Swann', position: 1, minPage: 1, maxPage: 103 },
  { id: 2, title: "À l'Ombre des Jeunes Filles en Fleurs", position: 2, minPage: 104, maxPage: 183 },
]

// Controlled, same convention as TimelineBar's own test file — feeds selectedVolumeId back so
// clicking an entry can be observed (the active item highlighted, the callback having fired).
function ControlledVolumeList() {
  const [selectedVolumeId, setSelectedVolumeId] = useState<number | null>(null)
  return <VolumeList activeTagId={null} selectedVolumeId={selectedVolumeId} onSelectVolume={setSelectedVolumeId} />
}

beforeEach(() => {
  vi.clearAllMocks()
})

it('renders nothing once loaded if there are no volumes', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({ volumes: [], quotes: [] })

  const { container } = render(<VolumeList activeTagId={null} selectedVolumeId={null} onSelectVolume={vi.fn()} />, { wrapper })

  await waitFor(() => expect(quoteApi.getQuoteTimeline).toHaveBeenCalled())
  expect(container).toBeEmptyDOMElement()
})

it('shows a button for every volume, plus "Tous les tomes"', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({ volumes, quotes: [] })

  render(<VolumeList activeTagId={null} selectedVolumeId={null} onSelectVolume={vi.fn()} />, { wrapper })

  expect(await screen.findByRole('button', { name: 'Tous les tomes' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Du Côté de Chez Swann' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: "À l'Ombre des Jeunes Filles en Fleurs" })).toBeInTheDocument()
})

it('calls onSelectVolume with the volume id when an entry is clicked, and null for "Tous les tomes"', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({ volumes, quotes: [] })
  const onSelectVolume = vi.fn()
  const user = userEvent.setup()

  render(<VolumeList activeTagId={null} selectedVolumeId={null} onSelectVolume={onSelectVolume} />, { wrapper })
  await user.click(await screen.findByRole('button', { name: 'Du Côté de Chez Swann' }))
  expect(onSelectVolume).toHaveBeenLastCalledWith(1)

  await user.click(screen.getByRole('button', { name: 'Tous les tomes' }))
  expect(onSelectVolume).toHaveBeenLastCalledWith(null)
})

it('reflects the selected volume as the active entry', async () => {
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({ volumes, quotes: [] })
  const user = userEvent.setup()

  render(<ControlledVolumeList />, { wrapper })

  const allVolumes = await screen.findByRole('button', { name: 'Tous les tomes' })
  const firstVolume = screen.getByRole('button', { name: 'Du Côté de Chez Swann' })
  expect(allVolumes.className).toMatch(/isActive/)
  expect(firstVolume.className).not.toMatch(/isActive/)

  await user.click(firstVolume)

  expect(allVolumes.className).not.toMatch(/isActive/)
  expect(firstVolume.className).toMatch(/isActive/)
})
