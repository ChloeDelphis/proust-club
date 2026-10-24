# Dependency security

## Updates

Routine dependency updates need no separate documentation: the manifest, lockfile and PR/commit are the record. For frontend changes, use `pnpm safe:*`; see the [frontend README](../../apps/frontend/README.md).

For a vulnerable transitive dependency, use an override in `apps/frontend/pnpm-workspace.yaml`. Keep an `audit.ignore` entry only when the affected path does not apply and no practical fix is available; explain the reason beside it. A pnpm audit exclusion does not dismiss a Dependabot alert.

## Controls

| Control | Purpose |
| --- | --- |
| `pnpm safe:add`, `safe:update`, `safe:install` | Check the frontend lockfile against OSV's malicious-package data before packages are installed. Not a CI check; see the [technical design](../features/supply-chain-check.md). |
| `pnpm audit` | Checks the frontend dependency tree for published advisories. The PR job is non-required; the weekly job fails on High/Critical findings or audit failure and reports all severities. |
| GitHub Dependabot | Reports vulnerable or malicious dependencies and can open security update PRs. An alert without a PR still needs triage and, when applicable, a normal fix PR. |

Gradle dependency-graph coverage is unverified; confirm that resolved backend packages appear in GitHub's dependency graph.

## Documentation

Keep operational guidance here, the rationale for lasting choices in [ADR-008](../architecture/ADR-008-supply-chain-security.md), and the OSV checker design in its [feature document](../features/supply-chain-check.md).
