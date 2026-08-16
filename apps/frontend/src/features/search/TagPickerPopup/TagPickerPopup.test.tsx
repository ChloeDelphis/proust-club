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
    render(<TagPickerPopup onSave={vi.fn()} onCancel={vi.fn()} isSaving={false} />, { wrapper })

    expect(await screen.findByText('Combray')).toBeInTheDocument()
    expect(screen.getByText('Jalousie')).toBeInTheDocument()
  })

  it('filters the list as the user types', async () => {
    render(<TagPickerPopup onSave={vi.fn()} onCancel={vi.fn()} isSaving={false} />, { wrapper })
    await screen.findByText('Combray')

    await userEvent.type(screen.getByRole('textbox', { name: 'Chercher un tag' }), 'comb')

    expect(screen.getByText('Combray')).toBeInTheDocument()
    expect(screen.queryByText('Jalousie')).not.toBeInTheDocument()
  })

  it('calls onSave with the checked tag names', async () => {
    const onSave = vi.fn()
    render(<TagPickerPopup onSave={onSave} onCancel={vi.fn()} isSaving={false} />, { wrapper })
    await screen.findByText('Combray')

    await userEvent.click(screen.getByRole('checkbox', { name: 'Combray' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(onSave).toHaveBeenCalledWith(['Combray'])
  })

  it('calls onSave with an empty array when nothing is checked', async () => {
    const onSave = vi.fn()
    render(<TagPickerPopup onSave={onSave} onCancel={vi.fn()} isSaving={false} />, { wrapper })
    await screen.findByText('Combray')

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(onSave).toHaveBeenCalledWith([])
  })

  it('offers to create a new tag when the search matches nothing existing', async () => {
    render(<TagPickerPopup onSave={vi.fn()} onCancel={vi.fn()} isSaving={false} />, { wrapper })
    await screen.findByText('Combray')

    await userEvent.type(screen.getByRole('textbox', { name: 'Chercher un tag' }), 'Guermantes')

    expect(screen.getByRole('button', { name: 'Créer « Guermantes »' })).toBeInTheDocument()
  })

  it('does not offer to create a tag that already exists (case-insensitive)', async () => {
    render(<TagPickerPopup onSave={vi.fn()} onCancel={vi.fn()} isSaving={false} />, { wrapper })
    await screen.findByText('Combray')

    await userEvent.type(screen.getByRole('textbox', { name: 'Chercher un tag' }), 'combray')

    expect(screen.queryByRole('button', { name: /Créer/ })).not.toBeInTheDocument()
  })

  it('adds a newly created tag to the selection and includes it on Enregistrer', async () => {
    const onSave = vi.fn()
    render(<TagPickerPopup onSave={onSave} onCancel={vi.fn()} isSaving={false} />, { wrapper })
    await screen.findByText('Combray')

    await userEvent.type(screen.getByRole('textbox', { name: 'Chercher un tag' }), 'Guermantes')
    await userEvent.click(screen.getByRole('button', { name: 'Créer « Guermantes »' }))
    expect(screen.getByText('Guermantes')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(onSave).toHaveBeenCalledWith(['Guermantes'])
  })

  it('removes a selected chip when its × is clicked', async () => {
    const onSave = vi.fn()
    render(<TagPickerPopup onSave={onSave} onCancel={vi.fn()} isSaving={false} />, { wrapper })
    await screen.findByText('Combray')

    await userEvent.click(screen.getByRole('checkbox', { name: 'Combray' }))
    await userEvent.click(screen.getByRole('button', { name: 'Retirer Combray' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(onSave).toHaveBeenCalledWith([])
  })

  it('calls onCancel, not onSave, when the close button is clicked', async () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(<TagPickerPopup onSave={onSave} onCancel={onCancel} isSaving={false} />, { wrapper })
    await screen.findByText('Combray')

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('calls onCancel, not onSave, when clicking the backdrop outside the popup', async () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(<TagPickerPopup onSave={onSave} onCancel={onCancel} isSaving={false} />, { wrapper })
    await screen.findByText('Combray')

    await userEvent.click(screen.getByTestId('tag-picker-backdrop'))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('calls onCancel, not onSave, when Escape is pressed', async () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(<TagPickerPopup onSave={onSave} onCancel={onCancel} isSaving={false} />, { wrapper })
    await screen.findByText('Combray')

    await userEvent.keyboard('{Escape}')

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('disables Enregistrer while a save is already in flight', async () => {
    render(<TagPickerPopup onSave={vi.fn()} onCancel={vi.fn()} isSaving={true} />, { wrapper })
    await screen.findByText('Combray')

    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  })

  it('checking a tag and pressing Escape still cancels without saving it', async () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(<TagPickerPopup onSave={onSave} onCancel={onCancel} isSaving={false} />, { wrapper })
    await screen.findByText('Combray')

    await userEvent.click(screen.getByRole('checkbox', { name: 'Combray' }))
    await userEvent.keyboard('{Escape}')

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })
})
