import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import { apiErrorMessage } from './apiErrorMessage'
import { useCurrentUser } from './useCurrentUser'
import useResendEmailConfirmation from './useResendEmailConfirmation'
import type { EmailVerificationResendCooldown } from './emailVerificationCooldown'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import styles from './AccountPage.module.css'

export default function EmailVerificationStatus({
  cooldown,
}: {
  cooldown: EmailVerificationResendCooldown | null | undefined
}) {
  const { t } = useTranslation()
  const { data: user } = useCurrentUser()
  const mutation = useResendEmailConfirmation()

  const rateLimitError = mutation.error instanceof ApiError && mutation.error.status === 429
    ? mutation.error
    : null

  if (!user || user.emailVerified) return null

  let errorMessage: string | null = null
  if (mutation.isError) {
    if (rateLimitError) {
      if (rateLimitError.retryAfterSeconds === undefined) {
        errorMessage = t('common.tooManyAttemptsError')
      }
    } else {
      errorMessage = apiErrorMessage(
        mutation.error,
        {
          409: t('emailVerification.errorAlreadyConfirmed'),
        },
        t('emailVerification.errorGeneric'),
      )
    }
  }
  return (
    <div className={styles.emailVerification}>
      <p className={styles.verificationLabel}>
        <span className={styles.verificationDot} aria-hidden="true" />
        {t('accountPage.emailVerificationStatus')}
      </p>
      <button
        type="button"
        className={styles.verificationResend}
        disabled={mutation.isPending || cooldown !== null}
        onClick={() => mutation.mutate()}
      >
        {t('accountPage.resendConfirmationLink')}
      </button>
      {errorMessage && (
        <div className={styles.verificationError}>
          <ErrorMessage message={errorMessage} />
        </div>
      )}
    </div>
  )
}
