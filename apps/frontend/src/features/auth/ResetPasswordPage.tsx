import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { confirmPasswordReset } from '../../api/auth'
import { apiErrorMessage } from './apiErrorMessage'
import { CURRENT_USER_QUERY_KEY } from './useCurrentUser'
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
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user)
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

  // 400 means the token itself is invalid/expired — anything else (500, network) is a real
  // server-side failure, not a problem with the link, and shouldn't be reported as one. 422 means
  // the token is still live — the same link works again with a different password (see
  // PasswordResetService.checkNewPasswordNotCompromisedIfTokenLooksValid(), the token is never
  // burned on this failure).
  const errorMessage = !mutation.isError
    ? null
    : apiErrorMessage(
        mutation.error,
        {
          400: t('resetPasswordPage.expiredLinkError'),
          422: t('auth.passwordCompromisedError'),
        },
        t('resetPasswordPage.genericError'),
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
