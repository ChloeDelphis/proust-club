import type { QuoteSelectionResponse } from '../../../api/quote'

export interface QuoteCardProps {
  quote: QuoteSelectionResponse
  onOpenDetail: (quote: QuoteSelectionResponse) => void
}
