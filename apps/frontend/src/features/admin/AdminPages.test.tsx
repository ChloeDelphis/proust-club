import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { ReactNode } from 'react'
import AdminLoginPage from './AdminLoginPage'
import AdminDashboardPage from './AdminDashboardPage'
import * as adminApi from '../../api/admin'
import * as authApi from '../../api/auth'

vi.mock('../../api/admin')
vi.mock('../../api/auth')

const adminUser: authApi.UserResponse = {
  uuid: '11111111-1111-1111-1111-111111111111',
  username: null,
  email: 'admin@example.com',
  role: 'ADMIN',
  emailVerified: true,
}

function loginWrapper(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/admin/login" element={children} />
            <Route path="/admin" element={<div>Tableau de bord ouvert</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
}

function dashboardWrapper(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/admin" element={children} />
            <Route path="/admin/login" element={<div>Connexion admin</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
}

beforeEach(() => vi.clearAllMocks())

describe('AdminLoginPage', () => {
  it('transmet le second facteur au backend et ouvre le tableau de bord', async () => {
    vi.mocked(adminApi.adminLogin).mockResolvedValue(adminUser)
    const Wrapper = loginWrapper('/admin/login')

    render(<AdminLoginPage />, { wrapper: Wrapper })
    await userEvent.type(screen.getByLabelText('Adresse email'), 'admin@example.com')
    const passwordInput = screen.getByLabelText('Mot de passe')
    await userEvent.type(passwordInput, 'secret')
    expect(passwordInput).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }))
    expect(passwordInput).toHaveAttribute('type', 'text')
    await userEvent.type(screen.getByLabelText('Code TOTP'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir la session' }))

    expect(adminApi.adminLogin).toHaveBeenCalledWith({ email: 'admin@example.com', password: 'secret', code: '123456' })
    expect(await screen.findByText('Tableau de bord ouvert')).toBeInTheDocument()
  })
})

describe('AdminDashboardPage', () => {
  it('affiche les chiffres agrégés et enregistre les préférences de notification', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(adminUser)
    vi.mocked(adminApi.getAdminDashboard).mockResolvedValue({
      registeredUsers: 14,
      savedQuotes: 63,
      tags: 8,
      dailyMetrics: [{ date: '2026-11-20', registrations: 2, deletions: 1 }],
      notifications: { registrationsEnabled: true, deletionsEnabled: true },
      rangeStart: '2026-10-22',
      rangeEnd: '2026-11-20',
    })
    vi.mocked(adminApi.updateAdminNotifications).mockResolvedValue({
      registrationsEnabled: false,
      deletionsEnabled: true,
    })
    const Wrapper = dashboardWrapper('/admin')

    render(<AdminDashboardPage />, { wrapper: Wrapper })
    expect(await screen.findByText('14')).toBeInTheDocument()
    expect(screen.getByText('Comptes utilisateurs')).toBeInTheDocument()
    expect(screen.getByText('63')).toBeInTheDocument()
    expect(screen.getByText('Tags')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'M’avertir à chaque nouvelle inscription' }))

    expect(adminApi.updateAdminNotifications).toHaveBeenCalledWith({
      registrationsEnabled: false,
      deletionsEnabled: true,
    })
  })

  it('renvoie un compte standard vers la connexion admin', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ ...adminUser, role: 'USER' })
    const Wrapper = dashboardWrapper('/admin')

    render(<AdminDashboardPage />, { wrapper: Wrapper })

    expect(await screen.findByText('Connexion admin')).toBeInTheDocument()
    expect(adminApi.getAdminDashboard).not.toHaveBeenCalled()
  })
})
