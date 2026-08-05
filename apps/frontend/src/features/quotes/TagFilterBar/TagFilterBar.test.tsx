import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import TagFilterBar from './TagFilterBar'
import * as tagApi from '../../../api/tag'
import { ApiError } from '../../../api/client'
import ToastProvider from '../../../components/Toast/ToastProvider'

vi.mock('../../../api/tag')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}

const TAGS = [
  { id: 1, name: 'Combray' },
  { id: 2, name: 'Balbec' },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(tagApi.listTags).mockResolvedValue(TAGS)
})

it('renders nothing while there are no tags', async () => {
  vi.mocked(tagApi.listTags).mockResolvedValue([])
  render(<TagFilterBar activeTagId={null} onSelectTag={vi.fn()} />, { wrapper })

  await waitFor(() => expect(tagApi.listTags).toHaveBeenCalled())
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
})

it('renders "Tous" and one button per tag, calling onSelectTag on click', async () => {
  const onSelectTag = vi.fn()
  render(<TagFilterBar activeTagId={null} onSelectTag={onSelectTag} />, { wrapper })

  expect(await screen.findByRole('button', { name: 'Tous' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Combray' }))

  expect(onSelectTag).toHaveBeenCalledWith(1)
})

it('renames a tag on Enter', async () => {
  vi.mocked(tagApi.renameTag).mockResolvedValue({ id: 1, name: 'Combray renommé' })
  render(<TagFilterBar activeTagId={null} onSelectTag={vi.fn()} />, { wrapper })

  await userEvent.click(await screen.findByRole('button', { name: 'Renommer Combray' }))
  const input = screen.getByRole('textbox', { name: 'Renommer Combray' })
  await userEvent.clear(input)
  await userEvent.type(input, 'Combray renommé{Enter}')

  expect(tagApi.renameTag).toHaveBeenCalledWith(1, { name: 'Combray renommé' })
})

it('cancels the edit on Escape without renaming', async () => {
  render(<TagFilterBar activeTagId={null} onSelectTag={vi.fn()} />, { wrapper })

  await userEvent.click(await screen.findByRole('button', { name: 'Renommer Combray' }))
  const input = screen.getByRole('textbox', { name: 'Renommer Combray' })
  await userEvent.type(input, ' modifié{Escape}')

  expect(tagApi.renameTag).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Combray' })).toBeInTheDocument()
})

it('commits the edit on blur', async () => {
  vi.mocked(tagApi.renameTag).mockResolvedValue({ id: 1, name: 'Combray modifié' })
  render(
    <div>
      <TagFilterBar activeTagId={null} onSelectTag={vi.fn()} />
      <button type="button">ailleurs</button>
    </div>,
    { wrapper },
  )

  await userEvent.click(await screen.findByRole('button', { name: 'Renommer Combray' }))
  const input = screen.getByRole('textbox', { name: 'Renommer Combray' })
  await userEvent.clear(input)
  await userEvent.type(input, 'Combray modifié')
  await userEvent.click(screen.getByRole('button', { name: 'ailleurs' }))

  expect(tagApi.renameTag).toHaveBeenCalledWith(1, { name: 'Combray modifié' })
})

it('shows an error toast on a 409 conflict and keeps editing', async () => {
  vi.mocked(tagApi.renameTag).mockRejectedValue(new ApiError(409))
  render(<TagFilterBar activeTagId={null} onSelectTag={vi.fn()} />, { wrapper })

  await userEvent.click(await screen.findByRole('button', { name: 'Renommer Combray' }))
  const input = screen.getByRole('textbox', { name: 'Renommer Combray' })
  await userEvent.type(input, ' bis{Enter}')

  expect(await screen.findByText('Ce nom de tag est déjà utilisé.')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Renommer Combray' })).toBeInTheDocument()
})

it('does nothing if the delete confirmation is declined', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<TagFilterBar activeTagId={null} onSelectTag={vi.fn()} />, { wrapper })

  await userEvent.click(await screen.findByRole('button', { name: 'Supprimer Combray' }))

  expect(tagApi.deleteTag).not.toHaveBeenCalled()
})

it('deletes a tag when the confirmation is accepted, clearing the filter if it was active', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.mocked(tagApi.deleteTag).mockResolvedValue(undefined)
  const onSelectTag = vi.fn()
  render(<TagFilterBar activeTagId={1} onSelectTag={onSelectTag} />, { wrapper })

  await userEvent.click(await screen.findByRole('button', { name: 'Supprimer Combray' }))

  expect(tagApi.deleteTag).toHaveBeenCalledWith(1)
  expect(onSelectTag).toHaveBeenCalledWith(null)
})
