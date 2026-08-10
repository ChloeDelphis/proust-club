import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { ReactNode } from 'react'
import MyQuotesPage from './MyQuotesPage'
import * as authApi from '../../../api/auth'
import * as quoteApi from '../../../api/quote'
import * as tagApi from '../../../api/tag'
import { ApiError } from '../../../api/client'
import ToastProvider from '../../../components/Toast/ToastProvider'
import type { QuoteSelectionListResponse } from '../../../api/quote'

vi.mock('../../../api/auth')
vi.mock('../../../api/quote')
vi.mock('../../../api/tag')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/mes-citations']}>
          <Routes>
            <Route path="/mes-citations" element={children} />
            <Route path="/login" element={<div>Page de connexion</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

const connectedUser: authApi.UserResponse = {
  uuid: '11111111-1111-1111-1111-111111111111',
  username: 'marcel',
  email: 'marcel@example.com',
  role: 'USER',
}

function makeQuote(id: number): QuoteSelectionListResponse['results'][number] {
  return {
    id,
    paragraphId: 42,
    startOffset: 0,
    endOffset: 11,
    selectedText: `citation ${id}`,
    comment: null,
    tags: [],
    createdAt: '2026-08-05T00:00:00Z',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(tagApi.listTags).mockResolvedValue([{ id: 1, name: 'Combray' }])
  // TimelineBar renders nothing when there are no volumes — a safe default that doesn't
  // interfere with the assertions below, which are about the list/pagination underneath it.
  vi.mocked(quoteApi.getQuoteTimeline).mockResolvedValue({ volumes: [], quotes: [] })
})

it('redirects to /login when not connected', async () => {
  vi.mocked(authApi.getCurrentUser).mockRejectedValue(new ApiError(401))

  render(<MyQuotesPage />, { wrapper })

  expect(await screen.findByText('Page de connexion')).toBeInTheDocument()
})

describe('connected', () => {
  beforeEach(() => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(connectedUser)
  })

  it('shows an empty state when there are no quotes', async () => {
    vi.mocked(quoteApi.listQuotes).mockResolvedValue({ results: [], total: 0, page: 0, size: 10 })

    render(<MyQuotesPage />, { wrapper })

    expect(await screen.findByText('Aucune citation sauvegardée pour le moment.')).toBeInTheDocument()
  })

  it('shows an error message if the request fails', async () => {
    vi.mocked(quoteApi.listQuotes).mockRejectedValue(new Error('HTTP 500'))

    render(<MyQuotesPage />, { wrapper })

    expect(await screen.findByText('Une erreur est survenue. Veuillez réessayer.')).toBeInTheDocument()
  })

  it('lists the quotes, most recent first as returned by the API', async () => {
    vi.mocked(quoteApi.listQuotes).mockResolvedValue({
      results: [makeQuote(2), makeQuote(1)],
      total: 2,
      page: 0,
      size: 10,
    })

    render(<MyQuotesPage />, { wrapper })

    expect(await screen.findByText('citation 2')).toBeInTheDocument()
    expect(screen.getByText('citation 1')).toBeInTheDocument()
    expect(quoteApi.listQuotes).toHaveBeenCalledWith({ tagId: undefined, page: 0, size: 10 }, expect.anything())
  })

  it('resets the page to 0 when the tag filter changes', async () => {
    vi.mocked(quoteApi.listQuotes).mockImplementation(params =>
      Promise.resolve({
        results: Array.from({ length: 10 }, (_, i) => makeQuote(i)),
        total: 25,
        page: params?.page ?? 0,
        size: 10,
      }),
    )

    render(<MyQuotesPage />, { wrapper })
    await screen.findByText('citation 0')

    await userEvent.click(screen.getByRole('button', { name: 'Suivant →' }))
    await screen.findByText('2 / 3')

    await userEvent.click(await screen.findByRole('button', { name: 'Combray' }))

    expect(quoteApi.listQuotes).toHaveBeenLastCalledWith({ tagId: 1, page: 0, size: 10 }, expect.anything())
  })
})
