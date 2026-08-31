# Frontend dependency security strategy

This is a living document (like `data-model.md`, not a frozen ADR): it describes the current policy for the frontend's dependency chain (`apps/frontend/`), kept accurate as the policy evolves. For the historical reasoning behind individual decisions, see `docs/architecture/ADR-008-supply-chain-security.md`.

Two controls exist, answering two different questions. Neither replaces the other, and neither guarantees safety — no finding means "nothing known today," never "proven safe."

## 1. Malicious / compromised packages — `OSV MAL-*`

**Question:** has this exact `package@version` pair been explicitly reported as malicious or compromised (typosquat, hijacked maintainer account, supply-chain attack campaign)?

- Checks the resolved lockfile against OSV, filtered to `MAL-*` entries (the OpenSSF Malicious Packages database within OSV) — not ordinary CVEs/GHSAs.
- Run **before** any `pnpm install`/`add`/`update` that changes a resolved version — the point is to catch a known-malicious version before its install-time scripts can run.
- Command: `pnpm check:supply-chain` (`apps/frontend/scripts/check-supply-chain.ts`) — see `docs/features/supply-chain-check.md` for the full design (lockfile parsing, OSV batch query, exit codes) and the exact `install` vs `add`/`update` sequence.
- Manual only for now — no automatic `preinstall` hook and no CI wiring exist yet for this check (tracked separately, not this document's scope).
- No finding ≠ safe — only "not flagged as malicious in OSV as of this check."

## 2. Known vulnerabilities — `pnpm audit`

**Question:** does a publicly known vulnerability (CVE/GHSA) apply to the dependency tree that's already installed?

Two distinct commands, on purpose:

| Command | Threshold | Use |
| --- | --- | --- |
| `pnpm audit` | none (shows every severity, including Low/Moderate) | Full visibility — local inspection, curiosity, deciding whether a Low/Moderate is worth acting on even though it doesn't block anything. |
| `pnpm audit:security` (`pnpm audit --audit-level high`) | High/Critical only | The one blocking gate — reused as-is in `frontend-ci.yml`, the weekly workflow, and the future release workflow. |

The threshold lives **only** in the `audit:security` script in `apps/frontend/package.json` — deliberately not in `pnpm-workspace.yaml`'s `audit.level` setting, which would apply project-wide and silently hide Low/Moderate from a plain `pnpm audit` too. Keeping it in one script means one source of truth for "what blocks," without making Low/Moderate invisible.

**Why High/Critical, not everything:** Low/Moderate advisories are frequent (often in dev-only transitive dependencies, not always realistically exploitable here) — blocking on them would turn the gate red often enough that it stops being trusted. High/Critical represent a realistic impact (arbitrary code execution, auth bypass, etc.) and are worth blocking every time. Confirmed in practice: the first real CI run under this policy caught two genuine High-severity vulnerabilities (`js-yaml`, `nanoid`, both transitive) — see the ADR-008 addendum.

**When it runs:**

- **Manual, any time:** `pnpm audit` (full visibility) or `pnpm audit:security` (same check CI runs).
- **On every PR/push touching the frontend:** `frontend-ci.yml` runs `pnpm audit:security`.
- **Weekly, regardless of code changes:** `.github/workflows/frontend-security-audit.yml` runs the same `pnpm audit --audit-level high` check on a schedule — this is what catches an advisory published on a dependency that hasn't changed in weeks, which the PR-triggered check alone would never see. This workflow calls the raw command rather than the `audit:security` script: running any `package.json` script via `pnpm run` (which is what `pnpm audit:security` resolves to) makes pnpm materialize `node_modules` first if it's missing, even though the plain `pnpm audit` subcommand itself never needs it — defeating the point of skipping installation in a job that only needs the lockfile and registry access. Keep the threshold in the workflow's inline flag in sync with the `audit:security` script if it ever changes.
- **Before release:** not wired yet (no release workflow exists), but `pnpm audit:security` is the command to reuse as a blocking step once it does — a future release job installs dependencies anyway (build step), so the `install: false` concern doesn't apply there.

**Weekly run output:** each run writes a one-line pass/fail summary to the workflow's GitHub Actions summary page (no need to open the logs to see the result), and uploads the full `pnpm audit` output — both the blocking High/Critical result and a second, always-informational full-severity run (Low/Moderate included, never blocking) — as a downloadable `pnpm-audit-report` artifact.

**Registry/network failure:** `pnpm audit` fails (non-zero exit) by default if the registry can't be reached — `--ignore-registry-errors` is deliberately never used in this project, so a failed check is never mistaken for "nothing found." A vulnerability finding and an audit failure both produce a non-zero exit; the command's output text is what distinguishes them (visible in CI logs).

## Complementary, not redundant

| | `OSV MAL-*` | `pnpm audit` |
| --- | --- | --- |
| Protects against | Known active compromises (malicious publish) | Known declared vulnerabilities (CVE/GHSA) in what's already installed |
| Trigger | Before install/version change | Manual, on every PR/push, weekly, before release |
| Catches drift with no code change | No — nothing to check if nothing is installing | Yes — the weekly run exists specifically for this |

## GitHub-native monitoring (Dependabot)

Dependabot alerts provide overlapping, GitHub-native visibility into the same class of advisories `pnpm audit` checks — complementary, not a replacement for the workflow described here (tracked separately).
