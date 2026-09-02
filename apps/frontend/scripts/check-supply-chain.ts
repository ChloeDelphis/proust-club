/**
 * Pre-install supply-chain check — blocks on packages known to be malicious (OpenSSF Malicious
 * Packages / OSV `MAL-*` entries), not ordinary CVEs (that's `pnpm audit`'s job).
 *
 * Do not run this manually as part of a `pnpm add`/`update`/`install`/`remove` sequence — use
 * `pnpm safe:add`/`safe:update`/`safe:install`/`safe:remove` instead (`safe-pnpm.ts`/
 * `safePnpm.ts`), which orchestrate this script automatically. `apps/frontend/.pnpmfile.mjs`
 * rejects a raw `pnpm add`/`update`/`install`/`remove` outright, so running this script by hand
 * around a manual pnpm sequence no longer works. See `safePnpm.ts`'s `buildPnpmSteps` for the
 * authoritative sequence each `safe:*` command runs, and docs/features/supply-chain-check.md for
 * the full design rationale — not duplicated here to avoid a third copy going stale.
 */

import { readFileSync } from 'node:fs'
import { formatDetection, parseLockfilePackages, queryMaliciousPackages } from './supplyChainCheck.ts'

const LOCKFILE_PATH = new URL('../pnpm-lock.yaml', import.meta.url)

async function main() {
  let content: string
  try {
    content = readFileSync(LOCKFILE_PATH, 'utf-8')
  } catch (cause) {
    console.error(`Could not read pnpm-lock.yaml — supply-chain check aborted, treat as blocking.\n${(cause as Error).message}`)
    process.exitCode = 2
    return
  }

  let packages: ReturnType<typeof parseLockfilePackages>
  try {
    packages = parseLockfilePackages(content)
  } catch (cause) {
    console.error(`Could not parse pnpm-lock.yaml — supply-chain check aborted, treat as blocking.\n${(cause as Error).message}`)
    process.exitCode = 2
    return
  }

  console.log(`Checking ${packages.length} package/version pair(s) against OSV (OpenSSF Malicious Packages)...`)

  let detections
  try {
    detections = await queryMaliciousPackages(packages)
  } catch (cause) {
    console.error(`OSV query failed — supply-chain check could not complete, treat as blocking (not "probably safe").\n${(cause as Error).message}`)
    process.exitCode = 2
    return
  }

  if (detections.length === 0) {
    console.log('No known malicious package/version found. This does not prove every version is safe — only that none is currently flagged.')
    process.exitCode = 0
    return
  }

  console.error(`\n${detections.length} known-malicious package/version detected — do not install:\n`)
  for (const detection of detections) {
    console.error(formatDetection(detection))
  }
  process.exitCode = 1
}

await main()
