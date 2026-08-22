import i18n from '../../i18n'
import { ApiError } from '../../api/client'

// Shared across every mutation that can fail with a 422 breach-check rejection (register,
// change-password, reset-confirm) — a single source of truth for the wording. A function, not a
// module-level constant, so the catalog lookup happens at call time rather than being frozen
// at import time (before i18n initialization could otherwise have run).
export function passwordCompromisedMessage(): string {
  return i18n.t('auth.passwordCompromisedError')
}

// Maps a mutation's ApiError status to a specific message, falling back to a generic one for any
// other status (network failure, unexpected 5xx, etc.) — shared across every auth mutation that
// needs to distinguish one specific failure mode from "something else went wrong."
export function apiErrorMessage(error: unknown, byStatus: Record<number, string>, fallback: string): string {
  if (error instanceof ApiError && error.status in byStatus) {
    return byStatus[error.status]
  }
  return fallback
}
