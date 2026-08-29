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

  it('returns an empty object for a document with no constraints anywhere', () => {
    const doc = {
      components: { schemas: { UserResponse: { properties: { uuid: {} } } } },
      paths: { '/api/auth/me': { get: { operationId: 'me', parameters: [] } } },
    }
    expect(extractValidationConstraints(doc)).toEqual({})
  })
})
