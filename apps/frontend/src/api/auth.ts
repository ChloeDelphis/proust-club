import { apiFetch } from './client'
import type { operations } from './schema.generated'

// UserResponse fields are non-optional here on purpose, unlike the generated schema — springdoc
// has no way to mark response fields "required", so every field in the generated UserResponse
// type is `foo?: string`. Same reasoning already applied to SearchHit/SearchResponse in search.ts.
export type UserResponse = {
  uuid: string
  username: string
  email: string
  role: string
}

export type RegisterParams = operations['register']['requestBody']['content']['application/json']
export type LoginParams = operations['login']['requestBody']['content']['application/json']
export type PasswordResetRequestParams = operations['requestReset']['requestBody']['content']['application/json']
export type PasswordResetConfirmParams = operations['confirmReset']['requestBody']['content']['application/json']
export type PasswordChangeParams = operations['changePassword']['requestBody']['content']['application/json']

export function register(params: RegisterParams, signal?: AbortSignal): Promise<UserResponse> {
  return apiFetch<UserResponse>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })
}

export function login(params: LoginParams, signal?: AbortSignal): Promise<UserResponse> {
  return apiFetch<UserResponse>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })
}

export function logout(signal?: AbortSignal): Promise<void> {
  return apiFetch<void>('/api/auth/logout', { method: 'POST', signal })
}

export function getCurrentUser(signal?: AbortSignal): Promise<UserResponse> {
  return apiFetch<UserResponse>('/api/auth/me', { signal })
}

export function requestPasswordReset(params: PasswordResetRequestParams, signal?: AbortSignal): Promise<void> {
  return apiFetch<void>('/api/auth/password-reset/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })
}

export function confirmPasswordReset(params: PasswordResetConfirmParams, signal?: AbortSignal): Promise<UserResponse> {
  return apiFetch<UserResponse>('/api/auth/password-reset/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })
}

export function changePassword(params: PasswordChangeParams, signal?: AbortSignal): Promise<void> {
  return apiFetch<void>('/api/auth/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })
}
