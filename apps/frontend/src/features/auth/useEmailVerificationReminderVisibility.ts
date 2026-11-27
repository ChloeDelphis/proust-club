import { useEffect, useState } from 'react'
import type { UserResponse } from '../../api/auth'

const REMINDER_DELAY_MS = 1000

export default function useEmailVerificationReminderVisibility(
  user: UserResponse | null | undefined,
  isSuccess: boolean,
  updatedAt: number,
): boolean {
  const reminderKey = isSuccess && user && !user.emailVerified
    ? `${user.uuid}:${updatedAt}`
    : null
  const [visibleReminderKey, setVisibleReminderKey] = useState<string | null>(null)

  useEffect(() => {
    if (!reminderKey) return

    const timer = window.setTimeout(() => setVisibleReminderKey(reminderKey), REMINDER_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [reminderKey])

  return reminderKey !== null && visibleReminderKey === reminderKey
}
