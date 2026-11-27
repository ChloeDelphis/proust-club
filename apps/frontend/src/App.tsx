import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import SearchPage from './features/search/SearchPage'
import LoginPage from './features/auth/LoginPage'
import RegisterPage from './features/auth/RegisterPage'
import ForgotPasswordPage from './features/auth/ForgotPasswordPage'
import ResetPasswordPage from './features/auth/ResetPasswordPage'
import ConfirmEmailPage from './features/auth/ConfirmEmailPage'
import AccountPage from './features/auth/AccountPage'
import Header from './components/Header/Header'
import EmailVerificationReminder from './features/auth/EmailVerificationReminder'
import ToastProvider from './components/Toast/ToastProvider'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from './features/auth/useCurrentUser'
import ErrorMessage from './components/ErrorMessage/ErrorMessage'
import GuestQuoteSaveProvider from './features/search/GuestQuoteSaveProvider'
import VolumeSelectionProvider from './features/search/VolumeSelectionProvider'
import AdminLoginPage from './features/admin/AdminLoginPage'
import AdminDashboardPage from './features/admin/AdminDashboardPage'

const queryClient = new QueryClient()

function CurrentUserErrorNotice() {
  const { t } = useTranslation()
  const { isError } = useCurrentUser()

  return isError ? <ErrorMessage message={t('common.genericError')} /> : null
}

function AppChrome() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/admin')) return null
  return <>
    <Header />
    <CurrentUserErrorNotice />
    <EmailVerificationReminder />
  </>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <GuestQuoteSaveProvider>
            <VolumeSelectionProvider>
              <AppChrome />
              <Routes>
                <Route path="/" element={<SearchPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/confirm-email" element={<ConfirmEmailPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/admin/login" element={<AdminLoginPage />} />
                <Route path="/admin" element={<AdminDashboardPage />} />
                {/* /mes-citations is now part of the unified search page (select the "saved citations"
                  scope there) — this redirect keeps the old URL from 404ing. */}
                <Route path="/mes-citations" element={<Navigate to="/" replace />} />
              </Routes>
            </VolumeSelectionProvider>
          </GuestQuoteSaveProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
