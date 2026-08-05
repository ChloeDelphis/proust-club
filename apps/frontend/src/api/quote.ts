import { apiFetch } from './client'
import type { operations } from './schema.generated'
import type { TagResponse } from './tag'

export type CreateQuoteParams = operations['create_1']['requestBody']['content']['application/json']

// QuoteSelectionResponse fields are non-optional here on purpose, unlike the generated schema —
// same reasoning already applied to SearchHit/UserResponse (springdoc can't mark response fields
// required, so every field in the generated type is `foo?: ...`).
export type QuoteSelectionResponse = {
  id: number
  paragraphId: number
  startOffset: number
  endOffset: number
  selectedText: string
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

export type QuoteListParams = NonNullable<operations['list_1']['parameters']['query']>

// Same reasoning as QuoteSelectionResponse above: fields written by hand as non-optional.
export type QuoteSelectionListResponse = {
  results: QuoteSelectionResponse[]
  total: number
  page: number
  size: number
}

export function listQuotes(params: QuoteListParams = {}, signal?: AbortSignal): Promise<QuoteSelectionListResponse> {
  const qs = new URLSearchParams({
    ...(params.tagId !== undefined && { tagId: String(params.tagId) }),
    ...(params.page !== undefined && { page: String(params.page) }),
    ...(params.size !== undefined && { size: String(params.size) }),
  })
  return apiFetch<QuoteSelectionListResponse>(`/api/quotes?${qs}`, { signal })
}

export function deleteQuote(id: number, signal?: AbortSignal): Promise<void> {
  return apiFetch<void>(`/api/quotes/${id}`, { method: 'DELETE', signal })
}
