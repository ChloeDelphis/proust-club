# ADR-014: Static analysis (SAST) — CodeQL, Advanced setup, `build-mode: none`

## Decision

**CodeQL**, in **Advanced setup** (a versioned `.github/workflows/codeql.yml`, not GitHub's no-code Default setup), analyzing both `java-kotlin` (the backend, pure Java) and `javascript-typescript` (the frontend) in a single matrix job, both with **`build-mode: none`** — no compilation, CodeQL queries Gradle/Maven for dependency info directly. Default query suite (not `security-extended`). No merge protection added yet — alerts are visible but don't block a PR.

## Context

CI already covered build, tests, lint, dependency audit (`pnpm audit`, see [ADR-008](ADR-008-supply-chain-security.md)) and secrets scanning (Gitleaks), but nothing analyzed the application code itself for vulnerability patterns (injection, XSS, unsafe deserialization, etc.). Identified 2026-09-02 during a review of security/CI gaps — not triggered by an incident.

## Tool: CodeQL vs Semgrep

**CodeQL (chosen)** — native to GitHub, free without limit on a public repo, supports Java and JavaScript/TypeScript with no custom rules to write, integrates into the same Security tab already used for Dependabot alerts (see ADR-008 addendum).

**Semgrep** — faster to write/adapt custom rules, same language coverage, but needs either a Semgrep Cloud account (free with limits) or self-managed OSS rules, and no native integration with the Security tab already in use. Not chosen, staying within GitHub-native tooling rather than adding a third-party service; can be reconsidered later if CodeQL proves insufficient for a specific language/pattern.

## Setup mode: Default vs Advanced

**Default setup** — zero maintenance, GitHub auto-picks languages/schedule from Settings, no file in the repo. Breaks with the project's convention of versioning all CI as reviewable, SHA-pinned `.github/workflows/*.yml` files (see `backend-ci.yml`, `frontend-ci.yml`, `secrets-scan.yml`, `frontend-security-audit.yml`).

**Advanced setup (chosen)** — a workflow file, same pinning/permissions conventions as the rest of the CI.

## Build mode for `java-kotlin`: `none` vs `autobuild` vs `manual`

The backend is pure Java (0 `.kt` files under `apps/backend/src`) — `build.gradle.kts` is only the Gradle build script's Kotlin DSL, not the application language. CodeQL's language identifier is still `java-kotlin` (the only valid name for analyzing Java), but the language choice doesn't dictate the build mode.

- **`none` (chosen)** — CodeQL queries Gradle/Maven for dependency information without running a build, then extracts every Java file present. This is what GitHub's own Default setup picks automatically for a Java-only repo. Two documented accuracy limits: imprecise dependency resolution if Gradle/Maven can't be queried correctly, and generated code produced during a build that `none` wouldn't see. Neither applies here today — `build.gradle.kts` declares Java 21 and its dependencies normally, and jOOQ code generation is **not yet configured** (`build.gradle.kts:102`, `// jOOQ code generation — À configurer`, no plugin active) — so there's no generated code that `none` would miss.
- **`autobuild`** — simpler than `manual` for a generic project, but a real compile still duplicates what `backend-ci.yml` already does on the same push/PR, for no accuracy gain over `none` given the two limits above don't apply.
- **`manual`** — most precise, but requires `actions/setup-java` + an explicit `./gradlew` invocation, again duplicating `backend-ci.yml`. Kept as the documented fallback (see below), not the starting point.

`none` only exists for Java — Kotlin itself does not support it (only `autobuild`/`manual` are valid for Kotlin). Irrelevant today since the backend has no `.kt` file, but if real Kotlin code is ever introduced under `apps/backend`, `build-mode: none` stops being valid for the `java-kotlin` matrix entry and this decision must be revisited.

**Fallback, not yet needed:** if a real run shows poor dependency resolution or visibly incomplete Java coverage, switch to `build-mode: manual` with `./gradlew compileJava` — deliberately not `compileTestJava`, so test code doesn't enter the analysis (CodeQL in `manual` mode builds its database from whatever is compiled during the workflow).

For `javascript-typescript`, `build-mode: none` is the only applicable mode — CodeQL statically extracts source for interpreted languages; `autobuild`/`manual` only apply to compiled languages.

## Query suite: default vs `security-extended`

Default suite (no `queries:` override) — favors precision, limits noise while the process for triaging alerts doesn't exist yet. `security-extended` (broader coverage, more false positives) can be evaluated later once a first triage pass has happened.

## Three separate things: job failure, check severity, merge protection

Deliberately not conflated, since GitHub itself keeps them separate:

- **A. The CodeQL job** (`init`/`analyze`) — fails normally (no `continue-on-error` anywhere) on a real execution error: failed dependency resolution, failed analysis, failed SARIF publication.
- **B. The "Code scanning results" check** — published separately by CodeQL once analysis completes. Native GitHub behavior, nothing configured for it: a new `error`/`critical`/`high` alert fails this check; lower severities remain warnings/notes.
- **C. The right to merge** — stays open even if A or B are red, as long as no "Require code scanning results" rule is added to branch protection/rulesets (a Settings-side change, not anything in this workflow or the repo). **Not added yet** — deliberately deferred until a first triage pass has happened on real alerts, to avoid blocking merges on early false positives. A scanner finding a real vulnerability is the tool succeeding, not failing (level A); it's a separate decision whether that finding should also block a merge (level C).

## Trigger

PR to `master` + push to `master` + weekly cron (same slot as `frontend-security-audit.yml`, Monday 06:00 UTC) + `workflow_dispatch`. No `paths:` filter — the scan is cheap (`build-mode: none`, no compilation) and analyzing both codebases on every run keeps the workflow simple and gives regular coverage; filters can be added later if run cost ever justifies it.

## Tradeoff accepted

- No merge-blocking on CodeQL alerts yet — see level C above.
- `build-mode: none` for the backend depends on jOOQ code generation staying unconfigured — see "Build mode for `java-kotlin`" above.

## Date

2026-09-02
