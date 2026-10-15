import type { TagResponse } from '../../../api/tag'

export interface QuoteTagEditorProps {
  quoteId: string
  tags: TagResponse[]
  onTagsChange?: (tags: TagResponse[]) => void
}
