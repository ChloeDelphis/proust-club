import { ApiError } from '../../api/client'

// Maps stable API problem codes before HTTP status, then falls back to a generic message for any
// other error (network failure, unexpected 5xx, etc.). Shared across auth mutations that need
// to distinguish a specific failure mode from "something else went wrong."
export function apiErrorMessage(
  error: unknown,
  byStatus: Record<number, string>,
  fallback: string,
  byCode: Record<string, string> = {},
): string {
  if (error instanceof ApiError && error.code && Object.hasOwn(byCode, error.code)) {
    return byCode[error.code]
  }
  if (error instanceof ApiError && error.status in byStatus) {
    return byStatus[error.status]
  }
  return fallback
}
