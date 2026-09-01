# ADR-008: Supply chain security — pnpm baseline

## Decision

Four complementary controls on the frontend's dependency chain (`apps/frontend/`):

1. **`minimumReleaseAge: 4320` (3 days), `minimumReleaseAgeStrict: true`** in `pnpm-workspace.yaml`.
2. **Exact version pinning** in `package.json` — no `^`/`~`/`>=` ranges on direct dependencies.
3. **Install script restriction** via `allowBuilds`/`onlyBuiltDependencies` (already in place, reviewed here).
4. **`pnpm audit` and `pnpm audit signatures`** run manually for now (no CI yet — see below).

## Context

Recent NPM ecosystem attacks have shown that a compromised dependency can execute arbitrary code at install time via `preinstall`/`postinstall` scripts, potentially reaching developer machines or CI runners and any credentials available in that environment. This ADR documents the baseline put in place to reduce that exposure for Proust Club's frontend.

## `minimumReleaseAge`

pnpm 11 (the version used here, `11.19.0`) already defaults `minimumReleaseAge` to `1440` minutes (1 day) — this project raises it explicitly to `4320` (3 days). Malware in newly published packages is typically caught and unpublished within the first day or two; a 3-day window trades a small amount of freshness for a meaningfully lower chance of installing a version before it's been flagged.

`minimumReleaseAgeStrict: true` is set explicitly, even though it is already pnpm's default once `minimumReleaseAge` is configured (per pnpm's settings reference: strict defaults to `true` when the setting is explicit, `false` otherwise). Written explicitly here so the intent doesn't silently depend on an undocumented default.

**Trade-off accepted:** this also delays adoption of legitimate emergency security patches on already-used dependencies by the same window. pnpm exposes `minimumReleaseAgeExclude` (a list of packages exempt from the delay) as an escape hatch — not configured today since no such case has come up, but the right tool if one does (e.g. an urgent CVE fix on a dependency already in use).

## Exact version pinning

`package.json` direct dependencies (`dependencies` + `devDependencies`) are pinned to exact versions rather than ranges. The lockfile already guarantees reproducible installs in principle, but a range leaves room for a `pnpm add`, a `pnpm update`, or a lockfile regeneration to silently resolve a newer — potentially compromised — version without a visible diff in `package.json`. Exact pins make every version bump a deliberate, reviewable change, consistent with the intent behind `minimumReleaseAge`: adoption should be a choice, not a side effect.

**Trade-off accepted:** this moves the responsibility for staying current onto a human remembering to bump versions. Without periodic, deliberate updates, pinned versions can become stale (and eventually vulnerable) faster than they would under a caret range with regular reinstalls. No automated reminder exists yet for this — worth revisiting (e.g. Dependabot version updates, once GitHub monitoring is set up) rather than left as a purely manual habit.

## Install script restriction

`pnpm-workspace.yaml` already restricted build/install scripts before this ADR:

```yaml
allowBuilds:
  esbuild: true
onlyBuiltDependencies:
  - esbuild
```

Reviewed as part of this ticket: `pnpm install` with the settings above (plus the new `minimumReleaseAge`) completes without requiring any additional package to run a build script, so the allow-list is left as-is rather than extended pre-emptively. pnpm also offers `dangerouslyAllowAllBuilds` to disable this restriction globally — deliberately not used.

## `pnpm audit` / `pnpm audit signatures`

Both run manually against the current lockfile:
- `pnpm audit` — no known vulnerabilities.
- `pnpm audit signatures` — 339 packages audited, all with verified registry signatures.

Neither is wired into an automated pipeline yet, because **no CI exists in this repository at all** (no `.github/workflows/`, no other pipeline). This is a pre-existing gap, not something introduced or fixed by this ticket. Once a CI is built, it must install dependencies with `pnpm install --frozen-lockfile` and run `pnpm audit` — tracked separately as its own decision to apply at that time.

## Date

2026-08-05

## Addendum (2026-08-31) — CI now enforces `pnpm audit`, and a real override mechanism was needed

A CI now exists (`.github/workflows/frontend-ci.yml`, part of the `ci-minimale` ticket) and runs `pnpm install --frozen-lockfile` + `pnpm audit --audit-level high` on every PR/push to `master`, closing the gap this ADR left open ("once a CI is built, it must ... run `pnpm audit`"). The threshold decided at implementation time: High/Critical block the job, Low/Moderate do not, no `continue-on-error` — any future exception must be an explicit, documented one rather than a silent bypass.

The very first real run found two pre-existing High-severity vulnerabilities in transitive dev dependencies (`js-yaml` via `eslint`, `nanoid` via `vite`/`postcss`) that had never been visible without a CI gate. Neither had a direct upstream fix available yet (the vulnerable version was pulled in transitively, not a direct dependency this project controls), so `overrides` in `apps/frontend/pnpm-workspace.yaml` — not `package.json`'s `pnpm` field, which pnpm 11 no longer reads for this setting — is now the established mechanism to force a patched transitive version pending an upstream bump. Before applying it, each new exact package/version pair was checked against OSV's malicious-package/advisory data (`https://api.osv.dev/v1/querybatch`) rather than assumed safe — a supply-chain check that now applies to every `pnpm add`/`update`/`install` changing a resolved version, not just this one.

## Addendum (2026-08-31) — `pnpm audit` extended to a weekly check, threshold centralized in a script (not `pnpm-workspace.yaml`)

Two changes, both about the `pnpm audit` control from the previous addendum, not a new mechanism:

1. **A weekly scheduled workflow** (`.github/workflows/frontend-security-audit.yml`) now runs the same audit independently of any code change, to catch an advisory published on a dependency that hasn't moved in the lockfile — the PR/push-triggered `frontend-ci.yml` alone could never detect that, since nothing would trigger it. `workflow_dispatch` is also enabled for manual runs. This job intentionally passes `install: false` to `pnpm/setup`: `pnpm audit` reads the lockfile and queries the registry directly, it does not need `node_modules` — installing dependencies weekly just to audit them would be slower and conceptually backwards for a security check that doesn't touch the installed tree. **Correction, found from the first real run's logs:** the workflow must call the raw `pnpm audit --audit-level high` command, not the `audit:security` package.json script — `pnpm run <script>` (what `pnpm audit:security` resolves to) silently installs `node_modules` first if missing, regardless of `install: false`, which the plain `pnpm audit` subcommand never does. The workflow also now writes a one-line pass/fail summary to the run's GitHub Actions summary page and uploads the full audit output (including a second, always-informational full-severity pass covering Low/Moderate) as a downloadable artifact — both native GitHub Actions features, not a new reporting system.
2. **The High/Critical threshold is centralized in a `package.json` script** (`audit:security`: `pnpm audit --audit-level high`), not in `pnpm-workspace.yaml`'s `audit.level` setting (considered, then deliberately rejected). `audit.level` applies to every invocation of `pnpm audit` project-wide, including a bare `pnpm audit` run by hand — which would then silently hide Low/Moderate advisories from local inspection, not just from the CI gate. Keeping the threshold in a dedicated script instead preserves a real distinction: plain `pnpm audit` always shows every known advisory (full visibility, the default `low` threshold), while `pnpm audit:security` is the one blocking gate (High/Critical only), reused as-is by `frontend-ci.yml` and — once it exists — the release workflow (both already install dependencies for other steps, so the script's implicit install isn't a concern there). The weekly workflow is the one exception: it inlines the same `--audit-level high` flag directly rather than going through the script, specifically to avoid that implicit install (see point 1) — the two must be kept in sync by hand if the threshold ever changes. See `docs/architecture/dependency-security-strategy.md` for the full usage policy (when to run which command).

## Addendum (2026-09-01) — GitHub-native monitoring enabled (Dependabot alerts, security updates, malware alerts)

Everything above is active scanning this project runs itself. This addendum records a complementary decision: turning on GitHub's own passive monitoring (Dependabot alerts, security updates, malware alerts, Automatic Dependency Submission), repo-wide rather than frontend-only. Enabled on `ChloeDelphis/proust-club` (public repo) — alerts and security updates via the GitHub API, malware alerts via the Settings UI (no REST endpoint exists for that toggle as of this writing). What each control does, and the current branch-protection facts that make "no auto-merge" true, are documented in `docs/architecture/dependency-security-strategy.md` (single source of truth — not repeated here, to avoid the two docs drifting on config specifics).

**Decision — backend (Gradle) coverage:** at enablement time, the dependency graph held 366 packages (repo + 5 GitHub Actions + 360 npm) and zero Maven/Gradle packages — GitHub's static parser can't resolve `apps/backend/build.gradle.kts`, since most dependencies here have no inline version (resolved via the `io.spring.dependency-management` plugin). Chose **Automatic Dependency Submission** (Settings → Code security → Dependency graph) over hand-writing a `gradle/actions/dependency-submission` workflow: same result, no workflow file to maintain, Gradle-supported since 2025. Not yet verified as of this writing — no push to `master` has triggered it — see `dependency-security-strategy.md` for current status.
