import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extractValidationConstraints } from './extractValidationConstraints.ts'

const SNAPSHOT_PATH = new URL('../.openapi-snapshot.json', import.meta.url)
const OUTPUT_DIR = new URL('../src/api/generated/', import.meta.url)
const OUTPUT_PATH = new URL('../src/api/generated/validationConstraints.generated.ts', import.meta.url)

const doc = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8'))
const constraints = extractValidationConstraints(doc)

const header = `/**\n * This file is generated. Do not edit manually.\n * Run \`pnpm generate:api\` to regenerate it.\n */\n\n`
const body = `export const validationConstraints = ${JSON.stringify(constraints, null, 2)} as const\n`

mkdirSync(OUTPUT_DIR, { recursive: true })
writeFileSync(OUTPUT_PATH, header + body)
