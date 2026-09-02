export type SafeSubcommand = 'add' | 'update' | 'install' | 'remove'

export const PROUST_SAFE_PNPM_ENV = 'PROUST_SAFE_PNPM'

/**
 * The pnpm invocations for each safe subcommand, in order. `add`/`update` resolve the new graph
 * without touching node_modules first (`--lockfile-only --ignore-scripts`), so the supply-chain
 * check runs against the already-rewritten lockfile before any third-party code is fetched.
 * `install`'s extraArgs (e.g. `--frozen-lockfile`) are forwarded to the real install step, not
 * the check — there's nothing for check:supply-chain to do with an install-specific flag.
 *
 * `remove` doesn't introduce any new package, so there's nothing to check — it only exists here
 * because .pnpmfile.mjs's preResolution guard blocks *any* pnpm add/update/install/remove without
 * the PROUST_SAFE_PNPM marker (it has no way to tell them apart), so a plain `pnpm remove <pkg>`
 * would otherwise be blocked for no real reason.
 */
export function buildPnpmSteps(subcommand: SafeSubcommand, extraArgs: string[]): string[][] {
  switch (subcommand) {
    case 'add':
    case 'update':
      return [
        [subcommand, ...extraArgs, '--lockfile-only', '--ignore-scripts'],
        ['check:supply-chain'],
        ['install'],
      ]
    case 'install':
      return [['check:supply-chain'], ['install', ...extraArgs]]
    case 'remove':
      return [['remove', ...extraArgs]]
  }
}

// Package specs pnpm accepts: name (with optional @scope), optional @version/@range, or a
// file:/git:/https: source. No shell metacharacters — the CLI wrapper spawns pnpm with
// `shell: true` (needed on Windows to resolve the pnpm.cmd shim), so args must be validated
// before use rather than relying on quoting to neutralize them.
//
// Rejecting a leading `-` is not just character hygiene — it's the actual security boundary.
// `=` isn't in the character class above, so `--registry=<url>` is already rejected by the class
// check alone — but `--registry <url>` split across two separate argv entries is not: `<url>` on
// its own is a "safe"-looking string. Either form, if it slipped through, would let pnpm resolve
// that one package from an attacker-controlled registry: the poisoned resolution gets written
// into pnpm-lock.yaml, check:supply-chain only checks the requested name@version identity against
// OSV (not the actual tarball's origin), and the final `pnpm install` step re-fetches from that
// same pinned registry — a full bypass of the check this whole mechanism exists to enforce.
// Rejecting any leading `-` closes both forms, current and future flags alike, rather than
// denylisting `--registry` specifically.
const SAFE_PNPM_ARG = /^[A-Za-z0-9@_./:+~-]+$/

export function isSafePnpmArg(arg: string): boolean {
  return !arg.startsWith('-') && SAFE_PNPM_ARG.test(arg)
}

export type PnpmRunner = (args: string[]) => number

/**
 * Runs each step in order via the injected runner, stopping at the first non-zero exit code
 * (mirrors the fail-closed behaviour already documented in check-supply-chain.ts). Does not
 * attempt to revert whatever the `--lockfile-only` step already wrote to package.json/
 * pnpm-lock.yaml on failure — see that file's header comment for why an automatic revert would be
 * unsafe in general (it could discard unrelated pre-existing local changes on those same files).
 */
export function runSafePnpm(subcommand: SafeSubcommand, extraArgs: string[], run: PnpmRunner): number {
  const steps = buildPnpmSteps(subcommand, extraArgs)
  for (const step of steps) {
    const exitCode = run(step)
    if (exitCode !== 0) {
      return exitCode
    }
  }
  return 0
}
