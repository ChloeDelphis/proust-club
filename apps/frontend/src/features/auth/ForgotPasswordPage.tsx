import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { requestPasswordReset } from '../../api/auth'
import type { PasswordResetRequestParams } from '../../api/auth'
import { apiErrorMessage } from './apiErrorMessage'
import ForgotPasswordForm from './ForgotPasswordForm/ForgotPasswordForm'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import formStyles from './AuthForm.module.css'
import styles from './AuthPage.module.css'

const RESEND_COOLDOWN_MINUTES = 5
const RESEND_COOLDOWN_MS = RESEND_COOLDOWN_MINUTES * 60 * 1000

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null)
  const [canResend, setCanResend] = useState(false)

  const mutation = useMutation({
    mutationFn: (params: PasswordResetRequestParams) => requestPasswordReset(params),
    onSuccess: (_data, params) => {
      setConfirmationEmail(params.email)
      startResendCooldown()
    },
  })

  useEffect(() => {
    if (resendAvailableAt === null) return

    const timeout = window.setTimeout(
      () => setCanResend(true),
      Math.max(0, resendAvailableAt - Date.now()),
    )

    return () => window.clearTimeout(timeout)
  }, [resendAvailableAt])

  function startResendCooldown() {
    setCanResend(false)
    setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS)
  }

  function handleResend() {
    if (!confirmationEmail || !canResend || mutation.isPending) return

    mutation.reset()
    startResendCooldown()
    mutation.mutate({ email: confirmationEmail })
  }

  // ForgotPasswordForm's client-side email check (`includes('@')`) is weaker than the backend's
  // @Email validation, so a malformed address can still reach the server and come back as 400 —
  // not just a rate limit (429) or an unrelated server failure.
  const errorMessage = !mutation.isError
    ? null
    : apiErrorMessage(
        mutation.error,
        { 429: t('common.tooManyAttemptsError'), 400: t('emailValidation.formatError') },
        t('forgotPasswordPage.genericError'),
      )

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>{t('forgotPasswordPage.title')}</h1>
      {confirmationEmail ? (
        <section className={styles.confirmation}>
          <p className={styles.confirmationMessage} role="status">
            {t('forgotPasswordPage.successMessage')}
          </p>
          <p className={styles.resendHint}>{t('forgotPasswordPage.spamFolderHint')}</p>
          {mutation.isError && errorMessage && <ErrorMessage message={errorMessage} />}
          <p className={styles.resendHint}>
            {t(canResend ? 'forgotPasswordPage.resendReady' : 'forgotPasswordPage.resendWait')}
          </p>
          <button
            className={formStyles.button}
            type="button"
            disabled={!canResend || mutation.isPending}
            onClick={handleResend}
          >
            {t(mutation.isPending ? 'forgotPasswordPage.resendingButton' : 'forgotPasswordPage.resendButton')}
          </button>
        </section>
      ) : (
        <>
          <p className={styles.description}>{t('forgotPasswordPage.description')}</p>
          <ForgotPasswordForm
            isSubmitting={mutation.isPending}
            onSubmit={params => mutation.mutate(params)}
          />
          {errorMessage && <ErrorMessage message={errorMessage} />}
        </>
      )}
      <p className={styles.switch}>
        <Link to="/login">{t('forgotPasswordPage.backToLoginLink')}</Link>
      </p>
    </main>
  )
}
