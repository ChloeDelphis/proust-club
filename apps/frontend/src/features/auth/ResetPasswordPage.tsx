import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { confirmPasswordReset } from '../../api/auth'
import { apiErrorMessage } from './apiErrorMessage'
import { setAuthenticatedUser } from './useCurrentUser'
import { useToast } from '../../components/Toast/useToast'
import ResetPasswordForm from './ResetPasswordForm/ResetPasswordForm'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import styles from './AuthPage.module.css'

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const showToast = useToast()

  const mutation = useMutation({
    mutationFn: (newPassword: string) => confirmPasswordReset({ token: token ?? '', newPassword }),
    onSuccess: user => {
      setAuthenticatedUser(queryClient, user)
      showToast(t('resetPasswordPage.successToast'))
      navigate('/')
    },
  })

  if (!token) {
    return (
      <main className={styles.root}>
        <h1 className={styles.title}>{t('resetPasswordPage.title')}</h1>
        <ErrorMessage message={t('resetPasswordPage.invalidLinkError')} />
        <p className={styles.switch}>
          <Link to="/forgot-password">{t('resetPasswordPage.requestNewLinkLink')}</Link>
        </p>
      </main>
    )
  }

  // 400 means the token itself is invalid/expired unless a machine-readable policy code identifies
  // a rejected password. A policy rejection leaves the token usable for a corrected retry.
  const errorMessage = !mutation.isError
    ? null
    : apiErrorMessage(
        mutation.error,
        {
          400: t('resetPasswordPage.expiredLinkError'),
          422: t('auth.passwordCompromisedError'),
        },
        t('resetPasswordPage.genericError'),
        { password_matches_identifier: t('passwordIdentifierValidation.matchesIdentifierError') },
      )

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>{t('resetPasswordPage.title')}</h1>
      <ResetPasswordForm onSubmit={({ newPassword }) => mutation.mutate(newPassword)} />
      {errorMessage && <ErrorMessage message={errorMessage} />}
      <p className={styles.switch}>
        <Link to="/forgot-password">{t('resetPasswordPage.requestNewLinkLink')}</Link>
      </p>
    </main>
  )
}
