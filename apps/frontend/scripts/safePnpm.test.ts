import { buildPnpmSteps, isSafePnpmArg, runSafePnpm, validateSafePnpmArgs } from './safePnpm'

describe('validateSafePnpmArgs', () => {
  it('rejects a package spec on install — pnpm treats "install <pkg>" as "add <pkg>"', () => {
    // Regression test: verified empirically that `pnpm install left-pad` adds left-pad to
    // package.json/pnpm-lock.yaml and installs it for real, identically to `pnpm add left-pad`.
    // buildPnpmSteps's 'install' case only runs check:supply-chain against the *old* lockfile, so
    // a package name here would install unchecked — bypassing the entire mechanism.
    expect(validateSafePnpmArgs('install', ['lodash'])).toMatch(/safe:add/)
  })

  it('allows install with no args', () => {
    expect(validateSafePnpmArgs('install', [])).toBeNull()
  })

  it('allows package specs on add/update/remove', () => {
    expect(validateSafePnpmArgs('add', ['lodash'])).toBeNull()
    expect(validateSafePnpmArgs('update', ['lodash'])).toBeNull()
    expect(validateSafePnpmArgs('remove', ['lodash'])).toBeNull()
  })
})

describe('isSafePnpmArg', () => {
  it('accepts ordinary package specs', () => {
    expect(isSafePnpmArg('lodash')).toBe(true)
    expect(isSafePnpmArg('@scope/pkg')).toBe(true)
    expect(isSafePnpmArg('lodash@4.17.21')).toBe(true)
    expect(isSafePnpmArg('lodash@^4.17.21')).toBe(false) // this repo pins exact versions anyway
  })

  it('accepts file:/git:/https: sources', () => {
    expect(isSafePnpmArg('file:../local-pkg')).toBe(true)
    expect(isSafePnpmArg('git+https://github.com/user/repo.git')).toBe(true)
  })

  it('rejects flag injection — a leading "-" is never a package spec', () => {
    // Regression test: an injected --registry flag would silently repoint dependency resolution
    // to an attacker-controlled registry — bypassing check:supply-chain entirely, since it only
    // checks name@version identity against OSV, not where the tarball actually came from.
    expect(isSafePnpmArg('--registry=https://attacker.example/')).toBe(false)
    expect(isSafePnpmArg('--registry')).toBe(false)
    // Split across two argv entries, "https://attacker.example/" alone still looks like a
    // harmless URL-shaped string — this is the case the character class alone can't catch.
    expect(isSafePnpmArg('-r')).toBe(false)
  })

  it('rejects shell metacharacters', () => {
    expect(isSafePnpmArg('lodash; rm -rf /')).toBe(false)
    expect(isSafePnpmArg('lodash && echo pwned')).toBe(false)
    expect(isSafePnpmArg('$(whoami)')).toBe(false)
    expect(isSafePnpmArg('lodash|cat')).toBe(false)
    expect(isSafePnpmArg('lodash"')).toBe(false)
    expect(isSafePnpmArg('lodash with spaces')).toBe(false)
  })
})

describe('buildPnpmSteps', () => {
  it('add: resolves lockfile-only/ignore-scripts, checks, then installs', () => {
    expect(buildPnpmSteps('add', ['lodash'])).toEqual([
      ['add', 'lodash', '--lockfile-only', '--ignore-scripts'],
      ['check:supply-chain'],
      ['install'],
    ])
  })

  it('add: forwards multiple extra args (e.g. several packages, or version-pinned specs)', () => {
    expect(buildPnpmSteps('add', ['lodash@4.17.21', 'zod'])).toEqual([
      ['add', 'lodash@4.17.21', 'zod', '--lockfile-only', '--ignore-scripts'],
      ['check:supply-chain'],
      ['install'],
    ])
  })

  it('update: same shape as add but with the update subcommand', () => {
    expect(buildPnpmSteps('update', ['lodash'])).toEqual([
      ['update', 'lodash', '--lockfile-only', '--ignore-scripts'],
      ['check:supply-chain'],
      ['install'],
    ])
  })

  it('update: works with no extra args (update everything)', () => {
    expect(buildPnpmSteps('update', [])).toEqual([
      ['update', '--lockfile-only', '--ignore-scripts'],
      ['check:supply-chain'],
      ['install'],
    ])
  })

  it('install: no lockfile-only resolution step, nothing new to check', () => {
    expect(buildPnpmSteps('install', [])).toEqual([['check:supply-chain'], ['install']])
  })

  it('install: forwards extra args to the real install step rather than dropping them', () => {
    // buildPnpmSteps itself doesn't validate args — callers must run validateSafePnpmArgs first
    // (which the CLI wrapper does, and which rejects any package-spec-shaped arg on 'install' —
    // see the regression test above). This test only proves the plumbing itself isn't lossy for
    // whatever does get through validation (e.g. a genuine install flag, if one is ever added to
    // the allowlist).
    expect(buildPnpmSteps('install', ['extra-arg'])).toEqual([
      ['check:supply-chain'],
      ['install', 'extra-arg'],
    ])
  })

  it('remove: just the removal itself, nothing new to check', () => {
    expect(buildPnpmSteps('remove', ['lodash'])).toEqual([['remove', 'lodash']])
  })
})

describe('runSafePnpm', () => {
  it('runs every step in order when each succeeds', () => {
    const calls: string[][] = []
    const exitCode = runSafePnpm('add', ['lodash'], (args) => {
      calls.push(args)
      return 0
    })
    expect(exitCode).toBe(0)
    expect(calls).toEqual([
      ['add', 'lodash', '--lockfile-only', '--ignore-scripts'],
      ['check:supply-chain'],
      ['install'],
    ])
  })

  it('stops immediately when check:supply-chain fails, never runs the real install', () => {
    const calls: string[][] = []
    const exitCode = runSafePnpm('add', ['lodash'], (args) => {
      calls.push(args)
      return args[0] === 'check:supply-chain' ? 1 : 0
    })
    expect(exitCode).toBe(1)
    expect(calls).toEqual([
      ['add', 'lodash', '--lockfile-only', '--ignore-scripts'],
      ['check:supply-chain'],
    ])
  })

  it('stops immediately when the lockfile-only resolution step itself fails', () => {
    const calls: string[][] = []
    const exitCode = runSafePnpm('add', ['not-a-real-package'], (args) => {
      calls.push(args)
      return args[0] === 'add' ? 1 : 0
    })
    expect(exitCode).toBe(1)
    expect(calls).toEqual([['add', 'not-a-real-package', '--lockfile-only', '--ignore-scripts']])
  })

  it('propagates the exact non-zero exit code of the failing step', () => {
    const exitCode = runSafePnpm('install', [], (args) => (args[0] === 'check:supply-chain' ? 2 : 0))
    expect(exitCode).toBe(2)
  })
})
