import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { ReactNode } from 'react'
import ResetPasswordPage from './ResetPasswordPage'
import ToastProvider from '../../components/Toast/ToastProvider'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'

vi.mock('../../api/auth')

function wrapperWithPath(path: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/reset-password" element={children} />
              <Route path="/" element={<div>Page de recherche</div>} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    )
  }
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

describe('ResetPasswordPage', () => {
  it('affiche un message si le lien ne contient pas de token', () => {
    render(<ResetPasswordPage />, { wrapper: wrapperWithPath('/reset-password') })

    expect(screen.getByText('Ce lien de réinitialisation est invalide.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nouveau mot de passe')).not.toBeInTheDocument()
  })

  it('valide la saisie avant envoi et ne déclenche pas de requête', async () => {
    render(<ResetPasswordPage />, { wrapper: wrapperWithPath('/reset-password?token=abc123') })

    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(authApi.confirmPasswordReset).not.toHaveBeenCalled()
  })

  it('transmet le token et le nouveau mot de passe puis redirige', async () => {
    vi.mocked(authApi.confirmPasswordReset).mockResolvedValue(mockUser)

    render(<ResetPasswordPage />, { wrapper: wrapperWithPath('/reset-password?token=abc123') })

    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'nouveau-mot-de-passe-long')
    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }))

    expect(authApi.confirmPasswordReset).toHaveBeenCalledWith({
      token: 'abc123',
      newPassword: 'nouveau-mot-de-passe-long',
    })
    expect(await screen.findByText('Page de recherche')).toBeInTheDocument()
  })

  it('affiche un message si le token est invalide ou expiré', async () => {
    vi.mocked(authApi.confirmPasswordReset).mockRejectedValue(new ApiError(400))

    render(<ResetPasswordPage />, { wrapper: wrapperWithPath('/reset-password?token=abc123') })

    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'nouveau-mot-de-passe-long')
    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }))

    expect(await screen.findByText('Ce lien de réinitialisation est invalide ou a expiré.')).toBeInTheDocument()
  })
})
