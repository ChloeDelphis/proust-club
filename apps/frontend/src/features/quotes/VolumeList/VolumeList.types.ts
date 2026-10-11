export interface VolumeListProps {
  activeTagId: string | null
  selectedVolumeId: number | null
  onSelectVolume: (id: number | null) => void
}
