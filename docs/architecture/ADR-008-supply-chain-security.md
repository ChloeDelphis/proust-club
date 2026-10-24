# ADR-008: Dependency and supply-chain security

**Status:** Accepted · **Created:** 2026-08-05 · **Updated:** 2026-10-24

## Context

Frontend dependencies can introduce known vulnerabilities or malicious install-time code. The backend also needs repository-wide dependency monitoring.

## Decision

- Pin direct frontend dependencies to exact versions, wait 24 hours before installing new releases, and allow install scripts only for approved packages.
- Require `pnpm safe:*` for frontend dependency changes; it checks new resolutions against OSV's malicious-package data before installation.
- Use `pnpm audit` and Dependabot alerts for published vulnerabilities; enable security update PRs. PR audit results are informational; normal required CI checks remain the merge gates. The weekly audit fails on High/Critical findings and reports all severities.
- Patch vulnerable transitive dependencies with pnpm workspace overrides when their parent packages have not yet resolved a fixed version.
- Use GitHub dependency alerts, security update PRs, and dependency submission for repository-wide monitoring, including resolved Gradle dependencies.

## Rationale

The OSV check catches packages reported as malicious; `pnpm audit` and Dependabot cover published security advisories. Exact pins and the release delay make dependency changes reviewable. PR audit findings may predate a change, so they should inform review without blocking unrelated work.

## Implementation

See the [dependency security guide](../security/dependency-security.md), [OSV check design](../features/supply-chain-check.md), and the frontend workflows under `.github/workflows/`.
