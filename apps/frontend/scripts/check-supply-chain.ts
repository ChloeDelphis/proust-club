/**
 * Pre-install supply-chain check — blocks on packages known to be malicious (OpenSSF Malicious
 * Packages / OSV `MAL-*` entries), not ordinary CVEs (that's `pnpm audit`'s job).
 *
 * Do not run this manually as part of a `pnpm add`/`update`/`install`/`remove` sequence — use
 * `pnpm safe:add`/`safe:update`/`safe:install`/`safe:remove` instead (`safe-pnpm.ts`/
 * `safePnpm.ts`), which orchestrate exactly that sequence automatically. `apps/frontend/
 * .pnpmfile.mjs` rejects a raw `pnpm add`/`update`/`install`/`remove` outright, so the manual
 * sequence this comment used to document no longer works on its own.
 *
 * The sequence the `safe:*` commands run, for reference (see `safePnpm.ts`'s `buildPnpmSteps`
 * for the authoritative version):
 *
 *   `safe:install` (lockfile already resolved, package.json unchanged):
 *     1. pnpm check:supply-chain
 *     2. if exit 0 → pnpm install
 *
 *   `safe:add <pkg>` / `safe:update [<pkg>]` (this changes the lockfile — the package/version
 *   being added isn't in it yet when the command starts):
 *     1. pnpm add <pkg> --lockfile-only --ignore-scripts
 *        (or `pnpm update ... --lockfile-only --ignore-scripts`)
 *        Resolves the new graph and rewrites pnpm-lock.yaml without touching node_modules.
 *        --lockfile-only already prevents any real install (hence any lifecycle script) by
 *        itself; --ignore-scripts is added on top so that guarantee is explicit in the command
 *        itself, not just implied by another flag's side effect.
 *     2. pnpm check:supply-chain
 *     3. if exit 0 → pnpm install (materializes node_modules from the already-checked lockfile)
 *     4. if exit 1 or 2 → do not install. Step 1 may have changed both package.json and
 *        pnpm-lock.yaml (pnpm add writes both) — the orchestrator leaves those changes in place
 *        for review rather than reverting them automatically (an unqualified `git checkout` would
 *        also discard any unrelated local changes on those same files).
 *
 * See docs/features/supply-chain-check.md for the full design rationale.
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
