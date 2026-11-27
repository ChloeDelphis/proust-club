import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../components/Toast/useToast'
import { useCurrentUser } from './useCurrentUser'
import useResendEmailConfirmation, {
  emailVerificationResendCooldownQueryKey,
  useEmailVerificationResendCooldown,
} from './useResendEmailConfirmation'
import { formatEmailVerificationCooldown } from './emailVerificationCooldown'
import type { EmailVerificationResendCooldown } from './emailVerificationCooldown'

export default function EmailVerificationReminder({ isVisible }: { isVisible: boolean }) {
  const { t } = useTranslation()
  const { data: user, isSuccess } = useCurrentUser()
  const showToast = useToast()
  const queryClient = useQueryClient()
  const cooldown = useEmailVerificationResendCooldown(user?.uuid)
  const { mutate: resend } = useResendEmailConfirmation({ showErrorToast: true })
  const lastNotifiedUser = useRef<string | null>(null)

  useEffect(() => {
    if (!isSuccess) {
      lastNotifiedUser.current = null
      return
    }

    if (!user) {
      lastNotifiedUser.current = null
      return
    }

    if (user.emailVerified) {
      lastNotifiedUser.current = user.uuid
      return
    }

    if (!isVisible || lastNotifiedUser.current === user.uuid) return

    lastNotifiedUser.current = user.uuid
    const canResend = cooldown === null
    const action = canResend ? {
      label: t('accountPage.resendConfirmationLink'),
      onClick: () => {
        const activeCooldown = queryClient.getQueryData<EmailVerificationResendCooldown | null>(
          emailVerificationResendCooldownQueryKey(user.uuid),
        )
        if (activeCooldown && activeCooldown.until > Date.now()) {
          const seconds = Math.ceil((activeCooldown.until - Date.now()) / 1000)
          showToast(formatEmailVerificationCooldown(seconds))
          return
        }
        resend()
      },
    } : undefined
    showToast(t('emailVerificationReminder.message'), { action })
  }, [cooldown, isSuccess, isVisible, queryClient, resend, showToast, t, user])

  return null
}
