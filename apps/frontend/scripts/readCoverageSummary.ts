export interface CoverageTotals {
  covered: number
  total: number
}

interface CoverageSummaryReport {
  total?: {
    lines?: {
      covered?: unknown
      total?: unknown
    }
  }
}

export function parseCoverageSummary(json: string): CoverageTotals | null {
  let doc: CoverageSummaryReport
  try {
    doc = JSON.parse(json)
  } catch {
    return null
  }
  // `?.` on `doc` too: `JSON.parse` accepts the bare literal "null" as valid JSON, so `doc`
  // itself can be `null` here — a plain `doc.total` would throw instead of falling through
  // to the `!lines` check below.
  const lines = doc?.total?.lines
  if (!lines || typeof lines.covered !== 'number' || typeof lines.total !== 'number' || lines.total <= 0) {
    return null
  }
  return { covered: lines.covered, total: lines.total }
}
