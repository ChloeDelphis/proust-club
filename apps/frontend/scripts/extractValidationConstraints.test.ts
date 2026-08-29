import { extractValidationConstraints } from './extractValidationConstraints'

describe('extractValidationConstraints', () => {
  it('extracts minLength and maxLength from a component schema property', () => {
    const doc = {
      components: {
        schemas: {
          RegisterRequest: {
            properties: {
              username: { minLength: 3, maxLength: 50 },
            },
          },
        },
      },
    }
    expect(extractValidationConstraints(doc)).toEqual({
      RegisterRequest: { username: { minLength: 3, maxLength: 50 } },
    })
  })

  it('keeps only maxLength when no minLength is present', () => {
    const doc = {
      components: {
        schemas: {
          RegisterRequest: {
            properties: {
              email: { maxLength: 255 },
            },
          },
        },
      },
    }
    expect(extractValidationConstraints(doc)).toEqual({
      RegisterRequest: { email: { maxLength: 255 } },
    })
  })

  it('omits minLength when minLength === 0', () => {
    // swagger-core adds minLength: 0 by default to any String field without an explicit lower
    // bound — not a real constraint, every string trivially satisfies it.
    const doc = {
      components: {
        schemas: {
          RegisterRequest: {
            properties: {
              email: { minLength: 0, maxLength: 255 },
            },
          },
        },
      },
    }
    expect(extractValidationConstraints(doc)).toEqual({
      RegisterRequest: { email: { maxLength: 255 } },
    })
  })

  it('omits a schema property with no significant constraint', () => {
    const doc = {
      components: {
        schemas: {
          PasswordChangeRequest: {
            properties: {
              currentPassword: {},
              newPassword: { minLength: 15, maxLength: 128 },
            },
          },
        },
      },
    }
    expect(extractValidationConstraints(doc)).toEqual({
      PasswordChangeRequest: { newPassword: { minLength: 15, maxLength: 128 } },
    })
  })

  it('extracts a query parameter keyed by operationId', () => {
    const doc = {
      paths: {
        '/api/search': {
          get: {
            operationId: 'search',
            parameters: [
              { name: 'q', in: 'query', schema: { minLength: 2, maxLength: 500 } },
            ],
          },
        },
      },
    }
    expect(extractValidationConstraints(doc)).toEqual({
      search: { q: { minLength: 2, maxLength: 500 } },
    })
  })

  it('ignores non-query parameters', () => {
    const doc = {
      paths: {
        '/api/quotes/{id}': {
          get: {
            operationId: 'getQuote',
            parameters: [
              { name: 'id', in: 'path', schema: { minLength: 1, maxLength: 10 } },
            ],
          },
        },
      },
    }
    expect(extractValidationConstraints(doc)).toEqual({})
  })

  it('ignores an operation with no operationId', () => {
    const doc = {
      paths: {
        '/api/search': {
          get: {
            parameters: [
              { name: 'q', in: 'query', schema: { minLength: 2, maxLength: 500 } },
            ],
          },
        },
      },
    }
    expect(extractValidationConstraints(doc)).toEqual({})
  })

  it('throws if a schema name collides with an operationId', () => {
    // Schema names and operationIds share one flat namespace in the output — a coincidental
    // collision must fail loudly at generation time rather than silently merge two unrelated
    // DTOs/operations into one object.
    const doc = {
      components: {
        schemas: {
          search: { properties: { name: { maxLength: 10 } } },
        },
      },
      paths: {
        '/api/search': {
          get: {
            operationId: 'search',
            parameters: [{ name: 'q', in: 'query', schema: { minLength: 2 } }],
          },
        },
      },
    }
    expect(() => extractValidationConstraints(doc)).toThrow(/"search".*schema name.*operationId/)
  })

  it('does not pollute Object.prototype for a schema named __proto__', () => {
    // Built via JSON.parse, not an object literal: {"__proto__": ...} as a literal in source would
    // set the prototype at parse time (not what a real OpenAPI document over the wire produces) —
    // JSON.parse instead creates a genuine own property literally named "__proto__", exactly what
    // the schema/property names become when this function does `result[groupKey][fieldKey] = ...`.
    // Defense-in-depth for this dev-tooling script, not a realistic attack in this project's setup
    // (the document always comes from this repo's own local backend).
    const doc = JSON.parse(
      '{"components":{"schemas":{"__proto__":{"properties":{"polluted":{"maxLength":1}}}}}}',
    )
    extractValidationConstraints(doc)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('returns an empty object for a document with no constraints anywhere', () => {
    const doc = {
      components: { schemas: { UserResponse: { properties: { uuid: {} } } } },
      paths: { '/api/auth/me': { get: { operationId: 'me', parameters: [] } } },
    }
    expect(extractValidationConstraints(doc)).toEqual({})
  })
})
