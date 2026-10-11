import { render, screen } from '@testing-library/react'
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

const COMBRAY_ID = '00000000-0000-4000-8000-000000000101'
const BALBEC_ID = '00000000-0000-4000-8000-000000000102'

const TAGS = [
  { id: COMBRAY_ID, name: 'Combray', colorIndex: 0 },
  { id: BALBEC_ID, name: 'Balbec', colorIndex: 1 },
]

function noop() {}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(tagApi.listTags).mockResolvedValue(TAGS)
})

it('still shows the saved-citations entry when there are no tags', async () => {
  vi.mocked(tagApi.listTags).mockResolvedValue([])
  render(
    <TagFilterBar scope="corpus" activeTagId={null} onSelectSavedScope={noop} onSelectTag={noop} onSelectCorpusScope={noop} />,
    { wrapper },
  )

  expect(await screen.findByRole('button', { name: 'Mes citations enregistrées' })).toBeInTheDocument()
})

it('renders the saved-citations entry and one button per tag, calling the right handler on click', async () => {
  const onSelectSavedScope = vi.fn()
  const onSelectTag = vi.fn()
  render(
    <TagFilterBar scope="corpus" activeTagId={null} onSelectSavedScope={onSelectSavedScope} onSelectTag={onSelectTag} onSelectCorpusScope={noop} />,
    { wrapper },
  )

  expect(await screen.findByRole('button', { name: 'Mes citations enregistrées' })).toBeInTheDocument()
  await userEvent.click(await screen.findByRole('button', { name: 'Combray' }))
  expect(onSelectTag).toHaveBeenCalledWith(COMBRAY_ID)

  await userEvent.click(screen.getByRole('button', { name: 'Mes citations enregistrées' }))
  expect(onSelectSavedScope).toHaveBeenCalled()
})

it('clicking the already-active tag calls onSelectCorpusScope instead of onSelectTag', async () => {
  const onSelectCorpusScope = vi.fn()
  render(
    <TagFilterBar scope="saved" activeTagId={COMBRAY_ID} onSelectSavedScope={noop} onSelectTag={vi.fn()} onSelectCorpusScope={onSelectCorpusScope} />,
    { wrapper },
  )

  await userEvent.click(await screen.findByRole('button', { name: 'Combray' }))

  expect(onSelectCorpusScope).toHaveBeenCalled()
})

it('clicking the already-active saved-citations entry calls onSelectCorpusScope', async () => {
  const onSelectCorpusScope = vi.fn()
  render(
    <TagFilterBar scope="saved" activeTagId={null} onSelectSavedScope={vi.fn()} onSelectTag={noop} onSelectCorpusScope={onSelectCorpusScope} />,
    { wrapper },
  )

  await userEvent.click(await screen.findByRole('button', { name: 'Mes citations enregistrées' }))

  expect(onSelectCorpusScope).toHaveBeenCalled()
})

it('renames a tag on Enter', async () => {
  vi.mocked(tagApi.renameTag).mockResolvedValue({ id: COMBRAY_ID, name: 'Combray renommé', colorIndex: 0 })
  render(
    <TagFilterBar scope="corpus" activeTagId={null} onSelectSavedScope={noop} onSelectTag={noop} onSelectCorpusScope={noop} />,
    { wrapper },
  )

  await userEvent.click(await screen.findByRole('button', { name: 'Renommer Combray' }))
  const input = screen.getByRole('textbox', { name: 'Renommer Combray' })
  await userEvent.clear(input)
  await userEvent.type(input, 'Combray renommé{Enter}')

  expect(tagApi.renameTag).toHaveBeenCalledWith(COMBRAY_ID, { name: 'Combray renommé' })
})

it('cancels the edit on Escape without renaming', async () => {
  render(
    <TagFilterBar scope="corpus" activeTagId={null} onSelectSavedScope={noop} onSelectTag={noop} onSelectCorpusScope={noop} />,
    { wrapper },
  )

  await userEvent.click(await screen.findByRole('button', { name: 'Renommer Combray' }))
  const input = screen.getByRole('textbox', { name: 'Renommer Combray' })
  await userEvent.type(input, ' modifié{Escape}')

  expect(tagApi.renameTag).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Combray' })).toBeInTheDocument()
})

it('commits the edit on blur', async () => {
  vi.mocked(tagApi.renameTag).mockResolvedValue({ id: COMBRAY_ID, name: 'Combray modifié', colorIndex: 0 })
  render(
    <div>
      <TagFilterBar scope="corpus" activeTagId={null} onSelectSavedScope={noop} onSelectTag={noop} onSelectCorpusScope={noop} />
      <button type="button">ailleurs</button>
    </div>,
    { wrapper },
  )

  await userEvent.click(await screen.findByRole('button', { name: 'Renommer Combray' }))
  const input = screen.getByRole('textbox', { name: 'Renommer Combray' })
  await userEvent.clear(input)
  await userEvent.type(input, 'Combray modifié')
  await userEvent.click(screen.getByRole('button', { name: 'ailleurs' }))

  expect(tagApi.renameTag).toHaveBeenCalledWith(COMBRAY_ID, { name: 'Combray modifié' })
})

it('shows an error toast on a 409 conflict and keeps editing', async () => {
  vi.mocked(tagApi.renameTag).mockRejectedValue(new ApiError(409))
  render(
    <TagFilterBar scope="corpus" activeTagId={null} onSelectSavedScope={noop} onSelectTag={noop} onSelectCorpusScope={noop} />,
    { wrapper },
  )

  await userEvent.click(await screen.findByRole('button', { name: 'Renommer Combray' }))
  const input = screen.getByRole('textbox', { name: 'Renommer Combray' })
  await userEvent.type(input, ' bis{Enter}')

  expect(await screen.findByText('Ce nom de tag est déjà utilisé.')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Renommer Combray' })).toBeInTheDocument()
})

it('does nothing if the delete confirmation is declined', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(
    <TagFilterBar scope="corpus" activeTagId={null} onSelectSavedScope={noop} onSelectTag={noop} onSelectCorpusScope={noop} />,
    { wrapper },
  )

  await userEvent.click(await screen.findByRole('button', { name: 'Supprimer Combray' }))

  expect(tagApi.deleteTag).not.toHaveBeenCalled()
})

it('deletes a tag when the confirmation is accepted, falling back to the saved scope if it was active', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.mocked(tagApi.deleteTag).mockResolvedValue(undefined)
  const onSelectSavedScope = vi.fn()
  render(
    <TagFilterBar scope="saved" activeTagId={COMBRAY_ID} onSelectSavedScope={onSelectSavedScope} onSelectTag={vi.fn()} onSelectCorpusScope={noop} />,
    { wrapper },
  )

  await userEvent.click(await screen.findByRole('button', { name: 'Supprimer Combray' }))

  expect(tagApi.deleteTag).toHaveBeenCalledWith(COMBRAY_ID)
  expect(onSelectSavedScope).toHaveBeenCalled()
})
