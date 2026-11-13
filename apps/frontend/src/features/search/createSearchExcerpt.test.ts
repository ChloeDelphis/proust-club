import { createSearchExcerpt } from './createSearchExcerpt'

describe('createSearchExcerpt', () => {
  it('returns the whole paragraph when it is already short', () => {
    expect(createSearchExcerpt('Court paragraphe.', { start: 7, end: 16 })).toEqual({
      start: 0,
      end: 17,
      hasLeadingEllipsis: false,
      hasTrailingEllipsis: false,
    })
  })

  it('centers a long excerpt around the match and keeps word boundaries', () => {
    const text = `${'avant '.repeat(40)}correspondance${' après'.repeat(40)}`
    const start = text.indexOf('correspondance')
    const excerpt = createSearchExcerpt(text, { start, end: start + 'correspondance'.length })

    expect(text.slice(excerpt.start, excerpt.end)).toContain('correspondance')
    expect(excerpt.end - excerpt.start).toBeGreaterThanOrEqual(200)
    expect(excerpt.hasLeadingEllipsis).toBe(true)
    expect(excerpt.hasTrailingEllipsis).toBe(true)
    expect(excerpt.start === 0 || /\s/.test(text[excerpt.start - 1])).toBe(true)
    expect(excerpt.end === text.length || /\s/.test(text[excerpt.end])).toBe(true)
  })

  it('keeps a match at the beginning and marks only the truncated end', () => {
    const text = `needle ${'suite '.repeat(50)}`
    const excerpt = createSearchExcerpt(text, { start: 0, end: 6 })

    expect(excerpt.start).toBe(0)
    expect(excerpt.hasLeadingEllipsis).toBe(false)
    expect(excerpt.hasTrailingEllipsis).toBe(true)
    expect(text.slice(excerpt.start, excerpt.end)).toMatch(/^needle\s/)
  })

  it('keeps a match at the end and marks only the truncated beginning', () => {
    const text = `${'début '.repeat(50)}needle`
    const excerpt = createSearchExcerpt(text, { start: text.length - 6, end: text.length })

    expect(excerpt.end).toBe(text.length)
    expect(excerpt.hasLeadingEllipsis).toBe(true)
    expect(excerpt.hasTrailingEllipsis).toBe(false)
    expect(text.slice(excerpt.start, excerpt.end)).toMatch(/needle$/)
  })

  it('expands past the target length when the match itself is longer', () => {
    const match = 'mot '.repeat(70).trimEnd()
    const text = `${'avant '.repeat(50)}${match}${' après'.repeat(50)}`
    const start = text.indexOf(match)
    const excerpt = createSearchExcerpt(text, { start, end: start + match.length })

    expect(excerpt.end - excerpt.start).toBe(match.length)
    expect(text.slice(excerpt.start, excerpt.end)).toContain(match)
  })

  it('clamps match offsets that extend beyond the paragraph', () => {
    const text = `début ${'suite '.repeat(50)}`
    const excerpt = createSearchExcerpt(text, { start: text.length + 5, end: text.length + 10 })

    expect(excerpt.end).toBe(text.length)
    expect(excerpt.hasTrailingEllipsis).toBe(false)
  })

  it('does not produce a negative match range when offsets are reversed', () => {
    const text = `début ${'suite '.repeat(50)}`
    const excerpt = createSearchExcerpt(text, { start: 170, end: 120 })

    expect(excerpt.start).toBeLessThanOrEqual(170)
    expect(excerpt.end).toBeGreaterThanOrEqual(170)
    expect(excerpt.end).toBeGreaterThan(excerpt.start)
  })

  it('prefers nearby sentence boundaries when choosing the excerpt edges', () => {
    const text = `${'a'.repeat(120)}. ${'pont '.repeat(20)}needle ${'suite '.repeat(40)}`
    const start = text.indexOf('needle')
    const excerpt = createSearchExcerpt(text, { start, end: start + 6 })
    const displayed = text.slice(excerpt.start, excerpt.end)

    expect(displayed.startsWith('pont ')).toBe(true)
    expect(displayed).toContain('needle')
    expect(displayed).toMatch(/suite\s/)
  })
})
