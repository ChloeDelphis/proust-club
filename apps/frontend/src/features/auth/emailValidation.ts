import i18n from '../../i18n'

export function emailFormatError(email: string): string | null {
  return email.includes('@') ? null : i18n.t('emailValidation.formatError')
}
