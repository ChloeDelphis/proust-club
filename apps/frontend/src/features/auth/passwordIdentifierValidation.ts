import i18n from '../../i18n'

export function passwordMatchesIdentifierError(password: string, username: string, email: string): string | null {
  const lowerPassword = password.toLowerCase()
  if (lowerPassword === username.toLowerCase() || lowerPassword === email.toLowerCase()) {
    return i18n.t('passwordIdentifierValidation.matchesIdentifierError')
  }
  return null
}
