import { apiFetch, buildQuery } from './client'
import type { operations } from './schema.generated'

export const MAX_PARAGRAPH_CONTEXT = 20

export type ParagraphContextEntry = {
  paragraphId: number
  text: string
  pageNumber: number
}

export type ParagraphContextResponse = {
  paragraphId: number
  before: ParagraphContextEntry[]
  after: ParagraphContextEntry[]
  hasMoreBefore: boolean
  hasMoreAfter: boolean
}

export type ParagraphContextParams = operations['getContext']['parameters']['query']

export function getParagraphContext(
  paragraphId: number,
  params: ParagraphContextParams,
  signal?: AbortSignal,
): Promise<ParagraphContextResponse> {
  const qs = buildQuery({ before: params?.before, after: params?.after })
  return apiFetch<ParagraphContextResponse>(`/api/paragraphs/${paragraphId}/context?${qs}`, { signal })
}
