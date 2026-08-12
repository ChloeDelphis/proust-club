import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { ReactNode } from 'react'
import AccountPage from './AccountPage'
import ToastProvider from '../../components/Toast/ToastProvider'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'

vi.mock('../../api/auth')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/account']}>
          <Routes>
            <Route path="/account" element={children} />
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

beforeEach(() => {
  vi.clearAllMocks()
})

it('redirects to /login when not connected', async () => {
  vi.mocked(authApi.getCurrentUser).mockRejectedValue(new ApiError(401))

  render(<AccountPage />, { wrapper })

  expect(await screen.findByText('Page de connexion')).toBeInTheDocument()
})

describe('connected', () => {
  beforeEach(() => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(connectedUser)
  })

  it('validates the new password client-side and does not call the API', async () => {
    render(<AccountPage />, { wrapper })

    await userEvent.type(await screen.findByLabelText('Mot de passe actuel'), 'ancien-mot-de-passe-long')
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'court')
    await userEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(authApi.changePassword).not.toHaveBeenCalled()
  })

  it('submits current and new password then shows a confirmation toast', async () => {
    vi.mocked(authApi.changePassword).mockResolvedValue(undefined)

    render(<AccountPage />, { wrapper })

    await userEvent.type(await screen.findByLabelText('Mot de passe actuel'), 'ancien-mot-de-passe-long')
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'nouveau-mot-de-passe-long')
    await userEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }))

    expect(authApi.changePassword).toHaveBeenCalledWith({
      currentPassword: 'ancien-mot-de-passe-long',
      newPassword: 'nouveau-mot-de-passe-long',
    })
    expect(await screen.findByText('Mot de passe changé.')).toBeInTheDocument()
  })

  it('shows a dedicated message when the current password is incorrect', async () => {
    vi.mocked(authApi.changePassword).mockRejectedValue(new ApiError(401))

    render(<AccountPage />, { wrapper })

    await userEvent.type(await screen.findByLabelText('Mot de passe actuel'), 'mauvais-mot-de-passe')
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'nouveau-mot-de-passe-long')
    await userEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }))

    expect(await screen.findByText('Mot de passe actuel incorrect.')).toBeInTheDocument()
  })

  it('shows a generic message on an unexpected server error', async () => {
    vi.mocked(authApi.changePassword).mockRejectedValue(new ApiError(500))

    render(<AccountPage />, { wrapper })

    await userEvent.type(await screen.findByLabelText('Mot de passe actuel'), 'ancien-mot-de-passe-long')
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'nouveau-mot-de-passe-long')
    await userEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }))

    expect(await screen.findByText('Le changement de mot de passe a échoué. Réessayez.')).toBeInTheDocument()
  })
})
