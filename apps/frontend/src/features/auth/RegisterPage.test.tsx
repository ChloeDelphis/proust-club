import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { ReactNode } from 'react'
import RegisterPage from './RegisterPage'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'

vi.mock('../../api/auth')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={children} />
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

describe('RegisterPage', () => {
  it('valide la saisie avant envoi et ne déclenche pas de requête', async () => {
    render(<RegisterPage />, { wrapper })

    await userEvent.type(screen.getByLabelText('Nom d’utilisateur'), 'ab')
    await userEvent.click(screen.getByRole('button', { name: 'Créer un compte' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(authApi.register).not.toHaveBeenCalled()
  })

  it('transmet les bons paramètres et redirige après inscription', async () => {
    vi.mocked(authApi.register).mockResolvedValue(mockUser)

    render(<RegisterPage />, { wrapper })

    await userEvent.type(screen.getByLabelText('Nom d’utilisateur'), 'marcel')
    await userEvent.type(screen.getByLabelText('Email'), 'marcel@example.com')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'hunter2222password')
    await userEvent.click(screen.getByRole('button', { name: 'Créer un compte' }))

    expect(authApi.register).toHaveBeenCalledWith({
      username: 'marcel',
      email: 'marcel@example.com',
      password: 'hunter2222password',
    })
    expect(await screen.findByText('Page de recherche')).toBeInTheDocument()
  })

  it('affiche une erreur si le nom d’utilisateur ou l’email est déjà pris', async () => {
    vi.mocked(authApi.register).mockRejectedValue(new ApiError(409))

    render(<RegisterPage />, { wrapper })

    await userEvent.type(screen.getByLabelText('Nom d’utilisateur'), 'marcel')
    await userEvent.type(screen.getByLabelText('Email'), 'marcel@example.com')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'hunter2222password')
    await userEvent.click(screen.getByRole('button', { name: 'Créer un compte' }))

    expect(
      await screen.findByText('Impossible de créer ce compte (nom d’utilisateur ou email déjà utilisé).'),
    ).toBeInTheDocument()
  })
})
