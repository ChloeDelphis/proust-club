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

**Decision — backend (Gradle) coverage:** at enablement time, the dependency graph held zero Maven/Gradle packages (366 packages total, all repo/GitHub Actions/npm) — GitHub's static parser couldn't resolve `apps/backend/build.gradle.kts` (why, and current verification status: `dependency-security-strategy.md`). Chose **Automatic Dependency Submission** (Settings → Code security → Dependency graph) over hand-writing a `gradle/actions/dependency-submission` workflow: same result, no workflow file to maintain, Gradle-supported since 2025.

## Addendum (2026-09-02) — `check:supply-chain` (Addendum 2026-08-31, second entry) is now enforced, not just documented

The OSV `MAL-*` check (`pnpm check:supply-chain`, see `docs/features/supply-chain-check.md`) shipped as a script developers and Claude were expected to remember to run before `pnpm add`/`update`/`install`. This addendum records the mechanism that makes it structurally hard to skip.

**Decision:** `apps/frontend/.pnpmfile.mjs`, a `preResolution` hook, blocks any `pnpm add`/`update`/`install`/`remove` invocation that doesn't carry a `PROUST_SAFE_PNPM=1` environment marker. `apps/frontend/scripts/safe-pnpm.ts`/`safePnpm.ts` — exposed as `pnpm safe:add`/`safe:update`/`safe:install`/`safe:remove` — set that marker and run `check:supply-chain` between resolving a change and materializing it, the same sequence the earlier addendum described manually.

**Context — options considered:**

- **A `preinstall` lifecycle script** (`package.json` `scripts.preinstall`), the originally planned approach. Rejected after empirical testing against this project's pnpm version (`11.19.0`): `preinstall` fires *after* pnpm has already fetched and linked the package into `node_modules`, not before — too late to gate anything. It also never fires at all during a plain `pnpm add` (only `update`/`install` trigger it), and pnpm skips it entirely on a true no-op re-run. None of this was documented anywhere; verified by instrumenting a throwaway pnpm project and inspecting `node_modules` from inside the hook at the moment it ran.
- **A shell alias/wrapper around the `pnpm` binary.** Rejected: not cross-platform (this project is developed on Windows, via PowerShell/Git Bash, with CI on `ubuntu-latest`), and easy to bypass by typing the real path or a fresh shell.
- **`.pnpmfile.mjs`'s `preResolution` hook**, the option chosen. Verified empirically to run before any write to `node_modules`/`pnpm-lock.yaml`/`package.json`, on `add`/`update`/`install`/`remove` alike, independent of `--ignore-scripts`/`--lockfile-only`, and — unlike `preinstall` — never silently skipped on a no-op. A `throw` inside it aborts the whole pnpm invocation before anything is written; confirmed directly (`node_modules`, lockfile, and `package.json` all unchanged after a rejected invocation).

**Why this design, specifically:**

- The marker (`PROUST_SAFE_PNPM`) is a provenance signal, not a credential — its job is to distinguish "went through the orchestrator" from "typed directly," not to resist someone deliberately working around it.
- `pnpm --ignore-pnpmfile` bypasses `.pnpmfile.mjs` entirely — a known, accepted gap. This mechanism is not meant to resist a deliberate, adversarial bypass (that person could edit `.pnpmfile.mjs` itself just as easily); it exists to stop a reflexive `pnpm add <pkg>` — typed by habit, or suggested by untrusted content an AI agent might act on — from installing something unchecked.
- A second, explicitly non-load-bearing layer (`.claude/hooks/block-raw-pnpm.mjs`, a Claude Code `PreToolUse` hook) denies the same raw commands before they even reach pnpm, giving Claude a fast, specific explanation instead of an opaque `.pnpmfile.mjs` stack trace. It is pattern-matching on the command string, not adversary-proof, and isn't meant to be — `.pnpmfile.mjs` is the actual gate.
- CI (`frontend-ci.yml`) sets the marker on the `pnpm/setup` step, scoped to that step only. CI trusts the already-committed, already-reviewed lockfile rather than re-running `check:supply-chain` on every job — consistent with the acceptable-gap language already in `docs/features/supply-chain-check.md`, and with the fact that a CI-time check is structurally too late anyway (it would run after the lockfile was already merged).

**Discovered along the way, not previously documented in this ADR:**

- pnpm 11 already blocks install/build scripts (`preinstall`/`install`/`postinstall`) of any dependency not explicitly listed in `onlyBuiltDependencies` (`ERR_PNPM_IGNORED_BUILDS`, requiring `pnpm approve-builds` to lift) — a real, pre-existing mitigation against exactly the failure mode "Install script restriction" above describes, independent of anything in this addendum.
- pnpm 11 has its own native "supply-chain policies" verification (visible in pnpm's own bundled source), re-checking every lockfile entry against `minimumReleaseAge`/`trustPolicy` on each install, cached across invocations. Complementary to `check:supply-chain`, not a duplicate: this checks publication age, `check:supply-chain` checks against OSV's known-malicious list — a package can fail one and pass the other.
- pnpm's `verifyDepsBeforeRun` setting (`apps/frontend/pnpm-workspace.yaml`, now set to `error`) defaults to silently running a real, unmarked `pnpm install` before any `pnpm run <script>` when `node_modules` looks stale relative to the lockfile — which the `--lockfile-only` step of `safe:add`/`safe:update` deliberately produces as a transient, expected state. Left at the default, that silent install would itself get blocked by `.pnpmfile.mjs`, surfacing a confusing internal error instead of pnpm's own clear "run pnpm install" message. `error` doesn't change what has to happen (an explicit install), only which message the developer sees.

**Tradeoff accepted:** `pnpm install <pkg>` is an undocumented pnpm alias for `pnpm add <pkg>` — verified empirically (it writes to `package.json`/`pnpm-lock.yaml` and installs for real). `pnpm safe:install` therefore refuses any package-shaped argument outright rather than trying to route it safely, on the theory that a command silently changing behavior based on its arguments is itself the kind of foot-gun this whole mechanism exists to close. A future contributor reaching for `pnpm safe:install <pkg>` out of `npm install <pkg>` habit gets pointed at `pnpm safe:add` instead of a silent bypass — found and fixed via `/code-review` before merge, not discovered later.

## Date (this addendum)

2026-09-02

## Addendum (2026-10-08) — `pnpm audit:security` no longer blocks a PR unrelated to dependencies; the weekly scan's "blocking" check was a silent no-op

**Incident:** PR #14 (a pure readability refactor, no dependency touched) was blocked by the `frontend` required status check, which ran `pnpm audit:security` against the *current* dependency tree — 7 High-severity advisories on transitive dev dependencies (`brace-expansion`, `source-map-js`), unrelated to the PR's diff. Investigating why the weekly scan (`frontend-security-audit.yml`) had never surfaced this surfaced a second, independent bug: its blocking step ran `pnpm audit --audit-level high | tee audit-report.txt` — without `pipefail` in effect, the step's exit code is `tee`'s own (always 0), not `pnpm audit`'s. The 2026-10-05 run already had 6 High-severity findings and still reported "success": the guard step that should have failed the job was skipped, and the summary wrote "✅ No High/Critical vulnerabilities found" — a false green. This had presumably been true for every run since the workflow was written; nothing was ever caught by it.

**Decision — PR-blocking:** moved `pnpm audit --audit-level high` out of the required `frontend` job in `frontend-ci.yml`, into a new `dependency-audit` job in the same file, deliberately **not** added to branch protection's required status checks. It still runs on every PR/push (visibility per PR, not just weekly) and is still allowed to genuinely fail — being non-required, not a `continue-on-error`, is what keeps a real finding from blocking an unrelated merge. A `continue-on-error: true` approach was considered and rejected: it would have worked, but makes "never blocks" depend on a flag that's easy to remove by accident later, whereas a job absent from the required-checks list structurally cannot block regardless of its own outcome.

**Decision — weekly scan:** the blocking step now redirects with a plain `>` instead of `| tee`, so its exit code is `pnpm audit`'s own. A separate, exit-code-independent step (`cat audit-report.txt`) restores the previous convenience of seeing the report directly in the step log, without reintroducing a way for that convenience to mask the result again.

**Why not fix it by adding `set -o pipefail` and keeping `tee`:** considered, since it would have kept both the inline log output and the file write in one step. Rejected in favor of dropping the pipe entirely: GitHub Actions' documented default shell behavior for `run:` steps is widely cited as already including `pipefail`, yet this exact step's `outcome` was empirically `"success"` on a run that had real High-severity findings — meaning that assumption was wrong for this workflow, in a way that cost real signal for an unknown number of weeks before being noticed. A plain redirection needs no shell-option assumption to be correct.

**What this does not fix:** the actual High-severity findings on the current tree (`undici`, `brace-expansion`, `source-map-js`) are a separate concern — this addendum is about the detection/alerting mechanism being trustworthy, not about resolving what it (correctly, this time) found. A release-time hard gate (reusing `pnpm audit:security` as originally planned) remains unbuilt, since no release/deploy pipeline exists yet in this repo.

## Date (this addendum)

2026-10-08

## Addendum (2026-10-08, same day) — the 19 findings the fix above surfaced were all fixed, not exempted

The previous addendum's "what this does not fix" was resolved the same day. All 19 findings traced to 5 packages (`undici`, `brace-expansion`, `source-map-js`, `vitest`, `@vitest/mocker`), all of them devDependencies never present in `dist/`: `undici` via `jsdom` (Vitest's simulated DOM — this project mocks every API call at the `src/api/*.ts` boundary, so `undici` never makes a real network request during tests), `brace-expansion` via `minimatch` (ESLint, typescript-eslint, `openapi-typescript`'s glob matching — on this project's own config/specs, never attacker-controlled input), `source-map-js` via Vite/PostCSS and Vitest/`css-tree` (parses this project's own build output and CSS, never an untrusted source map), and `vitest`/`@vitest/mocker` directly (the test runner itself).

**Decision:** fix all 19 by version bump rather than document an exception. Every available fix was a patch/minor release with no breaking change, so fixing was cheaper and cleaner than maintaining a documented-exception list — reserved for cases where fixing isn't this cheap.

- `vitest`/`@vitest/coverage-v8`: direct dependencies, bumped `4.1.10` → `4.1.11` via `pnpm safe:update` (fixes `GHSA-82fw-gwwq-j7x9`).
- `undici` → `8.11.2`, `source-map-js` → `1.2.2`: transitive, added to `overrides:` in `pnpm-workspace.yaml` (same mechanism as the 2026-08-31 addendum's `js-yaml`/`nanoid` fix).
- `brace-expansion`: two major lines coexist in the tree (`minimatch@3` resolves `brace-expansion@1.x`, `minimatch@5`/`@9` resolve `brace-expansion@2.x`). A single global override would have forced `minimatch@3` onto `brace-expansion@2.x` — an unverified major jump for no reason, since a same-major patch fix already exists on both lines. Used pnpm's scoped override syntax instead (`"minimatch@3>brace-expansion": 1.1.21`, `"minimatch@5>brace-expansion": 2.1.7`, `"minimatch@9>brace-expansion": 2.1.7`), fixing all 6 advisories without changing either major.

Verified: `pnpm audit` clean, `pnpm check:supply-chain` clean on the newly resolved versions, full lint/test/build green, and `pnpm generate:api` re-run end-to-end against a live backend (exercises the `openapi-typescript`/`@redocly/openapi-core` chain, the other consumer of `brace-expansion`) — output byte-identical to before the bump.

## Date (this addendum)

2026-10-08
