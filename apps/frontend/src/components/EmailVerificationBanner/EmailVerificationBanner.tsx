import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import { resendEmailConfirmation } from '../../api/auth'
import { apiErrorMessage } from '../../features/auth/apiErrorMessage'
import { useCurrentUser, CURRENT_USER_QUERY_KEY } from '../../features/auth/useCurrentUser'
import { useToast } from '../Toast/useToast'
import ErrorMessage from '../ErrorMessage/ErrorMessage'
import styles from './EmailVerificationBanner.module.css'

export default function EmailVerificationBanner() {
  const { t } = useTranslation()
  const { data: user, isSuccess } = useCurrentUser()
  const showToast = useToast()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => resendEmailConfirmation(),
    onSuccess: () => {
      showToast(t('emailVerificationBanner.resentToast'))
    },
    onError: error => {
      // A 409 means the account was actually confirmed elsewhere (e.g. the link was opened in
      // another tab) and this tab's cached user just hasn't caught up yet — refetch so the
      // banner (which only renders while emailVerified is false) corrects itself instead of
      // staying stuck showing a "confirm your email" prompt for an already-confirmed account.
      if (error instanceof ApiError && error.status === 409) {
        queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY })
      }
    },
  })

  if (!isSuccess || user.emailVerified) {
    return null
  }

  const errorMessage = !mutation.isError
    ? null
    : apiErrorMessage(
        mutation.error,
        {
          409: t('emailVerificationBanner.errorAlreadyConfirmed'),
          429: t('common.tooManyAttemptsError'),
        },
        t('emailVerificationBanner.errorGeneric'),
      )

  return (
    <div className={styles.root} role="status">
      <span>{t('emailVerificationBanner.message')}</span>
      <button
        type="button"
        className={styles.resendButton}
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {t('emailVerificationBanner.resendButton')}
      </button>
      {errorMessage && <ErrorMessage message={errorMessage} />}
    </div>
  )
}
