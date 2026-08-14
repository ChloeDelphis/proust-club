export function emailFormatError(email: string): string | null {
  return email.includes('@') ? null : 'Adresse email invalide.'
}
