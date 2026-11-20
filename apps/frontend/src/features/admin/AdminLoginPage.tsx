import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useState } from 'react'
import { adminLogin } from '../../api/admin'
import type { AdminLoginParams } from '../../api/admin'
import { ApiError } from '../../api/client'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import FormField from '../auth/FormField/FormField'
import { setAuthenticatedUser } from '../auth/useCurrentUser'
import authFormStyles from '../auth/AuthForm.module.css'
import authPageStyles from '../auth/AuthPage.module.css'

export default function AdminLoginPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [form, setForm] = useState<AdminLoginParams>({ email: '', password: '', code: '' })
  const mutation = useMutation({
    mutationFn: (params: AdminLoginParams) => adminLogin(params),
    onSuccess: user => {
      setAuthenticatedUser(queryClient, user)
      navigate('/admin')
    },
  })

  const errorMessage = mutation.error instanceof ApiError && mutation.error.status === 429
    ? t('adminLogin.tooManyAttempts')
    : t('adminLogin.invalidCredentials')

  return (
    <main className={authPageStyles.root}>
      <h1 className={authPageStyles.title}>{t('adminLogin.title')}</h1>
      <form className={authFormStyles.root} onSubmit={event => { event.preventDefault(); mutation.mutate(form) }}>
        <FormField
          label={t('adminLogin.emailLabel')}
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
        />
        <FormField
          label={t('adminLogin.passwordLabel')}
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
        />
        <FormField
          label={t('adminLogin.codeLabel')}
          type="text"
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={64}
          required
          value={form.code}
          onChange={event => setForm(current => ({ ...current, code: event.target.value }))}
        />
        <button className={authFormStyles.button} type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('adminLogin.submitting') : t('adminLogin.submit')}
        </button>
      </form>
      {mutation.isError && <ErrorMessage message={errorMessage} />}
    </main>
  )
}
