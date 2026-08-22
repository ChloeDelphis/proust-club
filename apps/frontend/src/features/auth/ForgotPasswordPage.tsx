import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { requestPasswordReset } from '../../api/auth'
import type { PasswordResetRequestParams } from '../../api/auth'
import { apiErrorMessage } from './apiErrorMessage'
import ForgotPasswordForm from './ForgotPasswordForm/ForgotPasswordForm'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import styles from './AuthPage.module.css'

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const mutation = useMutation({
    mutationFn: (params: PasswordResetRequestParams) => requestPasswordReset(params),
  })

  // ForgotPasswordForm's client-side email check (`includes('@')`) is weaker than the backend's
  // @Email validation, so a malformed address can still reach the server and come back as 400 —
  // not just a rate limit (429) or an unrelated server failure.
  const errorMessage = !mutation.isError
    ? null
    : apiErrorMessage(
        mutation.error,
        { 429: t('forgotPasswordPage.tooManyAttemptsError'), 400: t('emailValidation.formatError') },
        t('forgotPasswordPage.genericError'),
      )

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>{t('forgotPasswordPage.title')}</h1>
      {mutation.isSuccess ? (
        <p>{t('forgotPasswordPage.successMessage')}</p>
      ) : (
        <>
          <ForgotPasswordForm onSubmit={params => mutation.mutate(params)} />
          {errorMessage && <ErrorMessage message={errorMessage} />}
        </>
      )}
      <p className={styles.switch}>
        <Link to="/login">{t('forgotPasswordPage.backToLoginLink')}</Link>
      </p>
    </main>
  )
}
