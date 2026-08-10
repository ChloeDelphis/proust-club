import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { ReactNode } from 'react'
import ForgotPasswordPage from './ForgotPasswordPage'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'

vi.mock('../../api/auth')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/forgot-password']}>
        <Routes>
          <Route path="/forgot-password" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ForgotPasswordPage', () => {
  it('valide la saisie avant envoi et ne déclenche pas de requête', async () => {
    render(<ForgotPasswordPage />, { wrapper })

    await userEvent.click(screen.getByRole('button', { name: 'Envoyer le lien de réinitialisation' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(authApi.requestPasswordReset).not.toHaveBeenCalled()
  })

  it('transmet la bonne demande et affiche le message générique de confirmation', async () => {
    vi.mocked(authApi.requestPasswordReset).mockResolvedValue(undefined)

    render(<ForgotPasswordPage />, { wrapper })

    await userEvent.type(screen.getByLabelText('Email'), 'marcel@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer le lien de réinitialisation' }))

    expect(authApi.requestPasswordReset).toHaveBeenCalledWith({ email: 'marcel@example.com' })
    expect(await screen.findByText(/vient d’être envoyé/)).toBeInTheDocument()
  })

  it("affiche un message d'erreur si la requête échoue", async () => {
    vi.mocked(authApi.requestPasswordReset).mockRejectedValue(new ApiError(400))

    render(<ForgotPasswordPage />, { wrapper })

    await userEvent.type(screen.getByLabelText('Email'), 'marcel@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer le lien de réinitialisation' }))

    expect(await screen.findByText('Adresse email invalide.')).toBeInTheDocument()
  })
})
