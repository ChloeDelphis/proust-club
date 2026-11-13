import i18n from '../../i18n'

export function passwordMatchesIdentifierError(password: string, username: string | null, email: string): string | null {
  const lowerPassword = password.toLowerCase()
  const matchesUsername = username !== null && lowerPassword === username.trim().toLowerCase()
  const matchesEmail = lowerPassword === email.trim().toLowerCase()
  if (matchesUsername || matchesEmail) {
    return i18n.t(matchesUsername ? 'passwordIdentifierValidation.matchesIdentifierError' : 'passwordIdentifierValidation.matchesEmailError')
  }
  return null
}
