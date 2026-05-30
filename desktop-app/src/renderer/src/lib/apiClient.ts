import { config } from './config'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

function getToken(): string | null {
  return localStorage.getItem('token')
}

/**
 * Base fetch wrapper for the desktop app.
 * Attaches auth token, handles errors, parses JSON.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs: number = config.timeouts.default
): Promise<T> {
  const token = getToken()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${config.apiUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token && token !== 'demo' ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string; message?: string }
      throw new ApiError(res.status, body.error ?? body.message ?? `HTTP ${res.status}`)
    }

    return res.json() as Promise<T>
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof ApiError) throw err
    if ((err as Error).name === 'AbortError') throw new ApiError(408, 'Request timed out')
    throw new ApiError(0, (err as Error).message ?? 'Network error')
  }
}

export function apiGet<T>(path: string, timeoutMs?: number) {
  return apiFetch<T>(path, { method: 'GET' }, timeoutMs ?? config.timeouts.default)
}

export function apiPost<T>(path: string, body: unknown, timeoutMs?: number) {
  return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }, timeoutMs ?? config.timeouts.default)
}

export function apiPatch<T>(path: string, body: unknown) {
  return apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
}

export function apiDelete<T>(path: string) {
  return apiFetch<T>(path, { method: 'DELETE' })
}
