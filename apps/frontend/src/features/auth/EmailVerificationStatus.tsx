import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import { resendEmailConfirmation } from '../../api/auth'
import { apiErrorMessage } from './apiErrorMessage'
import { CURRENT_USER_QUERY_KEY, useCurrentUser } from './useCurrentUser'
import { useToast } from '../../components/Toast/useToast'
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage'
import styles from './AccountPage.module.css'

export default function EmailVerificationStatus() {
  const { t } = useTranslation()
  const { data: user } = useCurrentUser()
  const queryClient = useQueryClient()
  const showToast = useToast()

  const mutation = useMutation({
    mutationFn: () => resendEmailConfirmation(),
    onSuccess: () => showToast(t('emailVerification.resentToast')),
    onError: error => {
      if (error instanceof ApiError && error.status === 409) {
        queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY })
      }
    },
  })

  if (!user || user.emailVerified) return null

  const errorMessage = !mutation.isError
    ? null
    : apiErrorMessage(
        mutation.error,
        {
          409: t('emailVerification.errorAlreadyConfirmed'),
          429: t('common.tooManyAttemptsError'),
        },
        t('emailVerification.errorGeneric'),
      )

  return (
    <div className={styles.emailVerification}>
      <p className={styles.verificationLabel}>{t('accountPage.emailVerificationStatus')}</p>
      <button
        type="button"
        className={styles.verificationResend}
        disabled={mutation.isPending}
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
