import { apiFetch } from './client'

export type TagResponse = {
  id: number
  name: string
}

export function listTags(signal?: AbortSignal): Promise<TagResponse[]> {
  return apiFetch<TagResponse[]>('/api/tags', { signal })
}
