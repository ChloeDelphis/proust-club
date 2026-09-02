# Supply-chain check — Technical Design

A local script that checks the frontend's `pnpm-lock.yaml` against OSV's malicious-packages data (`MAL-*` entries, sourced from the [OpenSSF Malicious Packages](https://github.com/ossf/malicious-packages) database) before an install. It complements the controls in [ADR-008](../architecture/ADR-008-supply-chain-security.md) and `pnpm audit`: `pnpm audit` covers registry-exposed security advisories (CVE/GHSA), this script covers packages explicitly flagged as malicious — typosquats, compromised maintainer accounts, phishing-driven publishes — which are a different failure mode `pnpm audit` doesn't detect. See the sections below for the full design rationale and the decisions/trade-offs behind it.

---

## What it checks, and what it deliberately doesn't

- **Checks**: every `package@version` pair actually resolved in `apps/frontend/pnpm-lock.yaml` (direct and transitive) against OSV, filtered to `MAL-*` ids only.
- **Does not check**: ordinary CVE/GHSA advisories (`pnpm audit`'s job), package contents (no static/dynamic analysis — a name+version lookup against a declarative database only), the backend (Gradle, out of scope).
- **Absence of a result is not proof of safety** — only that no compromise is known to OSV today. This is stated explicitly in the script's own "clean" output, not just here.

---

## Usage — enforced, not manual

Use `pnpm safe:add <pkg>` / `pnpm safe:update [<pkg>]` / `pnpm safe:install` / `pnpm safe:remove <pkg>` — never `pnpm add`/`update`/`install`/`remove` directly. `apps/frontend/.pnpmfile.mjs` blocks the raw commands outright, so this isn't just a convention to remember.

The `safe:*` commands (`apps/frontend/scripts/safe-pnpm.ts`/`safePnpm.ts`) orchestrate the same sequence that used to be manual:

- **`safe:add`/`safe:update`** (these change the lockfile — the package/version isn't in it yet when the command starts, so checking the current lockfile first would check the wrong thing):
  1. `pnpm add <pkg> --lockfile-only --ignore-scripts` (or `update`) — resolve, write `pnpm-lock.yaml`, run nothing. `--lockfile-only` already prevents any real install (and therefore any lifecycle script) by itself; `--ignore-scripts` is added on top so that guarantee is explicit in the command itself.
  2. `pnpm check:supply-chain` against the freshly-resolved lockfile.
  3. If it passes: `pnpm install`, materializing `node_modules` from the already-checked lockfile. If it fails: the orchestrator stops and leaves step 1's `package.json`/`pnpm-lock.yaml` changes in place for review — not an unqualified `git checkout`, which would also discard unrelated local changes on those files if any were already there (see `check-supply-chain.ts`'s header comment for the exact reasoning).
- **`safe:install`** (lockfile already resolved, `package.json` unchanged): `pnpm check:supply-chain` then `pnpm install`. Takes no package arguments — `pnpm install <pkg>` is actually an alias for `pnpm add <pkg>` in pnpm, so `safe:install` refuses any argument that isn't a plain install flag (`--frozen-lockfile` etc.) rather than silently installing an unchecked package.
- **`safe:remove`** just runs `pnpm remove <pkg>` — nothing new is being installed, so there's nothing to check. It only exists because `.pnpmfile.mjs`'s guard can't distinguish `remove` from the others.

This sequence — not just running the script — is the actual mechanism; the script alone only answers "is this lockfile clean", it doesn't know which command produced it. See `apps/frontend/.pnpmfile.mjs` for how the sequence is enforced (a `preResolution` hook that rejects any pnpm add/update/install/remove invocation not carrying the orchestrator's `PROUST_SAFE_PNPM=1` marker) and `.claude/hooks/block-raw-pnpm.mjs` for the secondary, non-load-bearing layer that gives Claude a clear denial instead of hitting that block blind.

---

## Implementation

`apps/frontend/scripts/`:

- **`supplyChainCheck.ts`** — pure logic, zero npm dependency (deliberately — see "Why zero dependency" below): `parseLockfilePackages`, `queryMaliciousPackages`, `formatDetection`.
- **`check-supply-chain.ts`** — CLI entry point (`pnpm check:supply-chain`), reads the real lockfile, calls the above, sets the exit code.

### Lockfile parsing

`pnpm-lock.yaml` (lockfileVersion `9.0`) has two blocks: `packages:` (deduplicated `name@version` keys, exactly the granularity OSV expects) and `snapshots:` (peer-dependency-resolved variants, not needed here). Only `packages:` is read.

Not a general YAML parser — a minimal line scanner strictly scoped to the shape pnpm actually produces for this lockfile version, fail-closed on anything it doesn't recognize:

- First line must start with `lockfileVersion: '9.0'`, or the script refuses to run (rather than guess at an unfamiliar format).
- Inside `packages:`, a 2-space-indented `'name@version':` (or unquoted `name@version:`) line is a new entry; a 4+-space-indented line is metadata (`resolution:`, `engines:`, `peerDependencies:`, ...) belonging to the current entry; a 0-indent line ends the block. Anything else throws.

### OSV batch query and pagination

A single `POST https://api.osv.dev/v1/querybatch` request for the whole lockfile, which returns only `id` + `modified` per vulnerability (not full details — deliberately light). Filtered to ids starting with `MAL-`.

`querybatch` paginates a query past ~1000 vulns (or a batch past ~3000 total) via `next_page_token`. Every token is followed with a continuation request — carrying only the still-paginating queries, each with `page_token` set — until exhausted, before a query is treated as fully read. A partially-read page is never treated as a final verdict.

No second `GET /v1/vulns/{id}` call for a link: the advisory URL is deterministic (`https://osv.dev/vulnerability/{id}`), so the id alone is enough to produce one.

### Why zero dependency

This script must be able to run *before* `node_modules` exists — specifically, right after `pnpm add/update --lockfile-only`, before the real install that would populate it. A devDependency like a YAML parser would itself need `node_modules` to be importable, making the checker depend on the very install it's meant to gate. Built-ins only (`node:fs`, `fetch`, `AbortSignal.timeout`).

### Exit codes

| Code | Meaning |
|---|---|
| `0` | No `MAL-*` entry found on any checked pair. |
| `1` | At least one pair matches a `MAL-*` entry — do not install. |
| `2` | The check itself could not complete (lockfile unreadable/unrecognized format, OSV unreachable, non-OK HTTP response, timeout). Fail-closed: never `0` on failure. |

---

## What this deliberately does not do

- **No CI wiring for the OSV check itself.** CI trusts the already-committed, already-reviewed lockfile rather than re-running `check:supply-chain` on every job — see `apps/frontend/.pnpmfile.mjs`'s doc comment and the frontend CI workflow's `PROUST_SAFE_PNPM` env var.
- **No retry/backoff on the OSV call.** OSV documents no rate limit today; a failure fails the check closed instead of retrying.
- **No handling for non-registry lockfile entries** (`git:`, `file:`, tarball URLs, `link:`) beyond the parser's generic fail-closed behavior — none exist in this project's lockfile today (all direct dependencies are exact-pinned registry versions per ADR-008).

---

## Manual verification

- `pnpm check:supply-chain` on the current lockfile → exit `0`, "No known malicious package/version found."
- Point `queryMaliciousPackages` at a known-compromised pair (e.g. `eslint-config-prettier@8.10.1`, `MAL-2025-6022`) → detected, with the correct id and `osv.dev` link; an ordinary GHSA/CVE advisory on the same package is not reported.
- An empty `packages:` block or a missing one → exit `0`, no network call.
- An unrecognized `lockfileVersion` → exit `2`, explicit message, no best-effort parsing attempt.
- OSV unreachable (e.g. no network) → exit `2`, explicit message distinct from "nothing found".
