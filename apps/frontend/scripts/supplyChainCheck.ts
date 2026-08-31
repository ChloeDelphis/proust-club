// Pure logic for the pre-install supply-chain check (see check-supply-chain.ts for the CLI entry
// point, and docs/features/supply-chain-check.md for the design rationale). No npm
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
  // A UTF-8 BOM (common on Windows — this project's actual dev environment — when a lockfile is
  // re-saved by some editors/tools) would otherwise land inside lines[0] and make the exact-match
  // header check below fail on an otherwise perfectly valid lockfile.
  const withoutBom = lockfileContent.startsWith('\uFEFF') ? lockfileContent.slice(1) : lockfileContent
  const lines = withoutBom.split(/\r\n|\r|\n/)

  if (!lines[0]?.startsWith(LOCKFILE_VERSION_HEADER)) {
    throw new Error(
      `Unrecognized pnpm-lock.yaml format: expected the first line to start with "${LOCKFILE_VERSION_HEADER}", got ${JSON.stringify(lines[0] ?? '')}. Refusing to guess — update this parser once the new format is confirmed.`,
    )
  }

  // Trailing whitespace is YAML-insignificant (unlike arbitrary trailing content, which is not
  // tolerated — trimEnd, not startsWith), so it shouldn't make this line "not found" and silently
  // fall into the empty-lockfile path below.
  const packagesLineIndex = lines.findIndex((line) => line.trimEnd() === 'packages:')
  if (packagesLineIndex === -1) {
    // No `packages:` block at all — a lockfile with zero resolved dependencies is a legitimate
    // (if unlikely) shape, not a parsing failure. Nothing to check.
    return []
  }

  const packages: LockfilePackage[] = []
  // Unquoted branch excludes whitespace (not just the quote character) so a line indented by an
  // unexpected amount (1, 3, 5 spaces — never produced by pnpm, but not to be silently absorbed
  // either) can't accidentally satisfy this pattern with a mangled, space-prefixed "name". It does
  // *not* exclude ":" — pnpm's npm-alias keys (`alias@npm:realname@version`) legitimately contain
  // one; YAML only treats a colon as a key/value separator when followed by whitespace or EOL, so
  // the trailing, greedily-matched ":" here still correctly lands on the real line-ending colon.
  // Trailing whitespace after that colon is tolerated (`\s*$`, not a bare `$`) — YAML-insignificant,
  // same reasoning as the `trimEnd()` already applied to the "packages:" header line below; without
  // it, an editor-introduced trailing space would abort the whole check (exit 2) over an otherwise
  // valid, untampered lockfile.
  const packageKeyPattern = /^ {2}(?:'([^']*)'|([^'\s][^\s]*)):\s*$/

  // pnpm writes an aliased dependency's packages: key as `<local-alias>@npm:<real-name>@<version>`
  // (e.g. `string-width-cjs@npm:string-width@4.2.3` — eslint's own dependency chain uses this).
  // The alias is a local name, not what's actually installed/executed — resolving past it to the
  // real name/version is required for the OSV query to mean anything; splitting on the outer alias
  // would either query a name nobody publishes or, worse, silently query the wrong package and
  // report "clean" without ever having checked the one that's actually there.
  const NPM_ALIAS_MARKER = '@npm:'

  for (let i = packagesLineIndex + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line === '') continue
    if (!line.startsWith(' ')) {
      // A 0-indent line ends the block (next top-level key, `snapshots:` today) — but any 0-indent
      // line at all, unvalidated, would also silently truncate the scan on stray/corrupted content
      // (e.g. an unresolved merge-conflict marker), dropping every package after it from the check
      // without an error. Every real top-level key in this file is a bare `key:` with no inline
      // value — requiring that shape catches the corrupted case without hardcoding "snapshots:"
      // specifically, in case a future pnpm version orders/names top-level keys differently.
      // trimEnd() for the same reason as the "packages:" lookup and the entry-key pattern above:
      // trailing whitespace is YAML-insignificant and shouldn't abort an otherwise valid lockfile.
      if (!line.trimEnd().endsWith(':')) {
        throw new Error(`Unrecognized line ending the pnpm-lock.yaml "packages:" block: ${JSON.stringify(line)}`)
      }
      break
    }
    // 4+-space indent: package metadata (resolution/engines/...), not a new entry. Known,
    // accepted gap: a package key mistakenly indented at 4+ spaces (instead of 2) would be
    // silently absorbed here as metadata rather than rejected. Distinguishing the two would need
    // either a whitelist of known metadata field names (fragile, incomplete, drifts with pnpm) or
    // rejecting any 4+-space content that doesn't match a known shape (false-positive risk on
    // legitimate metadata this parser hasn't seen yet) — more sophistication than the
    // deliberately minimal parser this script commits to (see the ticket). Real pnpm output never
    // produces this shape; accepted as an edge case rather than engineered around.
    if (/^ {4,}\S/.test(line)) continue

    const match = line.match(packageKeyPattern)
    if (!match) {
      throw new Error(`Unrecognized line in the pnpm-lock.yaml "packages:" block: ${JSON.stringify(line)}`)
    }
    const rawKey = match[1] ?? match[2]
    const aliasIndex = rawKey.indexOf(NPM_ALIAS_MARKER)
    const key = aliasIndex === -1 ? rawKey : rawKey.slice(aliasIndex + NPM_ALIAS_MARKER.length)
    const atIndex = key.lastIndexOf('@')
    // atIndex <= 0 rejects a missing/empty name (no "@" at all, or "@" as the very first
    // character); atIndex === key.length - 1 rejects a missing/empty version (a trailing "@" with
    // nothing after it, e.g. a corrupted `foo@:` key) — both would otherwise manufacture a
    // {name, version} pair for a package/version that doesn't actually exist, instead of failing.
    if (atIndex <= 0 || atIndex === key.length - 1) {
      throw new Error(`Could not split a package name/version out of "packages:" key: ${JSON.stringify(rawKey)}`)
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

// Each request already has its own timeout, but that only bounds a single round — an endpoint (or
// a misbehaving proxy) that keeps returning next_page_token forever would otherwise make the
// pagination loop below run indefinitely: no failure, just a hang, which defeats fail-closed just
// as badly as a false "clean" would. A real OSV response pages a handful of times at most even
// for a large batch; this ceiling exists to turn a malfunctioning endpoint into an explicit
// exit-2 failure instead of an unbounded wait.
const MAX_PAGINATION_ROUNDS = 50

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

  // Multiple lockfile entries can resolve to the same underlying name/version — most commonly
  // several npm-alias local names pointing at the same real package (see the alias resolution
  // above). Deduping before querying means OSV isn't asked the same question twice, each
  // independently paginated, for what is ultimately one installed package.
  const uniquePackages = [...new Map(packages.map((pkg) => [`${pkg.name}@${pkg.version}`, pkg])).values()]

  let pending: { pkg: LockfilePackage; query: OsvQuery }[] = uniquePackages.map((pkg) => ({
    pkg,
    query: { package: { name: pkg.name, ecosystem: 'npm' }, version: pkg.version },
  }))

  let round = 0
  while (pending.length > 0) {
    round++
    if (round > MAX_PAGINATION_ROUNDS) {
      throw new Error(
        `OSV querybatch pagination exceeded ${MAX_PAGINATION_ROUNDS} rounds without completing (${pending.length} quer${pending.length === 1 ? 'y' : 'ies'} still paginating) — refusing to continue indefinitely.`,
      )
    }
    const response = await postQueryBatch(
      pending.map((entry) => entry.query),
      resolvedOptions,
    )
    const results = response.results ?? []

    const next: typeof pending = []
    pending.forEach((entry, i) => {
      const result = results[i]
      // `!result` catches missing/null/undefined; `typeof result !== 'object'` also catches a
      // truthy non-object entry (a bare number or string) — accessing `.vulns`/`.next_page_token`
      // on either would silently read as `undefined` rather than throw, so without this check a
      // primitive entry would be treated as "nothing found, no more pages" instead of failing.
      if (!result || typeof result !== 'object') {
        // A missing/malformed entry here means the response doesn't line up with the queries
        // actually sent (truncated/malformed response, an undocumented per-request cap, ...).
        // Silently treating it as "nothing found" would report a package as clean without having
        // actually checked it — the opposite of fail-closed. Throwing surfaces it as exit 2 instead.
        throw new Error(
          `OSV querybatch response is missing a valid result for query ${i} (sent ${pending.length}, received ${results.length}) — refusing to treat the corresponding package as checked.`,
        )
      }
      const pkg = entry.pkg
      // Filtered inline, not accumulated then filtered afterward: OSV returns every advisory
      // (ordinary CVE/GHSA included), not just MAL- entries — most of that would otherwise be
      // stored per package just to be discarded a moment later.
      // `vulns` absent means "no vulnerabilities" (matches the type), but present-and-not-an-array
      // is a malformed response — fail-closed like every other unexpected shape here, not silently
      // treated as "nothing found".
      if (result.vulns !== undefined && !Array.isArray(result.vulns)) {
        throw new Error(`OSV querybatch response has a non-array "vulns" for query ${i} — refusing to guess its contents.`)
      }
      for (const vuln of result.vulns ?? []) {
        // The response is untrusted network JSON cast through `as OsvBatchResponse` — `id: string`
        // (and `vulns` being an array of objects at all) is only a compile-time claim, not a
        // runtime guarantee. A malformed entry here would otherwise crash with a raw, unhelpful
        // TypeError instead of the deliberately clear fail-closed message used for the
        // structurally identical case above (missing `result`) — `vuln` itself can be `null` or a
        // non-object, not just missing `id`, so both are checked before touching `vuln.id`.
        if (vuln === null || typeof vuln !== 'object' || typeof vuln.id !== 'string') {
          throw new Error(`OSV querybatch response contains a vulnerability entry without a valid "id" for query ${i} — refusing to guess whether it's a MAL- entry.`)
        }
        if (vuln.id.startsWith(MALICIOUS_PACKAGE_ID_PREFIX)) {
          detections.push({ name: pkg.name, version: pkg.version, id: vuln.id })
        }
      }
      if (result.next_page_token) {
        next.push({ pkg: entry.pkg, query: { ...entry.query, page_token: result.next_page_token } })
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
