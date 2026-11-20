import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useState } from 'react'
import { adminLogin } from '../../api/admin'
import type { AdminLoginParams } from '../../api/admin'
import { ApiError } from '../../api/client'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import { setAuthenticatedUser } from '../auth/useCurrentUser'
import styles from './AdminLoginPage.module.css'

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
    <main className={styles.root}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>{t('adminLogin.eyebrow')}</p>
        <h1 className={styles.title}>{t('adminLogin.title')}</h1>
        <p className={styles.intro}>{t('adminLogin.intro')}</p>
        <form className={styles.form} onSubmit={event => { event.preventDefault(); mutation.mutate(form) }}>
          <label className={styles.field}>
            <span>{t('adminLogin.emailLabel')}</span>
            <input autoComplete="username" type="email" required value={form.email}
              onChange={event => setForm(current => ({ ...current, email: event.target.value }))} />
          </label>
          <label className={styles.field}>
            <span>{t('adminLogin.passwordLabel')}</span>
            <input autoComplete="current-password" type="password" required value={form.password}
              onChange={event => setForm(current => ({ ...current, password: event.target.value }))} />
          </label>
          <label className={styles.field}>
            <span>{t('adminLogin.codeLabel')}</span>
            <input autoComplete="one-time-code" inputMode="numeric" maxLength={64} required value={form.code}
              onChange={event => setForm(current => ({ ...current, code: event.target.value }))} />
            <span className={styles.help}>{t('adminLogin.codeHelp')}</span>
          </label>
          {mutation.isError && <ErrorMessage message={errorMessage} />}
          <button className={styles.submit} type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t('adminLogin.submitting') : t('adminLogin.submit')}
          </button>
        </form>
      </div>
    </main>
  )
}
