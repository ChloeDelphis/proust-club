import i18n from '../../i18n'

// The bound comes from the caller's own DTO in validationConstraints.generated.ts (e.g.
// RegisterRequest.password vs PasswordChangeRequest.newPassword) — never a shared constant here,
// so each operation's actual backend policy is what gets enforced, not another operation's.
export function passwordLengthError(password: string, label: string, constraints: { minLength: number }): string | null {
  if (password.length >= constraints.minLength) return null
  return i18n.t('passwordValidation.tooShortError', { label, min: constraints.minLength })
}

// Same bound as passwordLengthError, shown proactively instead of after a failed submission —
// centralized for the same reason: each operation's own DTO constraint, not a shared constant.
export function passwordLengthHint(constraints: { minLength: number }): string {
  return i18n.t('passwordValidation.minLengthHint', { min: constraints.minLength })
}
