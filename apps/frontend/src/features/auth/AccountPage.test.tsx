import { render, screen, within } from '@testing-library/react'
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
            <Route path="/" element={<div>Accueil</div>} />
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
  username: 'marcel-long-username',
  email: 'marcel@example.com',
  role: 'USER',
  emailVerified: true,
}

async function openPasswordForm() {
  await userEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
  expect(screen.queryByRole('heading', { name: 'Mot de passe' })).not.toBeInTheDocument()
  expect(screen.getByText('Choisissez un mot de passe d’au moins 15 caractères. Une phrase fonctionne très bien.')).toBeInTheDocument()
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
    await openPasswordForm()

    await userEvent.type(await screen.findByLabelText('Mot de passe actuel'), 'ancien-mot-de-passe-long')
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'court')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(authApi.changePassword).not.toHaveBeenCalled()
  })

  it('shows a green length confirmation once the new password reaches the minimum', async () => {
    render(<AccountPage />, { wrapper })
    await openPasswordForm()

    const passwordInput = screen.getByLabelText('Nouveau mot de passe')
    await userEvent.type(passwordInput, '12345678901234')

    expect(screen.getByText('Longueur insuffisante.')).toBeInTheDocument()
    expect(screen.getByText('Choisissez un mot de passe d’au moins 15 caractères. Une phrase fonctionne très bien.')).toBeInTheDocument()

    await userEvent.type(passwordInput, '5')

    expect(screen.getByText('Longueur suffisante.')).toBeInTheDocument()
    expect(screen.getByText('Choisissez un mot de passe d’au moins 15 caractères. Une phrase fonctionne très bien.')).toBeInTheDocument()
  })

  it('rejects a new password matching the username before calling the API', async () => {
    render(<AccountPage />, { wrapper })
    await openPasswordForm()

    await userEvent.type(await screen.findByLabelText('Mot de passe actuel'), 'ancien-mot-de-passe-long')
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'MARCEL-LONG-USERNAME')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(screen.getByText('Le mot de passe doit être différent des identifiants du compte.')).toBeInTheDocument()
    expect(authApi.changePassword).not.toHaveBeenCalled()
  })

  it('submits current and new password then shows a confirmation toast', async () => {
    vi.mocked(authApi.changePassword).mockResolvedValue(undefined)

    render(<AccountPage />, { wrapper })
    await openPasswordForm()

    await userEvent.type(await screen.findByLabelText('Mot de passe actuel'), 'ancien-mot-de-passe-long')
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'nouveau-mot-de-passe-long')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(authApi.changePassword).toHaveBeenCalledWith({
      currentPassword: 'ancien-mot-de-passe-long',
      newPassword: 'nouveau-mot-de-passe-long',
    })
    expect(await screen.findByText('Mot de passe changé.')).toBeInTheDocument()
  })

  it('shows a dedicated message when the current password is incorrect', async () => {
    vi.mocked(authApi.changePassword).mockRejectedValue(new ApiError(401))

    render(<AccountPage />, { wrapper })
    await openPasswordForm()

    await userEvent.type(await screen.findByLabelText('Mot de passe actuel'), 'mauvais-mot-de-passe')
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'nouveau-mot-de-passe-long')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Mot de passe actuel incorrect.')).toBeInTheDocument()
  })

  it('shows a dedicated message when the new password is compromised (breach-check)', async () => {
    vi.mocked(authApi.changePassword).mockRejectedValue(new ApiError(422))

    render(<AccountPage />, { wrapper })
    await openPasswordForm()

    await userEvent.type(await screen.findByLabelText('Mot de passe actuel'), 'ancien-mot-de-passe-long')
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'nouveau-mot-de-passe-long')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Ce mot de passe est trop commun. Choisissez-en un autre.')).toBeInTheDocument()
  })

  it('shows the identifier policy message returned by the server', async () => {
    vi.mocked(authApi.changePassword).mockRejectedValue(new ApiError(400, 'password_matches_identifier'))

    render(<AccountPage />, { wrapper })
    await openPasswordForm()

    await userEvent.type(await screen.findByLabelText('Mot de passe actuel'), 'ancien-mot-de-passe-long')
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'mot-de-passe-different')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Le mot de passe doit être différent des identifiants du compte.')).toBeInTheDocument()
  })

  it('shows a generic message on an unexpected server error', async () => {
    vi.mocked(authApi.changePassword).mockRejectedValue(new ApiError(500))

    render(<AccountPage />, { wrapper })
    await openPasswordForm()

    await userEvent.type(await screen.findByLabelText('Mot de passe actuel'), 'ancien-mot-de-passe-long')
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'nouveau-mot-de-passe-long')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Le changement de mot de passe a échoué. Réessayez.')).toBeInTheDocument()
  })

  it('re-authenticates, deletes the account and returns to the home page', async () => {
    vi.mocked(authApi.deleteAccount).mockResolvedValue(undefined)

    render(<AccountPage />, { wrapper })

    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer mon compte' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Supprimer mon compte ?' })).toBeInTheDocument()
    expect(within(dialog).getByText('Vos citations enregistrées, vos listes et vos annotations seront définitivement supprimées.')).toBeInTheDocument()
    expect(within(dialog).getByText('Pour confirmer la suppression, saisissez votre mot de passe.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Supprimer mon compte' })).toBeDisabled()
    await userEvent.type(await screen.findByLabelText('Mot de passe actuel'), 'mot-de-passe-actuel')
    expect(within(dialog).getByRole('button', { name: 'Supprimer mon compte' })).toBeEnabled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Supprimer mon compte' }))

    expect(authApi.deleteAccount).toHaveBeenCalledWith({ currentPassword: 'mot-de-passe-actuel' })
    expect(await screen.findByText('Accueil')).toBeInTheDocument()
    expect(await screen.findByText('Votre compte et vos données personnelles ont été supprimés.')).toBeInTheDocument()
  })

  it('keeps the deletion dialog open when the current password is incorrect', async () => {
    vi.mocked(authApi.deleteAccount).mockRejectedValue(new ApiError(401))

    render(<AccountPage />, { wrapper })

    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer mon compte' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(await screen.findByLabelText('Mot de passe actuel'), 'mauvais-mot-de-passe')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Supprimer mon compte' }))

    expect(await screen.findByText('Mot de passe actuel incorrect.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Supprimer mon compte' })).toBeInTheDocument()
  })
})
