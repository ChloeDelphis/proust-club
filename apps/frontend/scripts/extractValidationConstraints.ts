// Minimal shape of the OpenAPI document — only the fields this function reads. Not reusing
// openapi-typescript's own SchemaObject/ParameterObject types: they don't model minLength/maxLength
// at all (out of scope for what that package needs), so they'd offer no real type safety here.
interface LengthSchema {
  minLength?: number
  maxLength?: number
}

interface OpenApiDocument {
  components?: {
    schemas?: Record<string, { properties?: Record<string, LengthSchema> }>
  }
  paths?: Record<string, Record<string, {
    operationId?: string
    parameters?: { name: string; in: string; schema?: LengthSchema }[]
  }>>
}

export interface LengthConstraint {
  minLength?: number
  maxLength?: number
}

export type ValidationConstraints = Record<string, Record<string, LengthConstraint>>

function toConstraint(schema: LengthSchema | undefined): LengthConstraint | null {
  if (!schema) return null
  const constraint: LengthConstraint = {}
  // minLength: 0 is not a real constraint (every string trivially satisfies it) — swagger-core
  // adds it by default to any String field without an explicit lower bound.
  if (typeof schema.minLength === 'number' && schema.minLength > 0) {
    constraint.minLength = schema.minLength
  }
  if (typeof schema.maxLength === 'number') {
    constraint.maxLength = schema.maxLength
  }
  return Object.keys(constraint).length > 0 ? constraint : null
}

export function extractValidationConstraints(doc: OpenApiDocument): ValidationConstraints {
  // Null-prototype objects: groupKey/fieldKey come from schema/operation/property names in the
  // OpenAPI document, which this function treats as untrusted data rather than a codebase-authored
  // literal. A regular {} would let a key like "__proto__" pollute Object.prototype through the
  // bracket-notation assignment below.
  const result: ValidationConstraints = Object.create(null)

  function addConstraint(groupKey: string, fieldKey: string, schema: LengthSchema | undefined) {
    const constraint = toConstraint(schema)
    if (!constraint) return
    result[groupKey] ??= Object.create(null)
    result[groupKey][fieldKey] = constraint
  }

  for (const [schemaName, schema] of Object.entries(doc.components?.schemas ?? {})) {
    for (const [propName, prop] of Object.entries(schema.properties ?? {})) {
      addConstraint(schemaName, propName, prop)
    }
  }

  // Only query parameters for now — no case in the current API needs path/header length
  // constraints. Same function, same output shape, would extend naturally if one appears.
  for (const pathItem of Object.values(doc.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      if (!operation.operationId) continue
      for (const param of operation.parameters ?? []) {
        if (param.in !== 'query') continue
        addConstraint(operation.operationId, param.name, param.schema)
      }
    }
  }

  return result
}
