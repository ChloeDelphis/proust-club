import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import SearchPage from './features/search/SearchPage'
import LoginPage from './features/auth/LoginPage'
import RegisterPage from './features/auth/RegisterPage'
import ForgotPasswordPage from './features/auth/ForgotPasswordPage'
import ResetPasswordPage from './features/auth/ResetPasswordPage'
import ConfirmEmailPage from './features/auth/ConfirmEmailPage'
import AccountPage from './features/auth/AccountPage'
import Header from './components/Header/Header'
import EmailVerificationBanner from './components/EmailVerificationBanner/EmailVerificationBanner'
import ToastProvider from './components/Toast/ToastProvider'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from './features/auth/useCurrentUser'
import ErrorMessage from './components/ErrorMessage/ErrorMessage'
import GuestQuoteSaveProvider from './features/search/GuestQuoteSaveProvider'

const queryClient = new QueryClient()

function CurrentUserErrorNotice() {
  const { t } = useTranslation()
  const { isError } = useCurrentUser()

  return isError ? <ErrorMessage message={t('common.genericError')} /> : null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <GuestQuoteSaveProvider>
            <Header />
            <CurrentUserErrorNotice />
            <EmailVerificationBanner />
            <Routes>
              <Route path="/" element={<SearchPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/confirm-email" element={<ConfirmEmailPage />} />
              <Route path="/account" element={<AccountPage />} />
              {/* /mes-citations is now part of the unified search page (select the "saved citations"
                  scope there) — this redirect keeps the old URL from 404ing. */}
              <Route path="/mes-citations" element={<Navigate to="/" replace />} />
            </Routes>
          </GuestQuoteSaveProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
