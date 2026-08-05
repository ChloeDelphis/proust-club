import { apiFetch } from './client'
import type { operations } from './schema.generated'

export type TagResponse = {
  id: number
  name: string
}

export function listTags(signal?: AbortSignal): Promise<TagResponse[]> {
  return apiFetch<TagResponse[]>('/api/tags', { signal })
}

export type RenameTagParams = operations['rename']['requestBody']['content']['application/json']

export function renameTag(id: number, params: RenameTagParams, signal?: AbortSignal): Promise<TagResponse> {
  return apiFetch<TagResponse>(`/api/tags/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })
}

export function deleteTag(id: number, signal?: AbortSignal): Promise<void> {
  return apiFetch<void>(`/api/tags/${id}`, { method: 'DELETE', signal })
}
