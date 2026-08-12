import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import EmailVerificationBanner from './EmailVerificationBanner'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'

vi.mock('../../api/auth')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
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
})
