// Minimal shape of the OpenAPI document — only the fields this function reads. Not reusing
// openapi-typescript's own SchemaObject/ParameterObject types: they don't model the validation
// bounds needed here, so they'd offer no real type safety for this projection.
interface ConstraintSchema {
  minLength?: number
  maxLength?: number
  minItems?: number
  maxItems?: number
}

interface OpenApiDocument {
  components?: {
    schemas?: Record<string, { properties?: Record<string, ConstraintSchema> }>
  }
  paths?: Record<string, Record<string, {
    operationId?: string
    parameters?: { name: string; in: string; schema?: ConstraintSchema }[]
  }>>
}

export interface ValidationConstraint {
  minLength?: number
  maxLength?: number
  minItems?: number
  maxItems?: number
}

export type ValidationConstraints = Record<string, Record<string, ValidationConstraint>>

function toConstraint(schema: ConstraintSchema | undefined): ValidationConstraint | null {
  if (!schema) return null
  const constraint: ValidationConstraint = {}
  // minLength: 0 is not a real constraint (every string trivially satisfies it) — swagger-core
  // adds it by default to any String field without an explicit lower bound.
  if (typeof schema.minLength === 'number' && schema.minLength > 0) {
    constraint.minLength = schema.minLength
  }
  if (typeof schema.maxLength === 'number') {
    constraint.maxLength = schema.maxLength
  }
  if (typeof schema.minItems === 'number' && schema.minItems > 0) {
    constraint.minItems = schema.minItems
  }
  if (typeof schema.maxItems === 'number') {
    constraint.maxItems = schema.maxItems
  }
  return Object.keys(constraint).length > 0 ? constraint : null
}

type GroupSource = 'schema' | 'operation'

export function extractValidationConstraints(doc: OpenApiDocument): ValidationConstraints {
  // Null-prototype objects: groupKey/fieldKey come from schema/operation/property names in the
  // OpenAPI document, which this function treats as untrusted data rather than a codebase-authored
  // literal. A regular {} would let a key like "__proto__" pollute Object.prototype through the
  // bracket-notation assignment below.
  const result: ValidationConstraints = Object.create(null)
  // Component schema names (PascalCase DTO class names) and operationIds (camelCase method names)
  // share one flat namespace in `result` — nothing in the OpenAPI format itself keeps them apart.
  // Tracked here so a coincidental collision fails loudly at generation time instead of silently
  // merging two unrelated fields into one object.
  const groupSource: Record<string, GroupSource> = Object.create(null)

  function addConstraint(groupKey: string, fieldKey: string, schema: ConstraintSchema | undefined, source: GroupSource) {
    const constraint = toConstraint(schema)
    if (!constraint) return
    // Object.create(null) above only protects this function's own internal bookkeeping. The
    // consuming generated file (generate-validation-constraints.ts) writes these keys back out as
    // plain object-literal syntax (`{ "__proto__": ... }`), where "__proto__" — even quoted — sets
    // the object's prototype instead of creating a data property, unlike here or in JSON.parse.
    // Reject it outright rather than let that reintroduce the exact bug this function guards
    // against, one serialization step later.
    if (groupKey === '__proto__' || fieldKey === '__proto__') {
      throw new Error(
        `extractValidationConstraints: "__proto__" can't be used as a schema/operationId or field name — it would set the prototype instead of a data property once written out as an object literal.`,
      )
    }
    const existingSource = groupSource[groupKey]
    if (existingSource && existingSource !== source) {
      throw new Error(
        `extractValidationConstraints: "${groupKey}" is used as both a component schema name and an operationId — rename one of them, they can't share a key.`,
      )
    }
    groupSource[groupKey] = source
    result[groupKey] ??= Object.create(null)
    result[groupKey][fieldKey] = constraint
  }

  for (const [schemaName, schema] of Object.entries(doc.components?.schemas ?? {})) {
    for (const [propName, prop] of Object.entries(schema.properties ?? {})) {
      addConstraint(schemaName, propName, prop, 'schema')
    }
  }

  // Only query parameters for now — no case in the current API needs path/header length
  // constraints. Same function, same output shape, would extend naturally if one appears.
  for (const pathItem of Object.values(doc.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      if (!operation.operationId) continue
      for (const param of operation.parameters ?? []) {
        if (param.in !== 'query') continue
        addConstraint(operation.operationId, param.name, param.schema, 'operation')
      }
    }
  }

  return result
}
