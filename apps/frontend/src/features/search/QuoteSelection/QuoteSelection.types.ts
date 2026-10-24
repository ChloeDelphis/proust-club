import type { GuestQuoteSaveDraft } from '../guestQuoteSaveContext'

export interface QuoteSelectionProps {
  paragraphId: number
  text: string
  highlightRange: { start: number; end: number }
  sourceOffset?: number
  hasLeadingEllipsis?: boolean
  hasTrailingEllipsis?: boolean
  onOpenDetail?: () => void
  resumeDraft?: GuestQuoteSaveDraft | null
  searchContext?: Pick<GuestQuoteSaveDraft, 'query' | 'page' | 'volumeId'>
}

export type Phase =
  | { kind: 'idle' }
  | { kind: 'selected'; start: number; end: number }
  | { kind: 'tagPanel'; start: number; end: number }
  | { kind: 'authPrompt'; start: number; end: number }
