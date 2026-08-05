import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import TagPickerPopup from './TagPickerPopup'
import * as tagApi from '../../../api/tag'

vi.mock('../../../api/tag')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const existingTags: tagApi.TagResponse[] = [
  { id: 1, name: 'Combray' },
  { id: 2, name: 'Jalousie' },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(tagApi.listTags).mockResolvedValue(existingTags)
})

describe('TagPickerPopup', () => {
  it('lists the existing tags', async () => {
    render(<TagPickerPopup onFinish={vi.fn()} onDismiss={vi.fn()} />, { wrapper })

    expect(await screen.findByText('Combray')).toBeInTheDocument()
    expect(screen.getByText('Jalousie')).toBeInTheDocument()
  })

  it('filters the list as the user types', async () => {
    render(<TagPickerPopup onFinish={vi.fn()} onDismiss={vi.fn()} />, { wrapper })
    await screen.findByText('Combray')

    await userEvent.type(screen.getByRole('textbox', { name: 'Chercher un tag' }), 'comb')

    expect(screen.getByText('Combray')).toBeInTheDocument()
    expect(screen.queryByText('Jalousie')).not.toBeInTheDocument()
  })

  it('calls onFinish with the checked tag names', async () => {
    const onFinish = vi.fn()
    render(<TagPickerPopup onFinish={onFinish} onDismiss={vi.fn()} />, { wrapper })
    await screen.findByText('Combray')

    await userEvent.click(screen.getByRole('checkbox', { name: 'Combray' }))
    await userEvent.click(screen.getByRole('button', { name: 'Terminer' }))

    expect(onFinish).toHaveBeenCalledWith(['Combray'])
  })

  it('calls onFinish with an empty array when nothing is checked', async () => {
    const onFinish = vi.fn()
    render(<TagPickerPopup onFinish={onFinish} onDismiss={vi.fn()} />, { wrapper })
    await screen.findByText('Combray')

    await userEvent.click(screen.getByRole('button', { name: 'Terminer' }))

    expect(onFinish).toHaveBeenCalledWith([])
  })

  it('offers to create a new tag when the search matches nothing existing', async () => {
    render(<TagPickerPopup onFinish={vi.fn()} onDismiss={vi.fn()} />, { wrapper })
    await screen.findByText('Combray')

    await userEvent.type(screen.getByRole('textbox', { name: 'Chercher un tag' }), 'Guermantes')

    expect(screen.getByRole('button', { name: 'Créer « Guermantes »' })).toBeInTheDocument()
  })

  it('does not offer to create a tag that already exists (case-insensitive)', async () => {
    render(<TagPickerPopup onFinish={vi.fn()} onDismiss={vi.fn()} />, { wrapper })
    await screen.findByText('Combray')

    await userEvent.type(screen.getByRole('textbox', { name: 'Chercher un tag' }), 'combray')

    expect(screen.queryByRole('button', { name: /Créer/ })).not.toBeInTheDocument()
  })

  it('adds a newly created tag to the selection and includes it on Terminer', async () => {
    const onFinish = vi.fn()
    render(<TagPickerPopup onFinish={onFinish} onDismiss={vi.fn()} />, { wrapper })
    await screen.findByText('Combray')

    await userEvent.type(screen.getByRole('textbox', { name: 'Chercher un tag' }), 'Guermantes')
    await userEvent.click(screen.getByRole('button', { name: 'Créer « Guermantes »' }))
    expect(screen.getByText('Guermantes')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Terminer' }))

    expect(onFinish).toHaveBeenCalledWith(['Guermantes'])
  })

  it('removes a selected chip when its × is clicked', async () => {
    const onFinish = vi.fn()
    render(<TagPickerPopup onFinish={onFinish} onDismiss={vi.fn()} />, { wrapper })
    await screen.findByText('Combray')

    await userEvent.click(screen.getByRole('checkbox', { name: 'Combray' }))
    await userEvent.click(screen.getByRole('button', { name: 'Retirer Combray' }))
    await userEvent.click(screen.getByRole('button', { name: 'Terminer' }))

    expect(onFinish).toHaveBeenCalledWith([])
  })

  it('calls onDismiss when the close button is clicked', async () => {
    const onDismiss = vi.fn()
    render(<TagPickerPopup onFinish={vi.fn()} onDismiss={onDismiss} />, { wrapper })
    await screen.findByText('Combray')

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('calls onDismiss when clicking outside the popup', async () => {
    const onDismiss = vi.fn()
    render(
      <div>
        <button type="button">outside</button>
        <TagPickerPopup onFinish={vi.fn()} onDismiss={onDismiss} />
      </div>,
      { wrapper },
    )
    await screen.findByText('Combray')

    await userEvent.click(screen.getByText('outside'))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
