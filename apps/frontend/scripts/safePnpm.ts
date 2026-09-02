export type SafeSubcommand = 'add' | 'update' | 'install' | 'remove'

export const PROUST_SAFE_PNPM_ENV = 'PROUST_SAFE_PNPM'

/**
 * Same condition as .pnpmfile.mjs's preResolution guard (kept as a literal there too, on
 * purpose — a `.pnpmfile.mjs` importing a `.ts` helper would depend on however pnpm's own Node
 * process happens to load TypeScript, which isn't something this repo controls or has verified;
 * not worth the risk for a one-line, load-bearing check). This copy exists so the condition is
 * covered by a normal typed unit test; if you change one, change the other.
 */
export function isSafePnpmInvocation(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[PROUST_SAFE_PNPM_ENV] === '1'
}

/**
 * The pnpm invocations for each safe subcommand, in order. `add`/`update` resolve the new graph
 * without touching node_modules first (`--lockfile-only --ignore-scripts`), so the supply-chain
 * check runs against the already-rewritten lockfile before any third-party code is fetched.
 *
 * `remove` doesn't introduce any new package, so there's nothing to check — it only exists here
 * because .pnpmfile.mjs's preResolution guard blocks *any* pnpm add/update/install/remove without
 * the PROUST_SAFE_PNPM marker (it has no way to tell them apart), so a plain `pnpm remove <pkg>`
 * would otherwise be blocked for no real reason.
 */
export function buildPnpmSteps(subcommand: SafeSubcommand, extraArgs: string[]): string[][] {
  switch (subcommand) {
    case 'add':
      return [
        ['add', ...extraArgs, '--lockfile-only', '--ignore-scripts'],
        ['check:supply-chain'],
        ['install'],
      ]
    case 'update':
      return [
        ['update', ...extraArgs, '--lockfile-only', '--ignore-scripts'],
        ['check:supply-chain'],
        ['install'],
      ]
    case 'install':
      return [['check:supply-chain'], ['install']]
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
// A character-class check alone would still accept `--registry=https://attacker.example/` (every
// character in that string is otherwise "safe"), which pnpm would honor for that one resolution:
// the poisoned resolution gets written into pnpm-lock.yaml, check:supply-chain checks the
// requested name@version against OSV (identity, not artifact hash — it has no way to know the
// tarball came from a different registry), and the final `pnpm install` step re-fetches from that
// same pinned registry — a full bypass of the check this whole mechanism exists to enforce.
// Splitting the flag across two args (`--registry https://...`) would defeat a character-class
// check just as easily, which is why this rejects *any* leading `-`, not just specific flags.
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
