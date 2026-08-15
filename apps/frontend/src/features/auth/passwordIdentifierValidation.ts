export function passwordMatchesIdentifierError(password: string, username: string, email: string): string | null {
  if (password.toLowerCase() === username.toLowerCase() || password.toLowerCase() === email.toLowerCase()) {
    return 'Le mot de passe ne peut pas être identique à votre nom d’utilisateur ou à votre email.'
  }
  return null
}
