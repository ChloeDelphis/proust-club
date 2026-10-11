export interface TimelineBarProps {
  activeTagId: string | null
  selectedVolumeId: number | null
  onSelectVolume: (id: number | null) => void
}
