import { apiFetch, buildQuery } from './client'
import type { operations } from './schema.generated'
import type { TagResponse } from './tag'

export type CreateQuoteParams = operations['create_1']['requestBody']['content']['application/json']

// QuoteSelectionResponse fields are non-optional here on purpose, unlike the generated schema —
// same reasoning already applied to SearchHit/UserResponse (springdoc can't mark response fields
// required, so every field in the generated type is `foo?: ...`).
export type QuoteSelectionResponse = {
  id: string
  paragraphId: number
  startOffset: number
  endOffset: number
  selectedText: string
  comment: string | null
  tags: TagResponse[]
  createdAt: string
}

export function createQuote(params: CreateQuoteParams, signal?: AbortSignal): Promise<QuoteSelectionResponse> {
  return apiFetch<QuoteSelectionResponse>('/api/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })
}

export type UpdateQuoteCommentParams = operations['updateComment']['requestBody']['content']['application/json']

export function updateQuoteComment(id: string, params: UpdateQuoteCommentParams, signal?: AbortSignal): Promise<QuoteSelectionResponse> {
  return apiFetch<QuoteSelectionResponse>(`/api/quotes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })
}

export type AddTagParams = operations['addTag']['requestBody']['content']['application/json']

export function addTagToQuote(id: string, params: AddTagParams, signal?: AbortSignal): Promise<QuoteSelectionResponse> {
  return apiFetch<QuoteSelectionResponse>(`/api/quotes/${id}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })
}

export function removeTagFromQuote(id: string, tagId: string, signal?: AbortSignal): Promise<void> {
  return apiFetch<void>(`/api/quotes/${id}/tags/${tagId}`, { method: 'DELETE', signal })
}

export type QuoteListParams = NonNullable<operations['list_1']['parameters']['query']>

// Same reasoning as QuoteSelectionResponse above: fields written by hand as non-optional.
export type QuoteSelectionListResponse = {
  results: QuoteSelectionResponse[]
  total: number
  page: number
  size: number
}

export function listQuotes(params: QuoteListParams = {}, signal?: AbortSignal): Promise<QuoteSelectionListResponse> {
  const qs = buildQuery({ tagId: params.tagId, page: params.page, size: params.size })
  return apiFetch<QuoteSelectionListResponse>(`/api/quotes?${qs}`, { signal })
}

export function deleteQuote(id: string, signal?: AbortSignal): Promise<void> {
  return apiFetch<void>(`/api/quotes/${id}`, { method: 'DELETE', signal })
}

export type TimelineParams = NonNullable<operations['timeline']['parameters']['query']>

// Same reasoning as QuoteSelectionResponse above: fields written by hand as non-optional.
export type TimelineVolume = {
  id: number
  title: string
  position: number
  minPage: number
  maxPage: number
}

export type TimelineQuote = {
  id: string
  paragraphId: number
  pageNumber: number
  volumeId: number
  selectedText: string
  comment: string | null
  tags: TagResponse[]
  createdAt: string
}

export type TimelineResponse = {
  volumes: TimelineVolume[]
  quotes: TimelineQuote[]
}

export function getQuoteTimeline(params: TimelineParams = {}, signal?: AbortSignal): Promise<TimelineResponse> {
  const qs = buildQuery({ tagId: params.tagId })
  return apiFetch<TimelineResponse>(`/api/quotes/timeline?${qs}`, { signal })
}
