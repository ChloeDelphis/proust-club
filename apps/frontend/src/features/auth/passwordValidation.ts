export const MIN_PASSWORD_LENGTH = 15

export function passwordLengthError(password: string, label = 'Le mot de passe'): string | null {
  return password.length < MIN_PASSWORD_LENGTH
    ? `${label} doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères — une phrase de passe fonctionne très bien.`
    : null
}
