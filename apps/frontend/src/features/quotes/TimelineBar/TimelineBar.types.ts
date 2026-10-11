export interface TimelineBarProps {
  activeTagId: string | null
  selectedVolumeId: number | null
  // Always a concrete volume id — toggling a selection back to "all volumes" is the parent's
  // decision (re-selecting the same id), not something TimelineBar itself triggers.
  onSelectVolume: (id: number) => void
}
