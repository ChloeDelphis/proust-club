import { parseCoverageSummary } from './readCoverageSummary'

describe('parseCoverageSummary', () => {
  it('extracts pct/covered/total from a valid vitest json-summary report', () => {
    const json = JSON.stringify({ total: { lines: { pct: 92.55, covered: 584, total: 631 } } })
    expect(parseCoverageSummary(json)).toEqual({ pct: 92.55, covered: 584, total: 631 })
  })

  it('returns null for malformed JSON', () => {
    expect(parseCoverageSummary('{not json')).toBeNull()
  })

  it('returns null when total.lines is missing', () => {
    expect(parseCoverageSummary(JSON.stringify({ total: {} }))).toBeNull()
  })

  it('returns null when a field is not a number', () => {
    const json = JSON.stringify({ total: { lines: { pct: '92.55', covered: 584, total: 631 } } })
    expect(parseCoverageSummary(json)).toBeNull()
  })

  it('returns null when total is zero (empty/degenerate report)', () => {
    const json = JSON.stringify({ total: { lines: { pct: 0, covered: 0, total: 0 } } })
    expect(parseCoverageSummary(json)).toBeNull()
  })

  it('returns null for the JSON literal "null" instead of throwing', () => {
    expect(parseCoverageSummary('null')).toBeNull()
  })

  it('returns null for a JSON value that is not an object (e.g. a bare number)', () => {
    expect(parseCoverageSummary('42')).toBeNull()
  })
})
