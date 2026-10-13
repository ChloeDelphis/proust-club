import i18n from '../../i18n'

export function passwordMatchesIdentifierError(password: string, username: string, email: string): string | null {
  const lowerPassword = password.toLowerCase()
  if (lowerPassword === username.trim().toLowerCase() || lowerPassword === email.trim().toLowerCase()) {
    return i18n.t('passwordIdentifierValidation.matchesIdentifierError')
  }
  return null
}
