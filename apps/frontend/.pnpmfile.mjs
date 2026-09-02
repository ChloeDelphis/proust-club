/**
 * Blocks any pnpm add/update/install/remove invocation that didn't go through the repo's safe
 * dependency commands (`pnpm safe:add`/`safe:update`/`safe:install`/`safe:remove`), which run
 * `check:supply-chain` (OSV `MAL-*` check) before anything is written to node_modules.
 * See docs/features/supply-chain-check.md.
 *
 * `preResolution` runs before any write to node_modules/pnpm-lock.yaml/package.json — verified
 * empirically against pnpm 11.19.0, including with `--ignore-scripts`, `--lockfile-only`, and on
 * a genuine no-op re-run (unlike a `preinstall` lifecycle script, which pnpm skips entirely when
 * there's nothing to do, and which in any case only runs after fetch/link, too late to matter
 * here). Deliberately not a defense against someone actively trying to disable it — `pnpm
 * --ignore-pnpmfile` bypasses this file entirely, and that person could just as easily edit this
 * file. The goal is only to stop a reflexive `pnpm add <pkg>` from doing damage.
 *
 * The condition below is a literal, not an import from scripts/safePnpm.ts — this file runs
 * inside pnpm's own Node process, and relying on however that process happens to load
 * TypeScript isn't something this repo controls or has verified. It's covered indirectly by
 * safePnpm.test.ts's `buildPnpmSteps`/`runSafePnpm` tests and the real end-to-end pnpm runs in
 * docs/features/supply-chain-check.md's manual verification, not by a unit test of this literal
 * itself — keep this comment (and this file) in sync if the marker/env var name ever changes.
 */

export const hooks = {
  preResolution(_context) {
    if (process.env.PROUST_SAFE_PNPM !== '1') {
      throw new Error(
        "Direct pnpm add/update/install/remove is blocked. Use 'pnpm safe:add', 'pnpm safe:update', " +
          "'pnpm safe:install', or 'pnpm safe:remove' instead — add/update/install run the OSV " +
          'supply-chain check before installing. See docs/features/supply-chain-check.md.',
      )
    }
  },
}
