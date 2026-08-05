export interface QuoteSelectionProps {
  paragraphId: number
  text: string
  highlightRange: { start: number; end: number }
  /** True when another paragraph currently owns the active selection — only one at a time. */
  disabled: boolean
  /** Called when the user starts a selection on this paragraph. */
  onSelectionStart: () => void
  /** Called whenever this paragraph's selection ends (cancelled, saved, or failed and abandoned). */
  onSelectionEnd: () => void
}

export type Phase =
  | { kind: 'idle' }
  | { kind: 'placing'; settled: number[]; live: number | null }
  | { kind: 'ready'; a: number; b: number }
  | { kind: 'tagPopup'; a: number; b: number }
