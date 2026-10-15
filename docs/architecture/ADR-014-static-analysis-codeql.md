# ADR-014: Static analysis with CodeQL

## Decision

Run CodeQL from the versioned `.github/workflows/codeql.yml` workflow for `java-kotlin` and `javascript-typescript`, using `build-mode: none` and the default query suite. The workflow publishes code-scanning results to GitHub; branch protection is configured separately from the workflow.

## Context and rationale

CI already builds and tests the backend and frontend, checks dependencies, and scans for secrets, but did not analyze application code for vulnerability patterns. CodeQL was selected over Semgrep because it supports both project languages and integrates with the repository's GitHub security tooling.

Advanced setup keeps workflow triggers, permissions, and pinned actions reviewable in the repository. The backend is pure Java; `build-mode: none` avoids repeating the Gradle build and is sufficient while dependency resolution works and no generated jOOQ code exists. JavaScript/TypeScript is analyzed without compilation.

## Revisit when

Use a manual Java build if CodeQL misses dependencies or source. Reassess the Java build mode if application Kotlin or generated source is introduced. Consider a broader query suite after alert triage is established.

## Trade-off

Without a build, analysis depends on CodeQL resolving Gradle dependencies and cannot see source generated during compilation. A real run showing either gap is the trigger to change the build mode.

## Trigger

Pull requests and pushes to `master`, weekly schedule, and manual dispatch.

## Date

2026-09-02
