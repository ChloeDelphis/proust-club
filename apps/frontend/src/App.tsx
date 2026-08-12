import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router'
import SearchPage from './features/search/SearchPage'
import LoginPage from './features/auth/LoginPage'
import RegisterPage from './features/auth/RegisterPage'
import ForgotPasswordPage from './features/auth/ForgotPasswordPage'
import ResetPasswordPage from './features/auth/ResetPasswordPage'
import ConfirmEmailPage from './features/auth/ConfirmEmailPage'
import AccountPage from './features/auth/AccountPage'
import MyQuotesPage from './features/quotes/MyQuotesPage/MyQuotesPage'
import Header from './components/Header/Header'
import EmailVerificationBanner from './components/EmailVerificationBanner/EmailVerificationBanner'
import ToastProvider from './components/Toast/ToastProvider'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Header />
          <EmailVerificationBanner />
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/confirm-email" element={<ConfirmEmailPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/mes-citations" element={<MyQuotesPage />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
