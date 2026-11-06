import { apiFetch } from './client'

export const VOLUME_COUNT = 7

export type PartResponse = {
  id: number
  title: string
  position: number
  startPage: number
}

export type VolumeResponse = {
  id: number
  title: string
  position: number
  minPage: number
  maxPage: number
  parts: PartResponse[]
}

export function assertVolumeIdInRange(volumeId: number | undefined): void {
  if (volumeId !== undefined && (!Number.isInteger(volumeId) || volumeId < 1 || volumeId > VOLUME_COUNT)) {
    throw new RangeError(`volumeId must be between 1 and ${VOLUME_COUNT}`)
  }
}

export function assertPartId(partId: number | undefined): void {
  if (partId !== undefined && (!Number.isInteger(partId) || partId < 1)) {
    throw new RangeError('partId must be a positive integer')
  }
}

export function getVolumes(signal?: AbortSignal): Promise<VolumeResponse[]> {
  return apiFetch<VolumeResponse[]>('/api/volumes', { signal })
}
