import type { TagResponse } from '../../../api/tag'

export interface QuoteTagEditorProps {
  quoteId: number
  tags: TagResponse[]
}
