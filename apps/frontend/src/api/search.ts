import { apiFetch } from './client'
import type { operations } from './schema.generated'

export type SearchHit = {
  paragraphId: number
  text: string
  startOffset: number
  endOffset: number
  volume: string
  part: string
  pageNumber: number
}

export type SearchResponse = {
  results: SearchHit[]
  total: number
  page: number
  size: number
}

export type SearchParams = operations['search']['parameters']['query']

export function searchParagraphs(params: SearchParams, signal?: AbortSignal): Promise<SearchResponse> {
  const qs = new URLSearchParams({
    q: params.q,
    ...(params.page !== undefined && { page: String(params.page) }),
    ...(params.size !== undefined && { size: String(params.size) }),
  })
  return apiFetch<SearchResponse>(`/api/search?${qs}`, { signal })
}
