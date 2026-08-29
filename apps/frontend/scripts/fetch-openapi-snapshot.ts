import { writeFileSync } from 'node:fs'
import { SNAPSHOT_PATH } from './paths.ts'

// Same URL generate:api has always used (CLI or here) — backend must be running on :8080.
const OPENAPI_URL = 'http://localhost:8080/v3/api-docs'

// Written to a local snapshot, read by both the openapi-typescript CLI and
// generate-validation-constraints.ts, so the two generated files always come from the exact same
// version of the spec rather than two independent (and potentially inconsistent) fetches.
let response: Response
try {
  response = await fetch(OPENAPI_URL)
} catch (cause) {
  throw new Error(`Could not reach ${OPENAPI_URL} — is the backend running (./gradlew bootRun)?`, { cause })
}
if (!response.ok) {
  throw new Error(`Failed to fetch OpenAPI spec from ${OPENAPI_URL}: ${response.status} ${response.statusText}`)
}
writeFileSync(SNAPSHOT_PATH, await response.text())
