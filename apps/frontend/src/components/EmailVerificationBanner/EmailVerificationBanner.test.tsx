import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import EmailVerificationBanner from './EmailVerificationBanner'
import ToastProvider from '../Toast/ToastProvider'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'

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

describe('EmailVerificationBanner', () => {
  it('ne s’affiche pas si personne n’est connecté', async () => {
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new ApiError(401))

    render(<EmailVerificationBanner />, { wrapper })

    await waitFor(() => expect(authApi.getCurrentUser).toHaveBeenCalled())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('ne s’affiche pas si l’email est déjà confirmé', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser)

    render(<EmailVerificationBanner />, { wrapper })

    await waitFor(() => expect(authApi.getCurrentUser).toHaveBeenCalled())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('s’affiche si l’email n’est pas confirmé', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ ...mockUser, emailVerified: false })

    render(<EmailVerificationBanner />, { wrapper })

    expect(await screen.findByRole('status')).toHaveTextContent('Confirmez votre adresse email')
  })

  it('renvoie l’email de confirmation et affiche un toast de succès', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ ...mockUser, emailVerified: false })
    vi.mocked(authApi.resendEmailConfirmation).mockResolvedValue(undefined)

    render(<EmailVerificationBanner />, { wrapper })

    await userEvent.click(await screen.findByRole('button', { name: "Renvoyer l'email de confirmation" }))

    expect(authApi.resendEmailConfirmation).toHaveBeenCalled()
    expect(await screen.findByText('Email de confirmation renvoyé.')).toBeInTheDocument()
  })

  it('affiche un message dédié en cas de dépassement du rate limit', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ ...mockUser, emailVerified: false })
    vi.mocked(authApi.resendEmailConfirmation).mockRejectedValue(new ApiError(429))

    render(<EmailVerificationBanner />, { wrapper })

    await userEvent.click(await screen.findByRole('button', { name: "Renvoyer l'email de confirmation" }))

    expect(await screen.findByText('Trop de tentatives. Réessayez plus tard.')).toBeInTheDocument()
  })

  it('désactive le bouton pendant l’envoi', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ ...mockUser, emailVerified: false })
    let resolveResend: () => void = () => {}
    vi.mocked(authApi.resendEmailConfirmation).mockReturnValue(
      new Promise<void>(resolve => {
        resolveResend = resolve
      }),
    )

    render(<EmailVerificationBanner />, { wrapper })

    const button = await screen.findByRole('button', { name: "Renvoyer l'email de confirmation" })
    await userEvent.click(button)

    expect(button).toBeDisabled()

    resolveResend()
    await waitFor(() => expect(button).not.toBeDisabled())
  })
})
