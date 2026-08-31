export interface CoverageTotals {
  pct: number
  covered: number
  total: number
}

interface CoverageSummaryReport {
  total?: {
    lines?: {
      pct?: unknown
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
  const lines = doc.total?.lines
  if (
    !lines ||
    typeof lines.pct !== 'number' ||
    typeof lines.covered !== 'number' ||
    typeof lines.total !== 'number' ||
    lines.total <= 0
  ) {
    return null
  }
  return { pct: lines.pct, covered: lines.covered, total: lines.total }
}
