import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { login } from '../../api/auth'
import type { LoginParams } from '../../api/auth'
import { CURRENT_USER_QUERY_KEY } from './useCurrentUser'
import LoginForm from './LoginForm/LoginForm'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import styles from './AuthPage.module.css'

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (params: LoginParams) => login(params),
    onSuccess: user => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user)
      navigate('/')
    },
  })

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>{t('loginPage.title')}</h1>
      <LoginForm onSubmit={params => mutation.mutate(params)} />
      {mutation.isError && <ErrorMessage message={t('loginPage.invalidCredentialsError')} />}
      <p className={styles.switch}>
        <Link to="/forgot-password">{t('loginPage.forgotPasswordLink')}</Link>
      </p>
      <p className={styles.switch}>
        {t('loginPage.noAccountPrompt')} <Link to="/register">{t('loginPage.registerLink')}</Link>
      </p>
    </main>
  )
}
