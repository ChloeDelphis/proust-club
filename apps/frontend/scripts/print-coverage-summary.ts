import { readFileSync } from 'node:fs'
import { parseCoverageSummary } from './readCoverageSummary.ts'

const REPORT_PATH = new URL('../coverage/coverage-summary.json', import.meta.url)

let json: string
try {
  json = readFileSync(REPORT_PATH, 'utf-8')
} catch {
  process.exit(1)
}

const totals = parseCoverageSummary(json)
if (!totals) {
  process.exit(1)
}

console.log(`${totals.pct} ${totals.covered} ${totals.total}`)
