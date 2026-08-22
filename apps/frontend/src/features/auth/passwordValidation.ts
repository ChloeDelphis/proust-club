import i18n from '../../i18n'

export const MIN_PASSWORD_LENGTH = 15

export function passwordLengthError(password: string, label?: string): string | null {
  if (password.length >= MIN_PASSWORD_LENGTH) return null
  return i18n.t('passwordValidation.tooShortError', {
    label: label ?? i18n.t('passwordValidation.defaultLabel'),
    min: MIN_PASSWORD_LENGTH,
  })
}
