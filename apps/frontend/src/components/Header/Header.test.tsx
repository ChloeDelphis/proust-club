import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import type { ReactNode } from 'react'
import Header from './Header'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'

vi.mock('../../api/auth')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const mockUser: authApi.UserResponse = {
  uuid: '11111111-1111-1111-1111-111111111111',
  username: 'marcel',
  email: 'marcel@example.com',
  role: 'USER',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Header', () => {
  it('affiche les liens connexion/inscription si personne n’est connecté', async () => {
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new ApiError(401))

    render(<Header />, { wrapper })

    expect(await screen.findByRole('link', { name: 'Se connecter' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Créer un compte' })).toBeInTheDocument()
  })

  it('affiche le nom d’utilisateur connecté et repasse en état déconnecté après logout', async () => {
    let loggedIn = true
    vi.mocked(authApi.getCurrentUser).mockImplementation(() =>
      loggedIn ? Promise.resolve(mockUser) : Promise.reject(new ApiError(401)),
    )
    vi.mocked(authApi.logout).mockImplementation(() => {
      loggedIn = false
      return Promise.resolve(undefined)
    })

    render(<Header />, { wrapper })

    expect(await screen.findByText('Connecté en tant que marcel')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))

    expect(await screen.findByRole('link', { name: 'Se connecter' })).toBeInTheDocument()
  })
})
