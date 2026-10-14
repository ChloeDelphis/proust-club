import { apiFetch } from './client'
import { validationConstraints } from './generated/validationConstraints.generated'
import type { operations } from './schema.generated'

export const MAX_TAG_NAME_LENGTH = validationConstraints.CreateTagRequest.name.maxLength

export type TagResponse = {
  id: string
  name: string
  colorIndex: number
}

export function listTags(signal?: AbortSignal): Promise<TagResponse[]> {
  return apiFetch<TagResponse[]>('/api/tags', { signal })
}

export type RenameTagParams = operations['rename']['requestBody']['content']['application/json']

export function renameTag(id: string, params: RenameTagParams, signal?: AbortSignal): Promise<TagResponse> {
  return apiFetch<TagResponse>(`/api/tags/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })
}

export function deleteTag(id: string, signal?: AbortSignal): Promise<void> {
  return apiFetch<void>(`/api/tags/${id}`, { method: 'DELETE', signal })
}
