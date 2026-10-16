# ADR-014: Static analysis with CodeQL

## Decision

Run CodeQL from the versioned `.github/workflows/codeql.yml` workflow for `java-kotlin` and `javascript-typescript`, using `build-mode: none` and the default query suite. The workflow publishes code-scanning results to GitHub; branch protection is configured separately from the workflow.

## Context and rationale

CI already builds and tests the backend and frontend, checks dependencies, and scans for secrets, but did not analyze application code for vulnerability patterns. CodeQL was selected over Semgrep because it supports both project languages and integrates with the repository's GitHub security tooling.

Advanced setup keeps workflow triggers, permissions, and pinned actions reviewable in the repository. The backend is pure Java; `build-mode: none` avoids repeating the Gradle build. The application now imports generated jOOQ table metadata, but that output contains schema descriptions only and no handwritten business or security logic. The Java analysis therefore continues to focus on version-controlled application source without running the database-backed generator. JavaScript/TypeScript is analyzed without compilation.

## Revisit when

Use a manual Java build if CodeQL misses dependencies or source, or if generated code begins to contain handwritten behavior that affects security. Recheck dependency and source extraction after changes to the Gradle setup. Consider a broader query suite after alert triage is established.

## Trade-off

Without a build, analysis depends on CodeQL resolving Gradle dependencies and cannot see source generated during compilation. This is accepted while generated jOOQ classes contain only database metadata; a real run showing missed application source or dependencies is the trigger to change the build mode.

## Trigger

Pull requests and pushes to `master`, weekly schedule, and manual dispatch.

## Date

2026-09-02 (reaffirmed 2026-10-16 after jOOQ code generation was introduced)
