export interface QuoteSelectionProps {
  paragraphId: number
  text: string
  highlightRange: { start: number; end: number }
}

export type Phase =
  | { kind: 'idle' }
  // settled: the first marker's offset once placed, or null while placing the very first one
  | { kind: 'placing'; settled: number | null; live: number | null }
  | { kind: 'ready'; a: number; b: number }
  | { kind: 'tagPopup'; a: number; b: number }
