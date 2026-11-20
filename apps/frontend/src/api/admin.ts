import { apiFetch } from './client'
import type { UserResponse } from './auth'

export type AdminLoginParams = { email: string; password: string; code: string }
export type AdminDailyMetric = { date: string; registrations: number; deletions: number }
export type AdminNotificationPreferences = { registrationsEnabled: boolean; deletionsEnabled: boolean }
export type AdminDashboard = {
  registeredUsers: number
  savedQuotes: number
  tags: number
  dailyMetrics: AdminDailyMetric[]
  notifications: AdminNotificationPreferences
  rangeStart: string
  rangeEnd: string
}

export function adminLogin(params: AdminLoginParams, signal?: AbortSignal): Promise<UserResponse> {
  return apiFetch<UserResponse>('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })
}

export function getAdminDashboard(signal?: AbortSignal): Promise<AdminDashboard> {
  return apiFetch<AdminDashboard>('/api/admin/dashboard', { signal })
}

export function updateAdminNotifications(
  preferences: AdminNotificationPreferences,
  signal?: AbortSignal,
): Promise<AdminNotificationPreferences> {
  return apiFetch<AdminNotificationPreferences>('/api/admin/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences),
    signal,
  })
}
