export const VOLUME_COUNT = 7

export function assertVolumeIdInRange(volumeId: number | undefined): void {
  if (volumeId !== undefined && (!Number.isInteger(volumeId) || volumeId < 1 || volumeId > VOLUME_COUNT)) {
    throw new RangeError(`volumeId must be between 1 and ${VOLUME_COUNT}`)
  }
}
