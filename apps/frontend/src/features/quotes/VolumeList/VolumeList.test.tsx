import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import VolumeList from './VolumeList'
import * as volumeApi from '../../../api/volume'

vi.mock('../../../api/volume')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const volumes: volumeApi.VolumeResponse[] = [
  { id: 1, title: 'Du Côté de Chez Swann', position: 1, minPage: 1, maxPage: 103 },
  { id: 2, title: "À l'Ombre des Jeunes Filles en Fleurs", position: 2, minPage: 104, maxPage: 183 },
]

// Controlled, same convention as TimelineBar's own test file — feeds selectedVolumeId back so
// clicking an entry can be observed (the active item highlighted, the callback having fired).
function ControlledVolumeList() {
  const [selectedVolumeId, setSelectedVolumeId] = useState<number | null>(null)
  return <VolumeList selectedVolumeId={selectedVolumeId} onSelectVolume={setSelectedVolumeId} />
}

beforeEach(() => {
  vi.clearAllMocks()
})

it('renders nothing once loaded if there are no volumes', async () => {
  vi.mocked(volumeApi.getVolumes).mockResolvedValue([])

  const { container } = render(<VolumeList selectedVolumeId={null} onSelectVolume={vi.fn()} />, { wrapper })

  await waitFor(() => expect(volumeApi.getVolumes).toHaveBeenCalled())
  expect(container).toBeEmptyDOMElement()
})

it('shows a button for every volume', async () => {
  vi.mocked(volumeApi.getVolumes).mockResolvedValue(volumes)

  render(<VolumeList selectedVolumeId={null} onSelectVolume={vi.fn()} />, { wrapper })

  expect(await screen.findByRole('button', { name: 'Du Côté de Chez Swann' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: "À l'Ombre des Jeunes Filles en Fleurs" })).toBeInTheDocument()
})

it('calls onSelectVolume with the volume id when an entry is clicked', async () => {
  vi.mocked(volumeApi.getVolumes).mockResolvedValue(volumes)
  const onSelectVolume = vi.fn()
  const user = userEvent.setup()

  render(<VolumeList selectedVolumeId={null} onSelectVolume={onSelectVolume} />, { wrapper })
  await user.click(await screen.findByRole('button', { name: 'Du Côté de Chez Swann' }))

  expect(onSelectVolume).toHaveBeenCalledWith(1)
})

it('reflects the selected volume as the active entry', async () => {
  vi.mocked(volumeApi.getVolumes).mockResolvedValue(volumes)
  const user = userEvent.setup()

  render(<ControlledVolumeList />, { wrapper })

  const firstVolume = await screen.findByRole('button', { name: 'Du Côté de Chez Swann' })
  const secondVolume = screen.getByRole('button', { name: "À l'Ombre des Jeunes Filles en Fleurs" })
  expect(firstVolume.className).not.toMatch(/isActive/)
  expect(secondVolume.className).not.toMatch(/isActive/)

  await user.click(firstVolume)

  expect(firstVolume.className).toMatch(/isActive/)
  expect(secondVolume.className).not.toMatch(/isActive/)
})
