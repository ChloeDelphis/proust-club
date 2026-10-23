import { assertVolumeIdInRange, getVolumes, VOLUME_COUNT } from './volume'

describe('getVolumes', () => {
  it('loads public volume structure without user-specific parameters', async () => {
    const volumes = [{ id: 1, title: 'Du côté de chez Swann', position: 1, minPage: 1, maxPage: 103 }]
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(volumes), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(getVolumes()).resolves.toEqual(volumes)
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/volumes', expect.objectContaining({
      headers: expect.any(Headers),
    }))
  })
})

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
