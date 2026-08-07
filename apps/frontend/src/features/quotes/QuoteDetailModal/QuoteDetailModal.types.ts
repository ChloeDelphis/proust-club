import type { TimelineQuote } from '../../../api/quote'

export interface QuoteDetailModalProps {
  quote: TimelineQuote | null
  volumeTitle: string | undefined
  onClose: () => void
}
