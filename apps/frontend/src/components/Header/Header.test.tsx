import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import type { ReactNode } from 'react'
import Header from './Header'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'
import GuestQuoteSaveProvider from '../../features/search/GuestQuoteSaveProvider'
import VolumeSelectionProvider from '../../features/search/VolumeSelectionProvider'

vi.mock('../../api/auth')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <GuestQuoteSaveProvider>
          <VolumeSelectionProvider>{children}</VolumeSelectionProvider>
        </GuestQuoteSaveProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const mockUser: authApi.UserResponse = {
  uuid: '11111111-1111-1111-1111-111111111111',
  username: 'marcel',
  email: 'marcel@example.com',
  role: 'USER',
  emailVerified: true,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Header', () => {
  it('affiche les liens connexion/inscription dans le menu si personne n’est connecté', async () => {
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new ApiError(401))
    const user = userEvent.setup()

    render(<Header />, { wrapper })

    await user.click(await screen.findByRole('button', { name: 'Ouvrir le menu du compte' }))
    expect(await screen.findByRole('menuitem', { name: 'Se connecter' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Créer un compte' })).toBeInTheDocument()
  })

  it('affiche un avatar portant le nom d’utilisateur connecté, dont le menu permet de se déconnecter', async () => {
    let loggedIn = true
    vi.mocked(authApi.getCurrentUser).mockImplementation(() =>
      loggedIn ? Promise.resolve(mockUser) : Promise.reject(new ApiError(401)),
    )
    vi.mocked(authApi.logout).mockImplementation(() => {
      loggedIn = false
      return Promise.resolve(undefined)
    })
    const user = userEvent.setup()

    render(<Header />, { wrapper })

    const avatar = await screen.findByRole('button', { name: 'Connecté en tant que marcel' })
    await user.click(avatar)

    expect(await screen.findByRole('menuitem', { name: 'Mon compte' })).toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Se déconnecter' }))

    expect(await screen.findByRole('link', { name: 'Se connecter' })).toBeInTheDocument()
  })
})
