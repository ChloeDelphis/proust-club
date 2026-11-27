import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import type { ReactNode } from 'react'
import EmailVerificationReminder from './EmailVerificationReminder'
import EmailVerificationStatus from './EmailVerificationStatus'
import AccountPageContent from './AccountPageContent'
import useEmailVerificationReminderVisibility from './useEmailVerificationReminderVisibility'
import { emailVerificationResendCooldownStorageKey } from './emailVerificationCooldown'
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
      <ToastProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </ToastProvider>
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
  localStorage.clear()
})

describe('email verification reminders', () => {
  it('reveals the shared reminder state after one second only for unverified users', () => {
    vi.useFakeTimers()
    const { result, unmount } = renderHook(() =>
      useEmailVerificationReminderVisibility(mockUser, true, 123),
    )

    expect(result.current).toBe(false)
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current).toBe(true)
    unmount()

    const verifiedUser = { ...mockUser, emailVerified: true }
    const verified = renderHook(() =>
      useEmailVerificationReminderVisibility(verifiedUser, true, 124),
    )
    expect(verified.result.current).toBe(false)
    verified.unmount()
    vi.useRealTimers()
  })

  it('shows a temporary reminder for a signed-in unverified user', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser)

    render(<EmailVerificationReminder isVisible />, { wrapper })

    expect(await screen.findByRole('status', {}, { timeout: 2000 }))
      .toHaveTextContent('Veuillez confirmer votre adresse e-mail.')
  })

  it('does not show a reminder when there is no unverified account', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ ...mockUser, emailVerified: true })

    render(<EmailVerificationReminder isVisible={false} />, { wrapper })

    await waitFor(() => expect(authApi.getCurrentUser).toHaveBeenCalled())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows the inline confirmation state and resends the link from the account page', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(authApi.resendEmailConfirmation).mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<EmailVerificationStatus cooldown={null} />, { wrapper })

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

    render(<EmailVerificationStatus cooldown={null} />, { wrapper })

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

    render(<EmailVerificationStatus cooldown={null} />, { wrapper })

    const resendButton = await screen.findByRole('button', { name: 'Renvoyer le lien' })
    await user.click(resendButton)
    expect(resendButton).toBeDisabled()

    resolveResend()
    await waitFor(() => expect(resendButton).not.toBeDisabled())
  })

  it('keeps resend disabled after a reload while the server cooldown is active', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(authApi.resendEmailConfirmation).mockImplementation(async options => {
      options?.onCooldown?.(60)
    })
    const user = userEvent.setup()

    const firstPage = render(<AccountPageContent currentUser={mockUser} />, { wrapper })
    await user.click(await screen.findByRole('button', { name: 'Renvoyer le lien' }))

    expect(await screen.findByText('Vous pourrez renvoyer un lien dans environ 1 min.')).toBeInTheDocument()
    firstPage.unmount()

    render(<AccountPageContent currentUser={mockUser} />, { wrapper })

    expect(await screen.findByRole('button', { name: 'Renvoyer le lien' })).toBeDisabled()
  })

  it('syncs the resend cooldown from another tab', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser)
    render(<AccountPageContent currentUser={mockUser} />, { wrapper })

    const resendButton = await screen.findByRole('button', { name: 'Renvoyer le lien' })
    const key = emailVerificationResendCooldownStorageKey(mockUser.uuid)
    const cooldown = { until: Date.now() + 60_000, displaySeconds: 60 }
    const newValue = JSON.stringify(cooldown)
    localStorage.setItem(key!, newValue)

    window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea: localStorage }))

    await waitFor(() => expect(resendButton).toBeDisabled())
  })
})
