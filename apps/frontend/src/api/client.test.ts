import { apiFetch, ApiError } from './client'

function setCookie(value: string) {
  document.cookie = `XSRF-TOKEN=${value}; path=/`
}

function clearCookie() {
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
}

function mockFetchResolvedWith(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

beforeEach(() => {
  clearCookie()
})

describe('apiFetch', () => {
  it('attaches X-XSRF-TOKEN on a POST when the cookie is present', async () => {
    setCookie('token-abc')
    globalThis.fetch = mockFetchResolvedWith({ ok: true })

    await apiFetch('/api/whatever', { method: 'POST', body: '{}' })

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(new Headers(init?.headers).get('X-XSRF-TOKEN')).toBe('token-abc')
  })

  it('does not attach X-XSRF-TOKEN on a GET, even when the cookie is present', async () => {
    setCookie('token-abc')
    globalThis.fetch = mockFetchResolvedWith({ ok: true })

    await apiFetch('/api/whatever')

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(new Headers(init?.headers).get('X-XSRF-TOKEN')).toBeNull()
  })

  it('does not attach X-XSRF-TOKEN on a POST when there is no cookie yet', async () => {
    globalThis.fetch = mockFetchResolvedWith({ ok: true })

    await apiFetch('/api/whatever', { method: 'POST', body: '{}' })

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(new Headers(init?.headers).get('X-XSRF-TOKEN')).toBeNull()
  })

  it('throws ApiError carrying the status on a non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }))

    await expect(apiFetch('/api/whatever')).rejects.toBeInstanceOf(ApiError)
    await expect(apiFetch('/api/whatever')).rejects.toMatchObject({ status: 401 })
  })

  it('returns undefined for a 204 No Content response instead of parsing an empty body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))

    await expect(apiFetch('/api/whatever')).resolves.toBeUndefined()
  })
})
