import { buildPnpmSteps, isSafePnpmArg, isSafePnpmInvocation, runSafePnpm } from './safePnpm'

describe('isSafePnpmInvocation', () => {
  it('is true only when the marker is exactly "1"', () => {
    expect(isSafePnpmInvocation({ PROUST_SAFE_PNPM: '1' })).toBe(true)
  })

  it('is false when the marker is missing', () => {
    expect(isSafePnpmInvocation({})).toBe(false)
  })

  it('is false when the marker is set to a truthy-looking non-"1" value', () => {
    expect(isSafePnpmInvocation({ PROUST_SAFE_PNPM: 'true' })).toBe(false)
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
    // Regression test: a character-class check alone still accepted these (every character is
    // otherwise "safe"), letting an injected --registry flag silently repoint dependency
    // resolution to an attacker-controlled registry — bypassing check:supply-chain entirely,
    // since it only checks name@version identity against OSV, not where the tarball came from.
    expect(isSafePnpmArg('--registry=https://attacker.example/')).toBe(false)
    expect(isSafePnpmArg('--registry')).toBe(false) // split across two args defeats a naive check
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
