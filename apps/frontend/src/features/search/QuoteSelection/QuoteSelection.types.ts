export interface QuoteSelectionProps {
  paragraphId: number
  text: string
  highlightRange: { start: number; end: number }
}

export type Phase =
  | { kind: 'idle' }
  | { kind: 'selected'; start: number; end: number }
  | { kind: 'tagPanel'; start: number; end: number }
