import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { ReactNode } from 'react'
import LoginPage from './LoginPage'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'

vi.mock('../../api/auth')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={children} />
          <Route path="/" element={<div>Page de recherche</div>} />
        </Routes>
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

describe('LoginPage', () => {
  it('valide la saisie avant envoi et ne déclenche pas de requête', async () => {
    render(<LoginPage />, { wrapper })

    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(authApi.login).not.toHaveBeenCalled()
  })

  it('transmet les bons paramètres et redirige après connexion', async () => {
    vi.mocked(authApi.login).mockResolvedValue(mockUser)

    render(<LoginPage />, { wrapper })

    await userEvent.type(screen.getByLabelText('Nom d’utilisateur'), 'marcel')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'hunter2222')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(authApi.login).toHaveBeenCalledWith({ username: 'marcel', password: 'hunter2222' })
    expect(await screen.findByText('Page de recherche')).toBeInTheDocument()
  })

  it("affiche un message d'erreur si les identifiants sont invalides", async () => {
    vi.mocked(authApi.login).mockRejectedValue(new ApiError(401))

    render(<LoginPage />, { wrapper })

    await userEvent.type(screen.getByLabelText('Nom d’utilisateur'), 'marcel')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByText('Identifiants invalides.')).toBeInTheDocument()
  })
})
