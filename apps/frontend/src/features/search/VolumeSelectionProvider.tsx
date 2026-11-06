import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useGuestQuoteSave } from './useGuestQuoteSave'
import { VolumeSelectionContext } from './volumeSelectionContext'

export default function VolumeSelectionProvider({ children }: { children: ReactNode }) {
  const { draft } = useGuestQuoteSave()
  const [selectedVolumeId, setSelectedVolumeId] = useState<number | null>(() => draft?.volumeId ?? null)
  const [selectedPartId, setSelectedPartId] = useState<number | null>(() => draft?.partId ?? null)
  const selectVolume = useCallback((id: number) => {
    if (selectedVolumeId === id && selectedPartId !== null) {
      setSelectedPartId(null)
      return
    }
    setSelectedVolumeId(current => current === id ? null : id)
    setSelectedPartId(null)
  }, [selectedPartId, selectedVolumeId])
  const selectPart = useCallback((partId: number, volumeId: number) => {
    setSelectedVolumeId(volumeId)
    setSelectedPartId(current => current === partId ? null : partId)
  }, [])
  const value = useMemo(
    () => ({ selectedVolumeId, selectedPartId, selectVolume, selectPart }),
    [selectedVolumeId, selectedPartId, selectVolume, selectPart],
  )

  return (
    <VolumeSelectionContext.Provider value={value}>
      {children}
    </VolumeSelectionContext.Provider>
  )
}
