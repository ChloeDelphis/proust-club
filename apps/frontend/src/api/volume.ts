import { apiFetch } from './client'

export const VOLUME_COUNT = 7

export type VolumeResponse = {
  id: number
  title: string
  position: number
  minPage: number
  maxPage: number
}

export function assertVolumeIdInRange(volumeId: number | undefined): void {
  if (volumeId !== undefined && (!Number.isInteger(volumeId) || volumeId < 1 || volumeId > VOLUME_COUNT)) {
    throw new RangeError(`volumeId must be between 1 and ${VOLUME_COUNT}`)
  }
}

export function getVolumes(signal?: AbortSignal): Promise<VolumeResponse[]> {
  return apiFetch<VolumeResponse[]>('/api/volumes', { signal })
}
