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
