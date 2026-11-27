import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import EmailVerificationReminder from './EmailVerificationReminder'
import EmailVerificationStatus from './EmailVerificationStatus'
import ToastProvider from '../../components/Toast/ToastProvider'
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
  emailVerified: false,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('email verification reminders', () => {
  it('shows a temporary reminder for a signed-in unverified user', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser)

    render(<EmailVerificationReminder />, { wrapper })

    expect(await screen.findByRole('status')).toHaveTextContent('Votre adresse e-mail reste à confirmer.')
  })

  it('does not show a reminder when there is no unverified account', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ ...mockUser, emailVerified: true })

    render(<EmailVerificationReminder />, { wrapper })

    await waitFor(() => expect(authApi.getCurrentUser).toHaveBeenCalled())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows the inline confirmation state and resends the link from the account page', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(authApi.resendEmailConfirmation).mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<EmailVerificationStatus />, { wrapper })

    expect(await screen.findByText('À confirmer')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Renvoyer le lien' }))

    expect(authApi.resendEmailConfirmation).toHaveBeenCalled()
    expect(await screen.findByText('Email de confirmation renvoyé.')).toBeInTheDocument()
  })

  it('refreshes the current user when the resend returns already confirmed', async () => {
    vi.mocked(authApi.getCurrentUser)
      .mockResolvedValueOnce(mockUser)
      .mockResolvedValueOnce({ ...mockUser, emailVerified: true })
    vi.mocked(authApi.resendEmailConfirmation).mockRejectedValue(new ApiError(409))
    const user = userEvent.setup()

    render(<EmailVerificationStatus />, { wrapper })

    await user.click(await screen.findByRole('button', { name: 'Renvoyer le lien' }))

    await waitFor(() => expect(screen.queryByText('À confirmer')).not.toBeInTheDocument())
  })

  it('disables resend while the request is pending', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser)
    let resolveResend: () => void = () => {}
    vi.mocked(authApi.resendEmailConfirmation).mockReturnValue(
      new Promise<void>(resolve => {
        resolveResend = resolve
      }),
    )
    const user = userEvent.setup()

    render(<EmailVerificationStatus />, { wrapper })

    const resendButton = await screen.findByRole('button', { name: 'Renvoyer le lien' })
    await user.click(resendButton)
    expect(resendButton).toBeDisabled()

    resolveResend()
    await waitFor(() => expect(resendButton).not.toBeDisabled())
  })
})
