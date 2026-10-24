import { createContext } from 'react'

export type VolumeSelectionContextValue = {
  selectedVolumeId: number | null
  selectVolume: (id: number) => void
}

export const VolumeSelectionContext = createContext<VolumeSelectionContextValue | null>(null)
