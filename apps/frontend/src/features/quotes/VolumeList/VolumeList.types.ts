export interface VolumeListProps {
  selectedVolumeId: number | null
  onSelectVolume: (id: number | null) => void
}
