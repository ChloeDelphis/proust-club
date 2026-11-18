import type { QuoteSelectionListItemResponse, QuoteSelectionResponse } from '../../../api/quote'

export interface QuoteCardProps {
  quote: QuoteSelectionListItemResponse
  onOpenDetail: (quote: QuoteSelectionResponse) => void
}
