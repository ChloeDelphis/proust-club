export interface VolumeListProps {
  activeTagId: string | null
  selectedVolumeId: number | null
  // Always a concrete volume id — re-selecting the active one is how the parent toggles back to
  // "all volumes", there's no separate affordance for that in this component.
  onSelectVolume: (id: number) => void
}
