const API = import.meta.env.VITE_API_URL ?? 'https://mixpiloteai-production.up.railway.app'
const TOKEN_KEY = 'admin-jwt'
const REFRESH_KEY = 'admin-refresh'
const LAST_ACTIVITY_KEY = 'admin-last-activity'
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

/** Decode JWT exp claim without external libraries. Returns null on failure. */
function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '==='.slice((b64.length + 3) % 4)
    const payload = JSON.parse(atob(padded)) as { exp?: number }
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp : null
  } catch {
    return null
  }
}

/** Returns true when the JWT access token is present and not expired. */
function isAdminJwtValid(): boolean {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return false
  const exp = decodeJwtExp(token)
  if (exp === null) return true // opaque/non-expiring token — trust it
  return Math.floor(Date.now() / 1000) < exp
}

function redirectToAdminGate() {
  if (typeof window !== 'undefined') {
    window.location.hash = '#/admin'
  }
}

// Token management
export const adminToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY) },
  setRefresh: (t: string) => localStorage.setItem(REFRESH_KEY, t),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
}

// Base fetch with auto-refresh on 401 + inactivity timeout
async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  // Inactivity check (skip if no activity recorded yet)
  const lastRaw = localStorage.getItem(LAST_ACTIVITY_KEY)
  if (lastRaw) {
    const last = parseInt(lastRaw, 10)
    if (Number.isFinite(last) && Date.now() - last > INACTIVITY_TIMEOUT_MS) {
      console.warn('[admin] session expired due to inactivity')
      adminToken.clear()
      localStorage.removeItem(LAST_ACTIVITY_KEY)
      redirectToAdminGate()
      throw new Error('Session expired due to inactivity')
    }
  }

  const token = adminToken.get()
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })

  if (res.status === 401) {
    // Try refresh
    const refreshToken = adminToken.getRefresh()
    if (refreshToken) {
      const refreshRes = await fetch(`${API}/api/admin/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (refreshRes.ok) {
        const { data } = await refreshRes.json()
        adminToken.set(data.accessToken)
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
        // Retry original request
        return adminFetch<T>(path, options)
      }
    }
    adminToken.clear()
    redirectToAdminGate()
    throw new Error('Session expired')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? 'Request failed')
  }

  // Mark activity on successful response
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))

  return res.json()
}

// Also support x-admin-key fallback (for dev)
export function setAdminKeyHeader(key: string) {
  // store in localStorage under 'admin-key' (old system)
  localStorage.setItem('admin-key', key)
}

// ── Auth ──────────────────────────────────────────────────────
export async function adminLogin(email: string, password: string) {
  // Try real JWT login first
  try {
    const res = await fetch(`${API}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (res.ok) {
      const { data } = await res.json()
      adminToken.set(data.accessToken)
      adminToken.setRefresh(data.refreshToken)
      return { success: true, user: data.user }
    }
  } catch { /* fallthrough to key auth */ }

  // Fallback: treat input as admin key or whitelisted email
  const ADMIN_KEY = 'nt-admin-dev-2025'
  const SUPER_ADMIN_EMAILS = new Set(['tifenn.cruchon@gmail.com'])
  const trimmed = email.trim()
  if (trimmed === ADMIN_KEY || SUPER_ADMIN_EMAILS.has(trimmed)) {
    localStorage.setItem('admin-key', trimmed)
    return { success: true, user: { email: trimmed, role: 'super_admin' } }
  }

  throw new Error('Invalid credentials')
}

export async function adminLogout() {
  const refreshToken = adminToken.getRefresh()
  if (refreshToken) {
    await fetch(`${API}/api/admin/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken.get() ?? ''}` },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {})
  }
  adminToken.clear()
  localStorage.removeItem('admin-key')
  localStorage.removeItem(LAST_ACTIVITY_KEY)
}

export function isAdminAuthed(): boolean {
  // JWT path: token must exist and not be expired
  if (isAdminJwtValid()) return true
  // Dev key fallback (no expiry concept for simple string keys)
  return !!localStorage.getItem('admin-key')
}

// ── Stats ──────────────────────────────────────────────────────
export interface PlatformStats {
  users: { total: number; active30d: number; newToday: number; banned: number }
  subscriptions: { free: number; pro: number; studio: number; label: number; totalMRR: number }
  marketplace: { totalProducts: number; pending: number; flagged: number; totalDownloads: number }
  payments: { totalRevenue: number; todayRevenue: number; successRate: number; refundCount: number }
  ai: { requestsToday: number; requestsMonth: number; avgLatencyMs: number; errorRate: number }
  storage: { usedGB: number; totalGB: number; usedPct: number }
  support: { open: number; resolved: number; avgResponseHours: number }
}

export const adminApi = {
  stats: () => adminFetch<{ success: boolean; data: PlatformStats }>('/api/admin/stats'),

  // Users
  users: (params?: { page?: number; limit?: number; search?: string; plan?: string }) => {
    const q = new URLSearchParams()
    if (params?.page)   q.set('page',   String(params.page))
    if (params?.limit)  q.set('limit',  String(params.limit))
    if (params?.search) q.set('search', params.search)
    if (params?.plan)   q.set('plan',   params.plan)
    return adminFetch<{ success: boolean; data: { users: AdminUser[]; total: number; page: number; totalPages: number } }>(`/api/admin/users?${q}`)
  },
  user:       (id: string)                 => adminFetch<{ success: boolean; data: AdminUser }>(`/api/admin/users/${id}`),
  banUser:    (id: string, reason: string) => adminFetch<{ success: boolean }>(`/api/admin/users/${id}/ban`,   { method: 'POST', body: JSON.stringify({ reason }) }),
  unbanUser:  (id: string)                 => adminFetch<{ success: boolean }>(`/api/admin/users/${id}/unban`, { method: 'POST' }),
  deleteUser: (id: string)                 => adminFetch<{ success: boolean }>(`/api/admin/users/${id}`,       { method: 'DELETE' }),

  // Stripe / Financial
  stripeOverview:      () => adminFetch<{ success: boolean; data: StripeOverview }>('/api/admin/stripe/overview'),
  stripeCharges:       (limit = 25, startingAfter?: string) => adminFetch<{ success: boolean; data: StripeCharge[] }>(`/api/admin/stripe/charges?limit=${limit}${startingAfter ? `&starting_after=${startingAfter}` : ''}`),
  stripeSubscriptions: (limit = 25) => adminFetch<{ success: boolean; data: StripeSub[] }>(`/api/admin/stripe/subscriptions?limit=${limit}`),
  refund:              (chargeId: string, reason: string) => adminFetch<{ success: boolean }>('/api/admin/stripe/refund', { method: 'POST', body: JSON.stringify({ chargeId, reason }) }),
  stripeAnalytics:     () => adminFetch<{ success: boolean; data: StripeAnalytics }>('/api/admin/stripe/analytics'),
  stripeInvoices:      (limit = 25, customer?: string) => adminFetch<{ success: boolean; data: StripeInvoice[] }>(`/api/admin/stripe/invoices?limit=${limit}${customer ? `&customer=${customer}` : ''}`),
  stripeWebhookLogs:   (limit = 100) => adminFetch<{ success: boolean; data: StripeWebhookLog[] }>(`/api/admin/stripe/webhook-logs?limit=${limit}`),
  stripeCoupons:       () => adminFetch<{ success: boolean; data: StripeCoupon[] }>('/api/admin/stripe/coupons'),
  createStripeCoupon:  (data: { name: string; percentOff?: number; amountOff?: number; currency?: string; duration: string; durationInMonths?: number; maxRedemptions?: number }) => adminFetch<{ success: boolean; data: StripeCoupon }>('/api/admin/stripe/coupons', { method: 'POST', body: JSON.stringify(data) }),
  deleteStripeCoupon:  (id: string) => adminFetch<{ success: boolean }>(`/api/admin/stripe/coupons/${id}`, { method: 'DELETE' }),
  stripePortal:        (customerId: string, returnUrl: string) => adminFetch<{ success: boolean; data: { url: string } }>('/api/admin/stripe/portal', { method: 'POST', body: JSON.stringify({ customerId, returnUrl }) }),

  // Plans (full CRUD)
  plans:        () => adminFetch<{ success: boolean; data: unknown[] }>('/api/admin/plans'),
  plan:         (id: string) => adminFetch<{ success: boolean; data: unknown }>(`/api/admin/plans/${id}`),
  createPlan:   (data: Record<string, unknown>) => adminFetch<{ success: boolean; data: unknown }>('/api/admin/plans', { method: 'POST', body: JSON.stringify(data) }),
  updatePlan:   (id: string, data: Record<string, unknown>) => adminFetch<{ success: boolean; data: unknown }>(`/api/admin/plans/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  togglePlan:   (id: string, active: boolean) => adminFetch<{ success: boolean }>(`/api/admin/plans/${id}/toggle`, { method: 'POST', body: JSON.stringify({ active }) }),

  // Monitoring
  monitoring:       () => adminFetch<{ success: boolean; data: MonitoringData }>('/api/admin/monitoring'),
  monitoringErrors: () => adminFetch<{ success: boolean; data: ErrorLog[] }>('/api/admin/monitoring/errors'),

  // Marketplace
  marketplaceItems:  (status?: string) => adminFetch<{ success: boolean; data: MarketplaceItem[] }>(`/api/admin/marketplace${status ? `?status=${status}` : ''}`),
  approveProduct:    (id: string)      => adminFetch<{ success: boolean }>(`/api/admin/marketplace/${id}/approve`, { method: 'POST' }),
  rejectProduct:     (id: string, reason: string) => adminFetch<{ success: boolean }>(`/api/admin/marketplace/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Support
  tickets:     (status?: string) => adminFetch<{ success: boolean; data: SupportTicket[] }>(`/api/admin/tickets${status ? `?status=${status}` : ''}`),
  replyTicket: (id: string, message: string) => adminFetch<{ success: boolean }>(`/api/admin/tickets/${id}/reply`, { method: 'POST', body: JSON.stringify({ message }) }),
  updateTicket:(id: string, status: string)  => adminFetch<{ success: boolean }>(`/api/admin/tickets/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // AI
  aiStats:  () => adminFetch<{ success: boolean; data: AIStats }>('/api/admin/ai/stats'),
  aiModels: () => adminFetch<{ success: boolean; data: AIModel[] }>('/api/admin/ai/models'),

  // Settings
  settings: () => adminFetch<{ success: boolean; data: AdminSettings }>('/api/admin/settings'),
  updateSettings: (data: Partial<AdminSettings>) => adminFetch<{ success: boolean }>('/api/admin/settings', { method: 'PATCH', body: JSON.stringify(data) }),

  // Bans
  bans: () => adminFetch<{ success: boolean; data: BanEntry[] }>('/api/admin/bans'),

  // Audit logs
  auditLogs: () => adminFetch<{ success: boolean; data: AuditLog[] }>('/api/admin/logs'),
}

// ── Types ──────────────────────────────────────────────────────
export interface AdminUser {
  id: string; name: string; email: string; plan: string; status: string;
  createdAt: string; lastActive?: string; projects?: number; aiRequests?: number;
  banReason?: string;
}
export interface StripeOverview {
  mrr: number; arr: number; totalRevenue: number; todayRevenue: number;
  activeSubscriptions: number; successRate: number; balance: number;
  revenue7d: Array<{ date: string; amount: number }>
}
export interface StripeCharge {
  id: string; amount: number; currency: string; status: string;
  customerEmail: string; created: number; description: string; refunded: boolean;
}
export interface StripeSub {
  id: string; customerEmail: string; plan: string; amount: number;
  status: string; created: number; currentPeriodEnd: number; cancelAtPeriodEnd: boolean;
}
export interface MonitoringData {
  latest: { cpu: number; ram: { used: number; total: number }; timestamp: number }
  metrics: Array<{ cpu: number; ram: { used: number; total: number }; timestamp: number }>
  services: Array<{ name: string; status: string; latencyMs: number; uptime: number }>
}
export interface ErrorLog { id: number; level: string; message: string; service: string; timestamp: string }
export interface MarketplaceItem { id: string; title: string; author: string; category: string; status: string; createdAt: string; price: number; downloads: number }
export interface SupportTicket { id: string; subject: string; userName: string; userEmail: string; priority: string; status: string; createdAt: string; messages: Array<{ author: string; role: string; text: string; time: string }> }
export interface AIStats { requestsToday: number; requestsMonth: number; avgLatencyMs: number; errorRate: number; costUSD: number; topModel: string }
export interface AIModel { id: string; name: string; status: string; requestsToday: number; avgLatencyMs: number; errorRate: number; costPer1k: number; enabled: boolean }
export interface AdminSettings { maintenanceMode: boolean; registrationsEnabled: boolean; maxUploadMB: number; supportEmail: string; features: Record<string, boolean> }
export interface BanEntry { id: string; userId: string; name: string; email: string; reason: string; bannedAt: string; permanent: boolean }
export interface AuditLog { id: number; actor: string; action: string; target: string; time: string }
export interface StripeAnalytics {
  mrr: number; arr: number; totalRevenue: number; todayRevenue: number
  revenue7d: Array<{ date: string; amount: number }>
  revenue30d: Array<{ date: string; amount: number }>
  activeSubscriptions: number; canceledThisMonth: number; newThisMonth: number
  churnRate: number; avgRevenuePerUser: number
  successRate: number; failedPayments: number
  refundCount: number; refundAmount: number; balance: number
}
export interface StripeInvoice {
  id: string; customer: string; customer_email: string
  amount_paid: number; amount_due: number; currency: string
  status: string; created: number; period_start: number; period_end: number
  subscription?: string; hosted_invoice_url?: string
}
export interface StripeCoupon {
  id: string; name: string; percent_off?: number; amount_off?: number; currency?: string
  duration: string; duration_in_months?: number
  times_redeemed: number; max_redemptions?: number; valid: boolean; created: number
}
export interface StripeWebhookLog {
  id: string; type: string; created: number; livemode: boolean
  status: 'success' | 'failed'; error?: string
}
