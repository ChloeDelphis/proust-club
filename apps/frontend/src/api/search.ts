import { apiFetch, buildQuery } from './client'
import { assertPartId, assertVolumeIdInRange } from './volume'
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

export type SearchOverviewParams = NonNullable<operations['overview']['parameters']['query']>

export type SearchOverviewMarker = {
  paragraphId: number
  volumeId: number
  partId: number
  pageNumber: number
  previewText: string
}

export type SearchOverviewResponse = {
  total: number
  markers: SearchOverviewMarker[]
  volumeCounts: Array<{ volumeId: number; count: number }>
  partCounts: Array<{ partId: number; count: number }>
}

export type SearchParams = operations['search']['parameters']['query']

export function searchParagraphs(params: SearchParams, signal?: AbortSignal): Promise<SearchResponse> {
  assertVolumeIdInRange(params.volumeId)
  assertPartId(params.partId)
  const qs = buildQuery({ q: params.q, volumeId: params.volumeId, partId: params.partId, page: params.page, size: params.size })
  return apiFetch<SearchResponse>(`/api/search?${qs}`, { signal })
}

export function getSearchOverview(params: SearchOverviewParams, signal?: AbortSignal): Promise<SearchOverviewResponse> {
  const qs = buildQuery({ q: params.q })
  return apiFetch<SearchOverviewResponse>(`/api/search/overview?${qs}`, { signal })
}
