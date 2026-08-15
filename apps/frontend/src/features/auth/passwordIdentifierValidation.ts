export function passwordMatchesIdentifierError(password: string, username: string, email: string): string | null {
  const lowerPassword = password.toLowerCase()
  if (lowerPassword === username.toLowerCase() || lowerPassword === email.toLowerCase()) {
    return 'Le mot de passe ne peut pas être identique à votre nom d’utilisateur ou à votre email.'
  }
  return null
}
