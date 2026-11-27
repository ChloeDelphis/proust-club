import i18n from '../../i18n'

const COOLDOWN_STORAGE_PREFIX = 'proust-club:email-verification-resend-cooldown:'

export type EmailVerificationResendCooldown = {
  until: number
  displaySeconds: number
}

export function emailVerificationResendCooldownQueryKey(userId: string | undefined) {
  return ['auth', 'email-verification-resend-cooldown', userId] as const
}

export function emailVerificationResendCooldownStorageKey(userId: string | undefined): string | null {
  if (!userId) return null
  return `${COOLDOWN_STORAGE_PREFIX}${userId}`
}

export function readEmailVerificationResendCooldown(userId: string | undefined): EmailVerificationResendCooldown | null {
  const key = emailVerificationResendCooldownStorageKey(userId)
  if (!key) return null

  try {
    const storedValue = localStorage.getItem(key)
    if (!storedValue) return null

    const parsedValue: unknown = JSON.parse(storedValue)
    if (!parsedValue || typeof parsedValue !== 'object') {
      localStorage.removeItem(key)
      return null
    }
    const cooldown = parsedValue as Partial<EmailVerificationResendCooldown>
    if (
      typeof cooldown.until !== 'number'
      || !Number.isFinite(cooldown.until)
      || cooldown.until <= Date.now()
    ) {
      localStorage.removeItem(key)
      return null
    }
    const remainingSeconds = Math.ceil((cooldown.until - Date.now()) / 1000)
    return { until: cooldown.until, displaySeconds: remainingSeconds }
  } catch {
    return null
  }
}

export function saveEmailVerificationResendCooldown(
  userId: string | undefined,
  cooldown: EmailVerificationResendCooldown,
): void {
  const key = emailVerificationResendCooldownStorageKey(userId)
  if (!key) return

  try {
    localStorage.setItem(key, JSON.stringify({ until: cooldown.until }))
  } catch {
    return
  }
}

export function clearEmailVerificationResendCooldown(userId: string | undefined): void {
  const key = emailVerificationResendCooldownStorageKey(userId)
  if (!key) return

  try {
    localStorage.removeItem(key)
  } catch {
    return
  }
}

export function formatEmailVerificationCooldown(seconds: number): string {
  return seconds < 60
    ? i18n.t('accountPage.emailVerificationCooldownSeconds', { seconds })
    : i18n.t('accountPage.emailVerificationCooldownMinutes', { minutes: Math.ceil(seconds / 60) })
}
