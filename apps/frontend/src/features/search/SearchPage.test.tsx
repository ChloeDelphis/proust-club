import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import SearchPage from './SearchPage'
import * as searchApi from '../../api/search'
import * as authApi from '../../api/auth'
import * as quoteApi from '../../api/quote'
import * as tagApi from '../../api/tag'
import * as paragraphApi from '../../api/paragraph'
import { ApiError } from '../../api/client'
import ToastProvider from '../../components/Toast/ToastProvider'
import { quoteId } from '../quotes/TimelineBar/timelineTestFixtures'

vi.mock('../../api/search')
vi.mock('../../api/auth')
vi.mock('../../api/quote')
vi.mock('../../api/tag')
vi.mock('../../api/paragraph')

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
  vi.mocked(paragraphApi.getParagraphContext).mockResolvedValue({
    paragraphId: mockHit.paragraphId,
    before: [],
    after: [],
    hasMoreBefore: false,
    hasMoreAfter: false,
  })
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

  it('announces a result refresh while keeping prior results visible', async () => {
    let settleNextPage: ((response: searchApi.SearchResponse) => void) | undefined
    vi.mocked(searchApi.searchParagraphs)
      .mockResolvedValueOnce({ ...mockResponse, total: 11 })
      .mockImplementationOnce(
        () => new Promise(resolve => { settleNextPage = resolve }),
      )
    const user = userEvent.setup()

    render(<SearchPage />, { wrapper })
    await user.type(screen.getByRole('searchbox'), 'Longtemps')
    await user.click(screen.getByRole('button', { name: 'Chercher' }))
    await screen.findByText(/Du côté de chez Swann/)

    await user.click(screen.getByRole('button', { name: 'Suivant →' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Mise à jour des résultats…')
    expect(screen.getByText('Longtemps').closest('section')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText(/Du côté de chez Swann/)).toBeInTheDocument()

    expect(settleNextPage).toBeDefined()
    settleNextPage?.({
      results: [{ ...mockHit, paragraphId: 2, text: 'La page suivante.' }],
      total: 11,
      page: 1,
      size: 10,
    })

    expect(await screen.findByText('La page s')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    expect(screen.getByText('La page s').closest('section')).toHaveAttribute('aria-busy', 'false')
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

  it("ouvre le détail d'un résultat sans proposer de tags pour un visiteur non connecté", async () => {
    vi.mocked(searchApi.searchParagraphs).mockResolvedValue(mockResponse)
    const user = userEvent.setup()

    render(<SearchPage />, { wrapper })
    await userEvent.type(screen.getByRole('searchbox'), 'Longtemps')
    await userEvent.click(screen.getByRole('button', { name: 'Chercher' }))
    await screen.findByText(/Du côté de chez Swann/)

    await user.click(screen.getByRole('button', { name: 'Voir le détail' }))

    expect(await screen.findByRole('dialog', { name: 'Résultat de recherche' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Chercher un tag' })).not.toBeInTheDocument()
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
    vi.mocked(tagApi.listTags).mockResolvedValue([{ id: COMBRAY_TAG_ID, name: 'Combray', colorIndex: 0 }])
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

  it('saves a search result with chosen tags from its detail modal, then closes it', async () => {
    vi.mocked(searchApi.searchParagraphs).mockResolvedValue(mockResponse)
    vi.mocked(quoteApi.createQuote).mockResolvedValue({} as quoteApi.QuoteSelectionResponse)
    const user = userEvent.setup()

    render(<SearchPage />, { wrapper })
    await user.type(screen.getByRole('searchbox'), 'Longtemps')
    await user.click(screen.getByRole('button', { name: 'Chercher' }))
    await user.click(await screen.findByRole('button', { name: 'Voir le détail' }))

    await user.click(await screen.findByRole('checkbox', { name: 'Combray' }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(quoteApi.createQuote).toHaveBeenCalledWith({
      paragraphId: mockHit.paragraphId,
      startOffset: mockHit.startOffset,
      endOffset: mockHit.endOffset,
      selectedText: mockHit.text.slice(mockHit.startOffset, mockHit.endOffset),
      tagNames: ['Combray'],
    })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Résultat de recherche' })).not.toBeInTheDocument())
  })
})
