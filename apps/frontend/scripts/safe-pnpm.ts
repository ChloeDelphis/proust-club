/**
 * CLI entrypoint for the repo's safe dependency commands (`pnpm safe:add`/`safe:update`/
 * `safe:install`/`safe:remove`, see package.json). Orchestrates `check:supply-chain` around the
 * real pnpm add/update/install so the check can't be skipped by forgetting a manual step — see
 * docs/features/supply-chain-check.md and apps/frontend/.pnpmfile.mjs (which rejects any
 * pnpm add/update/install/remove that didn't go through this script, via the PROUST_SAFE_PNPM
 * marker set below). `safe:remove` exists only because that guard can't distinguish remove from
 * the others — see safePnpm.ts.
 *
 * Sequencing logic lives in safePnpm.ts (tested without spawning a real process); this file is
 * the untested I/O wrapper, same split as check-supply-chain.ts/supplyChainCheck.ts.
 */

import { spawnSync } from 'node:child_process'
import {
  PROUST_SAFE_PNPM_ENV,
  SAFE_SUBCOMMANDS,
  isSafePnpmArg,
  runSafePnpm,
  validateSafePnpmArgs,
  type SafeSubcommand,
} from './safePnpm.ts'

// `shell: true` is required on Windows so the `pnpm.cmd` shim resolves at all (spawnSync on a
// bare `.cmd` file without a shell fails with EINVAL — a known Node/Windows limitation, verified
// empirically). Node flags args-array + shell:true as unsafe (DEP0190) because it doesn't escape
// the args itself; isSafePnpmArg() below is what actually closes that off, by rejecting anything
// that isn't a plain package-spec-shaped argument before it ever reaches spawnSync.
function spawnPnpm(args: string[]): number {
  console.log(`\n$ pnpm ${args.join(' ')}`)
  const result = spawnSync('pnpm', args, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, [PROUST_SAFE_PNPM_ENV]: '1' },
  })
  if (result.error) {
    console.error(`Could not run pnpm ${args.join(' ')}: ${result.error.message}`)
    return 1
  }
  return result.status ?? 1
}

const [subcommand, ...extraArgs] = process.argv.slice(2)
const unsafeArg = extraArgs.find((arg) => !isSafePnpmArg(arg))

const isKnownSubcommand = (SAFE_SUBCOMMANDS as readonly string[]).includes(subcommand)
const argsError = isKnownSubcommand ? validateSafePnpmArgs(subcommand as SafeSubcommand, extraArgs) : null

if (!isKnownSubcommand) {
  console.error(`Usage: safe-pnpm.ts <${SAFE_SUBCOMMANDS.join('|')}> [args...]`)
  process.exitCode = 2
} else if (unsafeArg !== undefined) {
  console.error(`Refusing to run: argument looks unsafe to pass to a shell: ${JSON.stringify(unsafeArg)}`)
  process.exitCode = 2
} else if (argsError !== null) {
  console.error(`Refusing to run: ${argsError}`)
  process.exitCode = 2
} else {
  const exitCode = runSafePnpm(subcommand as SafeSubcommand, extraArgs, spawnPnpm)
  if (exitCode !== 0) {
    console.error(
      '\nsafe-pnpm stopped — a step failed (see output above). package.json/pnpm-lock.yaml may ' +
        'already reflect the --lockfile-only resolution step; review before reverting (see ' +
        'check-supply-chain.ts header comment) or re-running.',
    )
  }
  process.exitCode = exitCode
}
