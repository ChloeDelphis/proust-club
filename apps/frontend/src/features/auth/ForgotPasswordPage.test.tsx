import { act, fireEvent, render, screen } from '@testing-library/react'
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

    await userEvent.click(screen.getByRole('button', { name: 'Envoyer le lien' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(authApi.requestPasswordReset).not.toHaveBeenCalled()
  })

  it('transmet la bonne demande et affiche le message générique de confirmation', async () => {
    vi.mocked(authApi.requestPasswordReset).mockResolvedValue(undefined)

    render(<ForgotPasswordPage />, { wrapper })

    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'marcel@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer le lien' }))

    expect(authApi.requestPasswordReset).toHaveBeenCalledWith({ email: 'marcel@example.com' })
    expect(await screen.findByRole('status')).toHaveTextContent('Si un compte est associé à cette adresse')
    expect(screen.queryByLabelText('Adresse e-mail')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Renvoyer le lien' })).toBeDisabled()
  })

  it("affiche un message générique si la requête échoue", async () => {
    vi.mocked(authApi.requestPasswordReset).mockRejectedValue(new ApiError(500))

    render(<ForgotPasswordPage />, { wrapper })

    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'marcel@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer le lien' }))

    expect(await screen.findByText('Une erreur est survenue. Réessayez.')).toBeInTheDocument()
  })

  it("affiche un message dédié si le backend rejette le format de l'email (400)", async () => {
    vi.mocked(authApi.requestPasswordReset).mockRejectedValue(new ApiError(400))

    render(<ForgotPasswordPage />, { wrapper })

    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'marcel@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer le lien' }))

    expect(await screen.findByText('Adresse email invalide.')).toBeInTheDocument()
  })

  it('affiche un message dédié en cas de rate limiting (429)', async () => {
    vi.mocked(authApi.requestPasswordReset).mockRejectedValue(new ApiError(429))

    render(<ForgotPasswordPage />, { wrapper })

    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'marcel@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer le lien' }))

    expect(await screen.findByText('Trop de tentatives. Réessayez plus tard.')).toBeInTheDocument()
  })

  it('autorise une nouvelle demande après cinq minutes', async () => {
    vi.useFakeTimers()
    vi.mocked(authApi.requestPasswordReset).mockResolvedValue(undefined)

    try {
      render(<ForgotPasswordPage />, { wrapper })

      fireEvent.change(screen.getByLabelText('Adresse e-mail'), { target: { value: 'marcel@example.com' } })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Envoyer le lien' }))
        await Promise.resolve()
        await Promise.resolve()
      })
      const resendButton = screen.getByRole('button', { name: 'Renvoyer le lien' })

      expect(resendButton).toBeDisabled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
      })

      expect(resendButton).toBeEnabled()
      await act(async () => {
        fireEvent.click(resendButton)
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(authApi.requestPasswordReset).toHaveBeenCalledTimes(2)
      expect(authApi.requestPasswordReset).toHaveBeenLastCalledWith({ email: 'marcel@example.com' })
    } finally {
      vi.useRealTimers()
    }
  })
})
