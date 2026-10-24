# ADR-008: Dependency and supply-chain security

**Status:** Accepted · **Created:** 2026-08-05 · **Updated:** 2026-10-24

## Context

The frontend depends on npm packages that can introduce known vulnerabilities or execute code during installation. The backend also needs repository-wide dependency monitoring, including resolved Gradle transitive dependencies.

## Decision

- Pin direct frontend dependencies to exact versions, keep the lockfile committed, delay newly released versions by 24 hours, and allow install scripts only for explicitly approved packages.
- Require dependency changes to use the `pnpm safe:*` commands. They check proposed versions against OSV's malicious-package data before installation; a pnpm hook blocks accidental use of raw mutation commands. This guard is not intended to resist deliberate bypasses.
- Run `pnpm audit` for known vulnerabilities. High/Critical findings are reported on PRs and checked weekly, but the PR audit is not a required merge check: an existing advisory can be unrelated to a PR. A blocking release check is intended but no release workflow exists yet.
- Use pnpm workspace overrides to patch vulnerable transitive frontend dependencies when an upstream update is not yet available.
- Use GitHub's Dependabot alerts and security updates, malware alerts, and dependency submission for repository-wide monitoring. Gradle dependency-graph coverage remains to be verified; its current status is tracked in [the dependency security strategy](dependency-security-strategy.md).

## Rationale and trade-offs

The 24-hour delay reduces exposure to newly published malicious versions, at the cost of delaying emergency fixes. pnpm 11 uses a 24-hour delay by default; a previous 72-hour project override blocked a Vite security update because an unrelated transitive package was still inside the longer window. Exact pins make updates reviewable but require deliberate maintenance. The OSV malicious-package check complements `pnpm audit`, which checks published vulnerability advisories. Keeping the PR audit informational avoids blocking unrelated work; weekly monitoring detects new advisories even when the lockfile has not changed. A release gate is still needed before automated releases.

The pnpm hook was chosen over a `preinstall` script, which runs too late to prevent package materialization, and a shell wrapper, which is unreliable across the project's Windows and Linux environments. Its purpose is to prevent accidental unsafe installs, not to stop a determined user from bypassing the check.

## Decision history

- **2026-08-05:** Established the frontend baseline: release-age delay, exact direct versions, restricted install scripts, and manual audit/signature checks.
- **2026-08-31:** Added automated vulnerability audits and workspace overrides after CI found vulnerable transitive dependencies.
- **2026-09-01:** Enabled GitHub-native dependency monitoring and selected automatic dependency submission for Gradle; actual Gradle graph coverage was not yet verified.
- **2026-09-02:** Enforced the OSV check with a pnpm resolution hook and the `pnpm safe:*` commands.
- **2026-10-08:** Made PR audits non-blocking after an unrelated PR was blocked by existing advisories; corrected the weekly workflow's false-green exit status. A release-time blocking check remains outstanding.
- **2026-10-23:** Added the patched Zod version as a workspace override for the High-severity advisory reported in the frontend lint dependency tree.
- **2026-10-23:** Reduced `minimumReleaseAge` from 72 to 24 hours after the longer delay blocked a Vite security update over an unrelated fresh transitive release. Kept strict enforcement.
- **2026-10-24:** Pinned `@vitest/mocker` to 4.1.12 to resolve two Moderate advisories previously excluded from `pnpm audit`; the project does not register the affected mock WebSocket handlers, but the compatible patch is available and keeps the GitHub alerts actionable without audit exclusions.
- **2026-10-24:** Updated the `undici` override to 8.12.2 after the frontend audit reported one High and two Moderate advisories in the test-tooling dependency tree.

## Current implementation

See [Dependency security strategy](dependency-security-strategy.md) for the current controls, workflow behavior, and operational status.
