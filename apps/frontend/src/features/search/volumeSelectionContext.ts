import { createContext } from 'react'

export type VolumeSelectionContextValue = {
  selectedVolumeId: number | null
  selectedPartId: number | null
  selectVolume: (id: number | null) => void
  selectPart: (partId: number, volumeId: number) => void
}

export const VolumeSelectionContext = createContext<VolumeSelectionContextValue | null>(null)
