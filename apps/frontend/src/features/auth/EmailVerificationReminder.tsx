import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../components/Toast/useToast'
import { useCurrentUser } from './useCurrentUser'

export default function EmailVerificationReminder() {
  const { t } = useTranslation()
  const { data: user, isSuccess } = useCurrentUser()
  const showToast = useToast()
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

    if (lastNotifiedUser.current !== user.uuid) {
      lastNotifiedUser.current = user.uuid
      showToast(t('emailVerificationReminder.message'))
    }
  }, [isSuccess, showToast, t, user])

  return null
}
