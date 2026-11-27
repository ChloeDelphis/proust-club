import i18n from '../../i18n'

const QUALIFIED_EMAIL_PATTERN = /^[^@\s]+@[^@\s.]+(?:\.[^@\s.]+)+$/

export function emailFormatError(email: string, requireQualifiedDomain = false): string | null {
  const hasBasicEmailShape = email.includes('@')
  const hasQualifiedDomain = !requireQualifiedDomain || QUALIFIED_EMAIL_PATTERN.test(email)

  return hasBasicEmailShape && hasQualifiedDomain ? null : i18n.t('emailValidation.formatError')
}
