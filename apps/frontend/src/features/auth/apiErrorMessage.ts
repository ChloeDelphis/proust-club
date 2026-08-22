import { ApiError } from '../../api/client'

// Maps a mutation's ApiError status to a specific message, falling back to a generic one for any
// other status (network failure, unexpected 5xx, etc.) — shared across every auth mutation that
// needs to distinguish one specific failure mode from "something else went wrong."
export function apiErrorMessage(error: unknown, byStatus: Record<number, string>, fallback: string): string {
  if (error instanceof ApiError && error.status in byStatus) {
    return byStatus[error.status]
  }
  return fallback
}
