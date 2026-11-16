export class ApiError extends Error {
  status: number
  errors: Record<string, string[]>

  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

function xsrfToken(): string {
  const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : ''
}

async function refreshCsrf(): Promise<void> {
  await fetch('/sanctum/csrf-cookie', { credentials: 'same-origin' })
}

type Options = { method?: string; body?: unknown }

export async function api<T = unknown>(path: string, options: Options = {}, retried = false): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }
  if (method !== 'GET') {
    if (!xsrfToken()) await refreshCsrf()
    headers['X-XSRF-TOKEN'] = xsrfToken()
  }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  // CSRF token expired or missing: fetch a fresh one and retry once.
  if (res.status === 419 && !retried) {
    await refreshCsrf()
    return api<T>(path, options, true)
  }

  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.message ?? 'Request failed', data.errors ?? {})
  return data as T
}
