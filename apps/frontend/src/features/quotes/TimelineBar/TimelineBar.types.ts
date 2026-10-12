export interface TimelineBarProps {
  activeTagId: string | null
  selectedVolumeId: number | null
  // Always a concrete volume id — toggling a selection back to "all volumes" is the parent's
  // decision (re-selecting the same id), not something TimelineBar itself triggers.
  onSelectVolume: (id: number) => void
  // The parent owns the detail modal (QuoteCard, in the results list, opens the same one) — a
  // bookmark click just reports which quote, rather than TimelineBar keeping its own instance.
  onOpenQuote: (id: string) => void
}
