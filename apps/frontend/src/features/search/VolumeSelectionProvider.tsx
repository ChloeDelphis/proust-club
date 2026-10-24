import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useGuestQuoteSave } from './useGuestQuoteSave'
import { VolumeSelectionContext } from './volumeSelectionContext'

export default function VolumeSelectionProvider({ children }: { children: ReactNode }) {
  const { draft } = useGuestQuoteSave()
  const [selectedVolumeId, setSelectedVolumeId] = useState<number | null>(() => draft?.volumeId ?? null)
  const selectVolume = useCallback((id: number) => {
    setSelectedVolumeId(current => current === id ? null : id)
  }, [])
  const value = useMemo(() => ({ selectedVolumeId, selectVolume }), [selectedVolumeId, selectVolume])

  return (
    <VolumeSelectionContext.Provider value={value}>
      {children}
    </VolumeSelectionContext.Provider>
  )
}
