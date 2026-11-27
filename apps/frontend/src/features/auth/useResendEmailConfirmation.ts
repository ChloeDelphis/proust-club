import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import { resendEmailConfirmation } from '../../api/auth'
import { useToast } from '../../components/Toast/useToast'
import { apiErrorMessage } from './apiErrorMessage'
import { CURRENT_USER_QUERY_KEY, useCurrentUser } from './useCurrentUser'
import {
  clearEmailVerificationResendCooldown,
  emailVerificationResendCooldownQueryKey,
  emailVerificationResendCooldownStorageKey,
  formatEmailVerificationCooldown,
  readEmailVerificationResendCooldown,
  saveEmailVerificationResendCooldown,
  type EmailVerificationResendCooldown,
} from './emailVerificationCooldown'
export { emailVerificationResendCooldownQueryKey } from './emailVerificationCooldown'

export function useEmailVerificationResendCooldown(userId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = emailVerificationResendCooldownQueryKey(userId)
  const { data: cooldown } = useQuery<EmailVerificationResendCooldown | null>({
    queryKey,
    queryFn: async () => readEmailVerificationResendCooldown(userId),
    initialData: () => readEmailVerificationResendCooldown(userId),
    enabled: false,
    staleTime: Infinity,
    gcTime: 15 * 60 * 1000,
  })

  useEffect(() => {
    if (cooldown === null) return
    const remainingMilliseconds = cooldown.until - Date.now()
    if (remainingMilliseconds <= 0) {
      queryClient.setQueryData(emailVerificationResendCooldownQueryKey(userId), null)
      clearEmailVerificationResendCooldown(userId)
      return
    }
    const timer = window.setTimeout(() => {
      queryClient.setQueryData(emailVerificationResendCooldownQueryKey(userId), null)
      clearEmailVerificationResendCooldown(userId)
    }, remainingMilliseconds)
    return () => window.clearTimeout(timer)
  }, [cooldown, queryClient, userId])

  useEffect(() => {
    const storageKey = emailVerificationResendCooldownStorageKey(userId)
    if (!storageKey) return

    function syncCooldown(event: StorageEvent) {
      if (event.key !== storageKey) return
      queryClient.setQueryData(
        emailVerificationResendCooldownQueryKey(userId),
        readEmailVerificationResendCooldown(userId),
      )
    }

    window.addEventListener('storage', syncCooldown)
    return () => window.removeEventListener('storage', syncCooldown)
  }, [queryClient, userId])

  return cooldown
}

export default function useResendEmailConfirmation({ showErrorToast = false }: { showErrorToast?: boolean } = {}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: user } = useCurrentUser()
  const showToast = useToast()
  const cooldownQueryKey = emailVerificationResendCooldownQueryKey(user?.uuid)

  function applyCooldown(seconds: number) {
    const cooldown = { until: Date.now() + seconds * 1000, displaySeconds: seconds }
    saveEmailVerificationResendCooldown(user?.uuid, cooldown)
    queryClient.setQueryData(cooldownQueryKey, cooldown)
  }

  return useMutation({
    mutationFn: () => resendEmailConfirmation({ onCooldown: applyCooldown }),
    onSuccess: () => showToast(t('emailVerification.resentToast')),
    onError: error => {
      const rateLimitError = error instanceof ApiError && error.status === 429 ? error : null
      if (rateLimitError?.retryAfterSeconds !== undefined) applyCooldown(rateLimitError.retryAfterSeconds)
      if (error instanceof ApiError && error.status === 409) {
        queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY })
      }
      if (!showErrorToast) return

      if (rateLimitError?.retryAfterSeconds !== undefined) {
        showToast(formatEmailVerificationCooldown(rateLimitError.retryAfterSeconds))
        return
      }

      showToast(apiErrorMessage(
        error,
        {
          409: t('emailVerification.errorAlreadyConfirmed'),
          429: t('common.tooManyAttemptsError'),
        },
        t('emailVerification.errorGeneric'),
      ), { variant: 'error' })
    },
  })
}
