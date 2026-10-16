import { assertVolumeIdInRange, VOLUME_COUNT } from './volume'

describe('assertVolumeIdInRange', () => {
  it('accepts ids within the corpus volume range', () => {
    expect(() => assertVolumeIdInRange(1)).not.toThrow()
    expect(() => assertVolumeIdInRange(VOLUME_COUNT)).not.toThrow()
    expect(() => assertVolumeIdInRange(undefined)).not.toThrow()
  })

  it.each([0, VOLUME_COUNT + 1, 1.5])('rejects invalid volume id %s', volumeId => {
    expect(() => assertVolumeIdInRange(volumeId)).toThrow(RangeError)
  })
})
