export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, code?: string) {
    super(`HTTP ${status}`)
    this.status = status
    this.code = code
  }
}

export function buildQuery(params: Record<string, string | number | undefined>): string {
  const definedEntries = Object.entries(params).filter(
    (entry): entry is [string, string | number] => entry[1] !== undefined,
  )
  return new URLSearchParams(definedEntries.map(([key, value]) => [key, String(value)])).toString()
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers = new Headers(init?.headers)

  if (method !== 'GET' && method !== 'HEAD') {
    const csrfToken = getCookie('XSRF-TOKEN')
    if (csrfToken) {
      headers.set('X-XSRF-TOKEN', csrfToken)
    }
  }

  const response = await fetch(path, { ...init, headers })
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    const code = body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
      ? body.code
      : undefined
    throw new ApiError(response.status, code)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}
