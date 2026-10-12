import type { TagResponse } from '../../../api/tag'

// pageNumber/volumeId are optional because this modal is also opened from the saved-citations
// list (QuoteCard), whose quote objects don't carry them — only the unpaginated timeline does.
// When absent, the meta line below the quote falls back to just the date.
export interface QuoteDetailModalQuote {
  id: string
  paragraphId: number
  selectedText: string
  comment: string | null
  tags: TagResponse[]
  createdAt: string
  pageNumber?: number
  volumeId?: number
}

export interface QuoteDetailModalProps {
  quote: QuoteDetailModalQuote | null
  volumeTitle: string | undefined
  onClose: () => void
}
