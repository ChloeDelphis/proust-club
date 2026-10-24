import { useContext } from 'react'
import { VolumeSelectionContext } from './volumeSelectionContext'

export function useVolumeSelection() {
  const context = useContext(VolumeSelectionContext)
  if (!context) throw new Error('useVolumeSelection must be used inside VolumeSelectionProvider')
  return context
}
