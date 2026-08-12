import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { ReactNode } from 'react'
import ConfirmEmailPage from './ConfirmEmailPage'
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
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/confirm-email" element={children} />
            <Route path="/" element={<div>Page de recherche</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ConfirmEmailPage', () => {
  it('affiche un message si le lien ne contient pas de token', () => {
    render(<ConfirmEmailPage />, { wrapper: wrapperWithPath('/confirm-email') })

    expect(screen.getByText('Ce lien de confirmation est invalide.')).toBeInTheDocument()
    expect(authApi.confirmEmail).not.toHaveBeenCalled()
  })

  it('confirme automatiquement avec le token de l’URL et affiche un message de succès', async () => {
    vi.mocked(authApi.confirmEmail).mockResolvedValue(undefined)

    render(<ConfirmEmailPage />, { wrapper: wrapperWithPath('/confirm-email?token=abc123') })

    expect(await screen.findByText('Votre adresse email a été confirmée.')).toBeInTheDocument()
    expect(authApi.confirmEmail).toHaveBeenCalledWith({ token: 'abc123' })
    expect(authApi.confirmEmail).toHaveBeenCalledTimes(1)
  })

  it('affiche un message si le token est invalide ou expiré', async () => {
    vi.mocked(authApi.confirmEmail).mockRejectedValue(new ApiError(400))

    render(<ConfirmEmailPage />, { wrapper: wrapperWithPath('/confirm-email?token=abc123') })

    expect(await screen.findByText('Ce lien de confirmation est invalide ou a expiré.')).toBeInTheDocument()
  })
})
