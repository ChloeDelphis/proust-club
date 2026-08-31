// Pure logic for the pre-install supply-chain check (see check-supply-chain.ts for the CLI entry
// point, and private/tickets/verification-osv-pre-install.md for the design rationale). No npm
// dependency, by design: this must be able to run before `node_modules` exists (right after
// `pnpm add/update --lockfile-only`, before the real install) — a devDependency here would create
// a circular requirement on the very install it's meant to gate.

export interface LockfilePackage {
  name: string
  version: string
}

const LOCKFILE_VERSION_HEADER = "lockfileVersion: '9.0'"

// Only the `packages:` block is read — it already gives deduplicated `name@version` pairs at
// exactly the granularity OSV expects, unlike `snapshots:` (peer-dependency-resolved variants).
// This is not a general YAML parser: it recognizes only the shape pnpm actually produces for
// lockfileVersion 9, and throws on anything else rather than guessing — a security check that
// silently under-reads its input is worse than one that refuses to run.
export function parseLockfilePackages(lockfileContent: string): LockfilePackage[] {
  const lines = lockfileContent.split(/\r\n|\r|\n/)

  if (!lines[0]?.startsWith(LOCKFILE_VERSION_HEADER)) {
    throw new Error(
      `Unrecognized pnpm-lock.yaml format: expected the first line to start with "${LOCKFILE_VERSION_HEADER}", got ${JSON.stringify(lines[0] ?? '')}. Refusing to guess — update this parser once the new format is confirmed.`,
    )
  }

  const packagesLineIndex = lines.indexOf('packages:')
  if (packagesLineIndex === -1) {
    // No `packages:` block at all — a lockfile with zero resolved dependencies is a legitimate
    // (if unlikely) shape, not a parsing failure. Nothing to check.
    return []
  }

  const packages: LockfilePackage[] = []
  const packageKeyPattern = /^ {2}(?:'([^']*)'|([^'][^:]*)):$/

  for (let i = packagesLineIndex + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line === '') continue
    if (!line.startsWith(' ')) break // next top-level key (`snapshots:` today) — end of the block
    if (!/^ {2}\S/.test(line)) continue // 4+-space indent: package metadata (resolution/engines/...), not a new entry

    const match = line.match(packageKeyPattern)
    if (!match) {
      throw new Error(`Unrecognized line in the pnpm-lock.yaml "packages:" block: ${JSON.stringify(line)}`)
    }
    const key = match[1] ?? match[2]
    const atIndex = key.lastIndexOf('@')
    if (atIndex <= 0) {
      throw new Error(`Could not split a package name/version out of "packages:" key: ${JSON.stringify(key)}`)
    }
    packages.push({ name: key.slice(0, atIndex), version: key.slice(atIndex + 1) })
  }

  return packages
}

export interface MaliciousDetection {
  name: string
  version: string
  id: string
}

export interface QueryMaliciousPackagesOptions {
  baseUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

interface OsvQuery {
  package: { name: string; ecosystem: 'npm' }
  version: string
  page_token?: string
}

interface OsvBatchResult {
  vulns?: { id: string }[]
  next_page_token?: string
}

interface OsvBatchResponse {
  results?: OsvBatchResult[]
}

// Entries from the OpenSSF Malicious Packages database (consumed by OSV) are exclusively
// identified with this prefix — ordinary CVE/GHSA advisories use other prefixes and are out of
// scope for this script (that's `pnpm audit`'s job, not this one's).
const MALICIOUS_PACKAGE_ID_PREFIX = 'MAL-'

async function postQueryBatch(
  queries: OsvQuery[],
  { baseUrl, fetchImpl, timeoutMs }: Required<QueryMaliciousPackagesOptions>,
): Promise<OsvBatchResponse> {
  const response = await fetchImpl(`${baseUrl}/v1/querybatch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ queries }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    throw new Error(`OSV querybatch request failed: ${response.status} ${response.statusText}`)
  }
  return (await response.json()) as OsvBatchResponse
}

// Checks every package/version pair against OSV's malicious-packages data. Absence of a result
// means "no known compromise found today" — never "this version is safe". querybatch paginates
// per-query past ~1000 vulns per query or ~3000 per batch (undocumented as a hard limit, but not
// to be silently truncated in a security check): every `next_page_token` is followed to
// exhaustion, via targeted continuation requests carrying only the queries still paginating,
// before a query is considered fully read.
export async function queryMaliciousPackages(
  packages: LockfilePackage[],
  options: QueryMaliciousPackagesOptions = {},
): Promise<MaliciousDetection[]> {
  const resolvedOptions: Required<QueryMaliciousPackagesOptions> = {
    baseUrl: options.baseUrl ?? 'https://api.osv.dev',
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? 10_000,
  }

  const detections: MaliciousDetection[] = []

  let pending: { packageIndex: number; query: OsvQuery }[] = packages.map((pkg, packageIndex) => ({
    packageIndex,
    query: { package: { name: pkg.name, ecosystem: 'npm' }, version: pkg.version },
  }))

  while (pending.length > 0) {
    const response = await postQueryBatch(
      pending.map((entry) => entry.query),
      resolvedOptions,
    )
    const results = response.results ?? []

    const next: typeof pending = []
    pending.forEach((entry, i) => {
      const result = results[i]
      if (!result) return
      const pkg = packages[entry.packageIndex]
      // Filtered inline, not accumulated then filtered afterward: OSV returns every advisory
      // (ordinary CVE/GHSA included), not just MAL- entries — most of that would otherwise be
      // stored per package just to be discarded a moment later.
      for (const vuln of result.vulns ?? []) {
        if (vuln.id.startsWith(MALICIOUS_PACKAGE_ID_PREFIX)) {
          detections.push({ name: pkg.name, version: pkg.version, id: vuln.id })
        }
      }
      if (result.next_page_token) {
        next.push({ packageIndex: entry.packageIndex, query: { ...entry.query, page_token: result.next_page_token } })
      }
    })
    pending = next
  }

  return detections
}

// The OSV advisory URL is deterministic from the ID — no need for a second `GET /v1/vulns/{id}`
// call just to produce a link (see ticket, "Proposition d'implémentation" §3).
export function formatDetection(detection: MaliciousDetection): string {
  return `  ${detection.name}@${detection.version} — ${detection.id} — https://osv.dev/vulnerability/${detection.id}`
}
