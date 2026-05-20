/**
 * Central HTTP client for the NeuroTek AI website.
 * Handles auth headers, base URL, error parsing, and token refresh.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'https://mixpiloteai-production.up.railway.app'

// ── Token management ─────────────────────────────────────────────
const TOKEN_KEY   = 'token'
const REFRESH_KEY = 'refreshToken'
const EXP_KEY     = 'auth-token-exp'

/** Decode a JWT's exp claim without external libraries. Returns null on failure. */
function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    // base64url -> base64
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '==='.slice((b64.length + 3) % 4)
    const json = atob(padded)
    const payload = JSON.parse(json) as { exp?: number }
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
      return payload.exp
    }
    return null
  } catch {
    return null
  }
}

function storeTokenWithExp(t: string) {
  localStorage.setItem(TOKEN_KEY, t)
  const exp = decodeJwtExp(t)
  if (exp !== null) {
    localStorage.setItem(EXP_KEY, String(exp))
  } else {
    // Malformed / opaque token — drop any stale exp
    localStorage.removeItem(EXP_KEY)
  }
}

/** Returns true if the stored access token is expired (or missing/malformed). */
export function isTokenExpired(): boolean {
  const raw = localStorage.getItem(EXP_KEY)
  if (!raw) {
    // No stored exp — treat token as expired if one exists but has no exp metadata
    return !!localStorage.getItem(TOKEN_KEY)
  }
  const exp = parseInt(raw, 10)
  if (!Number.isFinite(exp)) return true
  return Math.floor(Date.now() / 1000) >= exp
}

/**
 * Preemptive expiry purge: call on app mount to clear a stale token before
 * any API request is made. Prevents a brief window where an expired token
 * is sent to the server before the 401 refresh cycle kicks in.
 */
export function purgeExpiredToken(): void {
  if (isTokenExpired()) {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(EXP_KEY)
  }
}

export const authTokens = {
  get:        () => localStorage.getItem(TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set:        (t: string) => storeTokenWithExp(t),
  setRefresh: (t: string) => localStorage.setItem(REFRESH_KEY, t),
  clear:      () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(EXP_KEY)
  },
  isLoggedIn: () => !!localStorage.getItem(TOKEN_KEY),
  getExp:     (): number | null => {
    const raw = localStorage.getItem(EXP_KEY)
    if (!raw) return null
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? n : null
  },
}

function redirectToLogin() {
  if (typeof window !== 'undefined') {
    window.location.hash = '#/login'
  }
}

/** Attempt a refresh using the stored refresh token. Returns true on success. */
async function tryRefresh(): Promise<boolean> {
  const refreshToken = authTokens.getRefresh()
  if (!refreshToken) return false
  try {
    const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!refreshRes.ok) return false
    const { data } = await refreshRes.json() as { data: { accessToken: string } }
    authTokens.set(data.accessToken)
    return true
  } catch {
    return false
  }
}

// ── Error type ───────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── Base fetch ───────────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  // Proactive refresh if the access token is within 30s of expiry
  const exp = authTokens.getExp()
  if (exp !== null && Date.now() / 1000 > exp - 30) {
    await tryRefresh()
  }

  const token = authTokens.get()

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  // Auto-refresh on 401
  if (res.status === 401) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      return apiFetch<T>(path, options)
    }
    authTokens.clear()
    redirectToLogin()
    throw new ApiError(401, 'Session expired. Please log in again.')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; message?: string; code?: string }
    const message = body.error ?? body.message ?? `HTTP ${res.status}`
    throw new ApiError(res.status, message, body.code)
  }

  return res.json() as Promise<T>
}

// ── Typed request helpers ────────────────────────────────────────
export function apiGet<T>(path: string) {
  return apiFetch<T>(path, { method: 'GET' })
}

export function apiPost<T>(path: string, body: unknown) {
  return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

export function apiPatch<T>(path: string, body: unknown) {
  return apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
}

export function apiDelete<T>(path: string) {
  return apiFetch<T>(path, { method: 'DELETE' })
}

// ── Auth API ─────────────────────────────────────────────────────
export interface LoginResponse {
  accessToken: string
  refreshToken?: string
  user: { id: string; email: string; name: string; plan: string }
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await apiPost<{ success: boolean; data: LoginResponse }>(
    '/api/auth/login',
    { email, password }
  )
  authTokens.set(data.accessToken)
  if (data.refreshToken) authTokens.setRefresh(data.refreshToken)
  return data
}

export async function register(name: string, email: string, password: string): Promise<LoginResponse> {
  const { data } = await apiPost<{ success: boolean; data: LoginResponse }>(
    '/api/auth/register',
    { name, email, password }
  )
  authTokens.set(data.accessToken)
  if (data.refreshToken) authTokens.setRefresh(data.refreshToken)
  return data
}

export function logout(): void {
  authTokens.clear()
}

// ── User API ─────────────────────────────────────────────────────
export interface UserProfile {
  id: string
  email: string
  name: string
  plan: string
  createdAt?: string
  aiUsageToday?: number
  aiDailyLimit?: number
}

export function getMe(): Promise<{ success: boolean; data: UserProfile }> {
  return apiGet('/api/auth/me')
}

// ── Projects API ─────────────────────────────────────────────────
export interface Project {
  id: string
  name: string
  genre?: string
  bpm?: number
  updatedAt?: string
}

export const projectsApi = {
  list:   ()                        => apiGet<{ success: boolean; data: Project[] }>('/api/projects'),
  get:    (id: string)              => apiGet<{ success: boolean; data: Project }>(`/api/projects/${id}`),
  create: (p: Partial<Project>)     => apiPost<{ success: boolean; data: Project }>('/api/projects', p),
  update: (id: string, p: Partial<Project>) => apiPatch<{ success: boolean; data: Project }>(`/api/projects/${id}`, p),
  delete: (id: string)              => apiDelete<{ success: boolean }>(`/api/projects/${id}`),
}

// ── Subscriptions API ────────────────────────────────────────────
export const subscriptionsApi = {
  current:  () => apiGet<{ success: boolean; data: { plan: string; status: string } }>('/api/subscriptions/current'),
  upgrade:  (plan: string, annual: boolean) => apiPost('/api/subscriptions/create-session', { plan, annual }),
  cancel:   () => apiPost('/api/subscriptions/cancel', {}),
  invoices: () => apiGet('/api/payments/invoices'),
}

export { BASE_URL }
