export interface TimelineBarProps {
  isConnected: boolean
  activeTagId: string | null
  selectedVolumeId: number | null
  selectedPartId: number | null
  onSelectVolume: (id: number | null) => void
  onSelectPart: (partId: number, volumeId: number) => void
  // The parent owns the detail modal (QuoteCard, in the results list, opens the same one) — a
  // bookmark click just reports which quote, rather than TimelineBar keeping its own instance.
  onOpenQuote: (id: string) => void
}
