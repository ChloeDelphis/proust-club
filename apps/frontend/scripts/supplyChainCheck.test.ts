import { createServer, type Server } from 'node:http'
import { formatDetection, parseLockfilePackages, queryMaliciousPackages } from './supplyChainCheck'

describe('parseLockfilePackages', () => {
  it('extracts name/version pairs, including scoped packages', () => {
    const lockfile = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true

importers:

  .:
    dependencies:
      react:
        specifier: 19.2.0
        version: 19.2.0

packages:

  '@base-ui/react@1.7.0':
    resolution: {integrity: sha512-fake==}

  acorn@8.18.0:
    resolution: {integrity: sha512-fake==}
    engines: {node: '>=0.4.0'}

snapshots:

  '@base-ui/react@1.7.0(react@19.2.0)':
    dependencies:
      react: 19.2.0
`
    expect(parseLockfilePackages(lockfile)).toEqual([
      { name: '@base-ui/react', version: '1.7.0' },
      { name: 'acorn', version: '8.18.0' },
    ])
  })

  it('resolves an unquoted npm-alias key to the real underlying name/version, not the local alias', () => {
    // Real pattern, not hypothetical — eslint's own dependency chain aliases string-width this way.
    const lockfile = "lockfileVersion: '9.0'\n\npackages:\n\n  string-width-cjs@npm:string-width@4.2.3:\n    resolution: {integrity: sha512-fake==}\n"
    expect(parseLockfilePackages(lockfile)).toEqual([{ name: 'string-width', version: '4.2.3' }])
  })

  it('resolves a quoted, scoped npm-alias key to the real underlying name/version', () => {
    const lockfile = "lockfileVersion: '9.0'\n\npackages:\n\n  '@scoped-alias/pkg@npm:@babel/core@7.28.0':\n    resolution: {integrity: sha512-fake==}\n"
    expect(parseLockfilePackages(lockfile)).toEqual([{ name: '@babel/core', version: '7.28.0' }])
  })

  it('handles CRLF line endings (Windows checkout)', () => {
    const lockfile = ["lockfileVersion: '9.0'", '', 'packages:', '', '  acorn@8.18.0:', '    resolution: {integrity: sha512-fake==}', '', 'snapshots:', ''].join(
      '\r\n',
    )
    expect(parseLockfilePackages(lockfile)).toEqual([{ name: 'acorn', version: '8.18.0' }])
  })

  it('ignores a leading UTF-8 BOM (common on Windows, this project\'s dev environment, when a lockfile is re-saved by some editors)', () => {
    const lockfile = '\uFEFF' + "lockfileVersion: '9.0'\n\npackages:\n\n  acorn@8.18.0:\n    resolution: {integrity: sha512-fake==}\n"
    expect(parseLockfilePackages(lockfile)).toEqual([{ name: 'acorn', version: '8.18.0' }])
  })

  it('returns an empty array when there is no packages: block (no resolved dependencies)', () => {
    const lockfile = "lockfileVersion: '9.0'\n\nsettings:\n  autoInstallPeers: true\n"
    expect(parseLockfilePackages(lockfile)).toEqual([])
  })

  it('returns an empty array for an empty packages: block', () => {
    const lockfile = "lockfileVersion: '9.0'\n\npackages:\n\nsnapshots:\n"
    expect(parseLockfilePackages(lockfile)).toEqual([])
  })

  it('throws for an unrecognized lockfileVersion instead of guessing', () => {
    const lockfile = "lockfileVersion: '6.0'\n\npackages:\n\n  acorn@8.18.0:\n    resolution: {integrity: sha512-fake==}\n"
    expect(() => parseLockfilePackages(lockfile)).toThrow(/Unrecognized pnpm-lock\.yaml format/)
  })

  it('throws on a 2-space-indented line inside packages: that does not match the expected key shape', () => {
    // 0-indent lines legitimately end the block (next top-level key, e.g. snapshots:) — this
    // exercises a line that stayed inside the block's indentation but isn't a recognizable entry.
    const lockfile = "lockfileVersion: '9.0'\n\npackages:\n\n  this-is-not-a-valid-key-line\n"
    expect(() => parseLockfilePackages(lockfile)).toThrow(/Unrecognized line/)
  })

  it('throws on an oddly-indented line (1 or 3 spaces — pnpm never produces this) instead of silently dropping it', () => {
    // Neither the exactly-2-space entry pattern nor the 4+-space metadata skip matches this — must
    // not fall through unnoticed, or a tampered/corrupted entry would be silently excluded from
    // the check entirely rather than causing a loud failure.
    const oneSpace = "lockfileVersion: '9.0'\n\npackages:\n\n acorn@8.18.0:\n    resolution: {integrity: sha512-fake==}\n"
    expect(() => parseLockfilePackages(oneSpace)).toThrow(/Unrecognized line/)

    const threeSpaces = "lockfileVersion: '9.0'\n\npackages:\n\n   acorn@8.18.0:\n    resolution: {integrity: sha512-fake==}\n"
    expect(() => parseLockfilePackages(threeSpaces)).toThrow(/Unrecognized line/)
  })

  it('still treats deeply-nested 6-space metadata (e.g. peerDependencies children) as metadata, not a new entry', () => {
    const lockfile =
      "lockfileVersion: '9.0'\n\npackages:\n\n  zod-validation-error@4.0.2:\n    resolution: {integrity: sha512-fake==}\n    peerDependencies:\n      zod: ^3.25.0 || ^4.0.0\n\nsnapshots:\n"
    expect(parseLockfilePackages(lockfile)).toEqual([{ name: 'zod-validation-error', version: '4.0.2' }])
  })
})

describe('queryMaliciousPackages', () => {
  async function startStubServer(handler: (body: unknown, res: import('node:http').ServerResponse) => void) {
    const server: Server = createServer((req, res) => {
      let raw = ''
      req.on('data', (chunk) => {
        raw += chunk
      })
      req.on('end', () => {
        handler(JSON.parse(raw || '{}'), res)
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    return {
      baseUrl: `http://127.0.0.1:${port}`,
      close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    }
  }

  it('returns no detections when OSV reports nothing', async () => {
    const stub = await startStubServer((_body, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ results: [{}] }))
    })
    try {
      const detections = await queryMaliciousPackages([{ name: 'left-pad', version: '1.0.0' }], { baseUrl: stub.baseUrl })
      expect(detections).toEqual([])
    } finally {
      await stub.close()
    }
  })

  it('detects a MAL- entry returned on the first response (the CLI would exit 1 on this)', async () => {
    const stub = await startStubServer((_body, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ results: [{ vulns: [{ id: 'MAL-2026-1234' }] }] }))
    })
    try {
      const detections = await queryMaliciousPackages([{ name: 'evil-pkg', version: '1.2.3' }], { baseUrl: stub.baseUrl })
      expect(detections).toEqual([{ name: 'evil-pkg', version: '1.2.3', id: 'MAL-2026-1234' }])
    } finally {
      await stub.close()
    }
  })

  it('deduplicates lockfile entries that share the same name/version (e.g. several npm-alias local names for one real package) into a single OSV query', async () => {
    let receivedQueryCount = 0
    const stub = await startStubServer((body, res) => {
      receivedQueryCount = (body as { queries: unknown[] }).queries.length
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ results: [{ vulns: [{ id: 'MAL-2026-4242' }] }] }))
    })
    try {
      const detections = await queryMaliciousPackages(
        [
          { name: 'string-width', version: '4.2.3' },
          { name: 'string-width', version: '4.2.3' },
        ],
        { baseUrl: stub.baseUrl },
      )
      expect(receivedQueryCount).toBe(1)
      expect(detections).toEqual([{ name: 'string-width', version: '4.2.3', id: 'MAL-2026-4242' }])
    } finally {
      await stub.close()
    }
  })

  it('rejects with a clear message on a null entry inside "vulns", instead of a raw TypeError', async () => {
    const stub = await startStubServer((_body, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ results: [{ vulns: [null] }] }))
    })
    try {
      await expect(queryMaliciousPackages([{ name: 'some-pkg', version: '1.0.0' }], { baseUrl: stub.baseUrl })).rejects.toThrow(
        /vulnerability entry without a valid "id"/,
      )
    } finally {
      await stub.close()
    }
  })

  it('rejects with a clear message when "vulns" is present but not an array, instead of a raw TypeError or silently treating it as empty', async () => {
    const stub = await startStubServer((_body, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ results: [{ vulns: 'not-an-array' }] }))
    })
    try {
      await expect(queryMaliciousPackages([{ name: 'some-pkg', version: '1.0.0' }], { baseUrl: stub.baseUrl })).rejects.toThrow(
        /non-array "vulns"/,
      )
    } finally {
      await stub.close()
    }
  })

  it('ignores ordinary CVE/GHSA ids — that is pnpm audit\'s job, not this check\'s', async () => {
    const stub = await startStubServer((_body, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ results: [{ vulns: [{ id: 'GHSA-xxxx-yyyy-zzzz' }] }] }))
    })
    try {
      const detections = await queryMaliciousPackages([{ name: 'some-pkg', version: '2.0.0' }], { baseUrl: stub.baseUrl })
      expect(detections).toEqual([])
    } finally {
      await stub.close()
    }
  })

  it('rejects with a clear message on a vulnerability entry missing "id", instead of a raw TypeError', async () => {
    const stub = await startStubServer((_body, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ results: [{ vulns: [{}] }] }))
    })
    try {
      await expect(queryMaliciousPackages([{ name: 'some-pkg', version: '1.0.0' }], { baseUrl: stub.baseUrl })).rejects.toThrow(
        /vulnerability entry without a valid "id"/,
      )
    } finally {
      await stub.close()
    }
  })

  it('rejects when the response has fewer results than queries sent, rather than treating the unmatched packages as clean (fail-closed)', async () => {
    const stub = await startStubServer((_body, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      // Two queries sent, only one result returned.
      res.end(JSON.stringify({ results: [{}] }))
    })
    try {
      await expect(
        queryMaliciousPackages(
          [
            { name: 'pkg-a', version: '1.0.0' },
            { name: 'pkg-b', version: '1.0.0' },
          ],
          { baseUrl: stub.baseUrl },
        ),
      ).rejects.toThrow(/missing a result/)
    } finally {
      await stub.close()
    }
  })

  it('rejects on a non-OK HTTP response (the CLI would exit 2 on this, fail-closed)', async () => {
    const stub = await startStubServer((_body, res) => {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'boom' }))
    })
    try {
      await expect(queryMaliciousPackages([{ name: 'some-pkg', version: '1.0.0' }], { baseUrl: stub.baseUrl })).rejects.toThrow(
        /OSV querybatch request failed: 500/,
      )
    } finally {
      await stub.close()
    }
  })

  it('rejects when the OSV endpoint is unreachable (the CLI would exit 2 on this, fail-closed)', async () => {
    // Nothing listens on this port — fetch rejects immediately (ECONNREFUSED), without needing to
    // wait out a real timeout. The implementation still carries an explicit AbortSignal.timeout
    // for the case a real endpoint hangs instead of refusing.
    await expect(queryMaliciousPackages([{ name: 'some-pkg', version: '1.0.0' }], { baseUrl: 'http://127.0.0.1:1' })).rejects.toThrow()
  })

  it('follows next_page_token to a later page before concluding — never treats a partial page as final', async () => {
    let callCount = 0
    const stub = await startStubServer((body, res) => {
      callCount++
      res.writeHead(200, { 'content-type': 'application/json' })
      if (callCount === 1) {
        // First response: no MAL- entry on this page, but more pages exist for this query.
        res.end(JSON.stringify({ results: [{ next_page_token: 'continue-token' }] }))
        return
      }
      // Continuation request: must carry only the still-paginating query, with the token attached.
      const queries = (body as { queries: { page_token?: string }[] }).queries
      expect(queries).toHaveLength(1)
      expect(queries[0].page_token).toBe('continue-token')
      res.end(JSON.stringify({ results: [{ vulns: [{ id: 'MAL-2026-9999' }] }] }))
    })
    try {
      const detections = await queryMaliciousPackages([{ name: 'evil-pkg', version: '1.2.3' }], { baseUrl: stub.baseUrl })
      expect(detections).toEqual([{ name: 'evil-pkg', version: '1.2.3', id: 'MAL-2026-9999' }])
      expect(callCount).toBe(2)
    } finally {
      await stub.close()
    }
  })

  it('rejects instead of hanging forever if the endpoint keeps returning next_page_token indefinitely (fail-closed, not an infinite loop)', async () => {
    const stub = await startStubServer((_body, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      // Always another page — a malfunctioning/hostile endpoint, never a real OSV response.
      res.end(JSON.stringify({ results: [{ next_page_token: 'always-more' }] }))
    })
    try {
      await expect(queryMaliciousPackages([{ name: 'some-pkg', version: '1.0.0' }], { baseUrl: stub.baseUrl })).rejects.toThrow(
        /exceeded \d+ rounds/,
      )
    } finally {
      await stub.close()
    }
  })

  it('returns an empty array without any network call when there are no packages to check', async () => {
    const detections = await queryMaliciousPackages([], { baseUrl: 'http://127.0.0.1:1' })
    expect(detections).toEqual([])
  })
})

describe('formatDetection', () => {
  it('includes the deterministic osv.dev advisory link, without an extra API call', () => {
    expect(formatDetection({ name: 'evil-pkg', version: '1.2.3', id: 'MAL-2026-1234' })).toBe(
      '  evil-pkg@1.2.3 — MAL-2026-1234 — https://osv.dev/vulnerability/MAL-2026-1234',
    )
  })
})
