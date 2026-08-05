import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import SearchPage from './SearchPage'
import * as searchApi from '../../api/search'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'
import ToastProvider from '../../components/Toast/ToastProvider'

vi.mock('../../api/search')
vi.mock('../../api/auth')

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

  it('valide la saisie avant envoi et ne déclenche pas de requête', async () => {
    render(<SearchPage />, { wrapper })

    await userEvent.type(screen.getByRole('searchbox'), 'a')
    await userEvent.click(screen.getByRole('button', { name: 'Chercher' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(searchApi.searchParagraphs).not.toHaveBeenCalled()
  })
})
