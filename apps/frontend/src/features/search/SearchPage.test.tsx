import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import SearchPage from './SearchPage'
import * as searchApi from '../../api/search'
import * as authApi from '../../api/auth'
import * as quoteApi from '../../api/quote'
import * as tagApi from '../../api/tag'
import { ApiError } from '../../api/client'
import ToastProvider from '../../components/Toast/ToastProvider'
import { quoteId } from '../quotes/TimelineBar/timelineTestFixtures'

vi.mock('../../api/search')
vi.mock('../../api/auth')
vi.mock('../../api/quote')
vi.mock('../../api/tag')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}

const mockHit: searchApi.SearchHit = {
  paragraphId: 1,
  text: 'Longtemps, je me suis couché de bonne heure.',
  startOffset: 0,
  endOffset: 9,
  volume: 'Du côté de chez Swann',
  part: 'Combray',
  pageNumber: 1,
}

const mockResponse: searchApi.SearchResponse = {
  results: [mockHit],
  total: 1,
  page: 0,
  size: 10,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(authApi.getCurrentUser).mockRejectedValue(new ApiError(401))
})

describe('SearchPage', () => {
  it('affiche les résultats après une recherche', async () => {
    vi.mocked(searchApi.searchParagraphs).mockResolvedValue(mockResponse)

    render(<SearchPage />, { wrapper })

    await userEvent.type(screen.getByRole('searchbox'), 'Longtemps')
    await userEvent.click(screen.getByRole('button', { name: 'Chercher' }))

    expect(await screen.findByText(/Du côté de chez Swann/)).toBeInTheDocument()
    expect(screen.getByText(/Longtemps/)).toBeInTheDocument()
  })

  it('transmet les bons paramètres à searchParagraphs', async () => {
    vi.mocked(searchApi.searchParagraphs).mockResolvedValue(mockResponse)

    render(<SearchPage />, { wrapper })

    await userEvent.type(screen.getByRole('searchbox'), 'petite madeleine')
    await userEvent.click(screen.getByRole('button', { name: 'Chercher' }))

    await screen.findByText(/Du côté de chez Swann/)

    expect(searchApi.searchParagraphs).toHaveBeenCalledWith(
      { q: 'petite madeleine', page: 0, size: 10 },
      expect.any(AbortSignal),
    )
  })

  it('affiche le spinner pendant le chargement', async () => {
    let settle = () => {}
    vi.mocked(searchApi.searchParagraphs).mockImplementation(
      () => new Promise(resolve => { settle = () => resolve(mockResponse) }),
    )

    render(<SearchPage />, { wrapper })

    await userEvent.type(screen.getByRole('searchbox'), 'Longtemps')
    await userEvent.click(screen.getByRole('button', { name: 'Chercher' }))

    expect(await screen.findByRole('status')).toBeInTheDocument()

    settle()
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it("affiche un message d'erreur si l'API échoue", async () => {
    vi.mocked(searchApi.searchParagraphs).mockRejectedValue(new Error('HTTP 500'))

    render(<SearchPage />, { wrapper })

    await userEvent.type(screen.getByRole('searchbox'), 'Longtemps')
    await userEvent.click(screen.getByRole('button', { name: 'Chercher' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('affiche un état vide si aucun résultat', async () => {
    vi.mocked(searchApi.searchParagraphs).mockResolvedValue({
      results: [],
      total: 0,
      page: 0,
      size: 10,
    })

    render(<SearchPage />, { wrapper })

    await userEvent.type(screen.getByRole('searchbox'), 'xyzzy')
    await userEvent.click(screen.getByRole('button', { name: 'Chercher' }))

    expect(await screen.findByText(/Aucun résultat/)).toBeInTheDocument()
  })

  it('ne déclenche pas de requête tant que la saisie fait moins de 2 caractères', async () => {
    render(<SearchPage />, { wrapper })

    await userEvent.type(screen.getByRole('searchbox'), 'a')
    await userEvent.click(screen.getByRole('button', { name: 'Chercher' }))

    expect(await screen.findByText("Tapez une recherche pour explorer l'œuvre.")).toBeInTheDocument()
    expect(searchApi.searchParagraphs).not.toHaveBeenCalled()
  })

  it('le bouton effacer vide la recherche', async () => {
    vi.mocked(searchApi.searchParagraphs).mockResolvedValue(mockResponse)
    const user = userEvent.setup()

    render(<SearchPage />, { wrapper })
    await user.type(screen.getByRole('searchbox'), 'Longtemps')
    await user.click(screen.getByRole('button', { name: 'Chercher' }))
    await screen.findByText(/Du côté de chez Swann/)

    await user.click(screen.getByRole('button', { name: 'Effacer la recherche' }))

    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(await screen.findByText("Tapez une recherche pour explorer l'œuvre.")).toBeInTheDocument()
  })

  it('invite à taper une recherche tant que le champ est vide, sans frise ni filtre par tag', async () => {
    render(<SearchPage />, { wrapper })

    expect(await screen.findByText("Tapez une recherche pour explorer l'œuvre.")).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Filtrer par tag' })).not.toBeInTheDocument()
  })
})

const connectedUser: authApi.UserResponse = {
  uuid: '11111111-1111-1111-1111-111111111111',
  username: 'marcel',
  email: 'marcel@example.com',
  role: 'USER',
  emailVerified: true,
}

const COMBRAY_TAG_ID = '00000000-0000-4000-8000-000000000101'

function makeQuote(n: number): quoteApi.QuoteSelectionListResponse['results'][number] {
  return {
    id: quoteId(n),
    paragraphId: 42,
    startOffset: 0,
    endOffset: 11,
    selectedText: `citation ${n}`,
    comment: null,
    tags: [],
    createdAt: '2026-08-05T00:00:00Z',
  }
}

describe('connected', () => {
  beforeEach(() => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(connectedUser)
    vi.mocked(tagApi.listTags).mockResolvedValue([{ id: COMBRAY_TAG_ID, name: 'Combray' }])
    vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({ volumes: [], quotes: [] })
  })

  it('shows the frieze, the volume sidebar, and the saved-citations scope by default stays on corpus search', async () => {
    render(<SearchPage />, { wrapper })

    expect(await screen.findByRole('navigation', { name: 'Filtrer par tag' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mes citations enregistrées' })).toBeInTheDocument()
    expect(screen.getByText("Tapez une recherche pour explorer l'œuvre.")).toBeInTheDocument()
    expect(quoteApi.listQuotes).not.toHaveBeenCalled()
  })

  it('switches to the saved-citations scope and lists them', async () => {
    vi.mocked(quoteApi.listQuotes).mockResolvedValue({ results: [makeQuote(1), makeQuote(2)], total: 2, page: 0, size: 10 })
    const user = userEvent.setup()

    render(<SearchPage />, { wrapper })
    await user.click(await screen.findByRole('button', { name: 'Mes citations enregistrées' }))

    expect(await screen.findByText('citation 1')).toBeInTheDocument()
    expect(screen.getByText('citation 2')).toBeInTheDocument()
    expect(quoteApi.listQuotes).toHaveBeenCalledWith({ tagId: undefined, q: undefined, page: 0, size: 10 }, expect.anything())
  })

  it('shows an empty state with no saved citations at all', async () => {
    vi.mocked(quoteApi.listQuotes).mockResolvedValue({ results: [], total: 0, page: 0, size: 10 })
    const user = userEvent.setup()

    render(<SearchPage />, { wrapper })
    await user.click(await screen.findByRole('button', { name: 'Mes citations enregistrées' }))

    expect(await screen.findByText('Aucune citation sauvegardée pour le moment.')).toBeInTheDocument()
  })

  it('filters saved citations by text once a search is submitted in the saved scope', async () => {
    vi.mocked(quoteApi.listQuotes).mockResolvedValue({ results: [makeQuote(1)], total: 1, page: 0, size: 10 })
    const user = userEvent.setup()

    render(<SearchPage />, { wrapper })
    await user.click(await screen.findByRole('button', { name: 'Mes citations enregistrées' }))
    await user.type(screen.getByRole('searchbox'), 'madeleine')
    await user.click(screen.getByRole('button', { name: 'Chercher' }))

    await waitFor(() =>
      expect(quoteApi.listQuotes).toHaveBeenLastCalledWith({ tagId: undefined, q: 'madeleine', page: 0, size: 10 }, expect.anything()),
    )
  })

  it('shows a text-match empty state (not the tag one) when no tag is active and a saved-scope search matches nothing', async () => {
    vi.mocked(quoteApi.listQuotes).mockResolvedValue({ results: [], total: 0, page: 0, size: 10 })
    const user = userEvent.setup()

    render(<SearchPage />, { wrapper })
    await user.click(await screen.findByRole('button', { name: 'Mes citations enregistrées' }))
    await user.type(screen.getByRole('searchbox'), 'guermantes')
    await user.click(screen.getByRole('button', { name: 'Chercher' }))

    expect(await screen.findByText('Aucune citation ne correspond à cette recherche.')).toBeInTheDocument()
    expect(screen.queryByText('Aucune citation avec ce tag.')).not.toBeInTheDocument()
  })

  it('clicking an already-active tag returns to corpus search', async () => {
    vi.mocked(quoteApi.listQuotes).mockResolvedValue({ results: [], total: 0, page: 0, size: 10 })
    const user = userEvent.setup()

    render(<SearchPage />, { wrapper })
    await user.click(await screen.findByRole('button', { name: 'Combray' }))
    await screen.findByText('Aucune citation avec ce tag.')

    await user.click(screen.getByRole('button', { name: 'Combray' }))

    expect(await screen.findByText("Tapez une recherche pour explorer l'œuvre.")).toBeInTheDocument()
  })
})
