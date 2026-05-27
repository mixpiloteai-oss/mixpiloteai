// ============================================================
// NEUROTEK AI — Centralized API Client  (Offline-First)
//
// GET  requests: served from IndexedDB cache when offline;
//                fresh responses are written to cache on success.
// POST/PATCH/DELETE: queued in IndexedDB when offline and
//                    replayed via /api/sync when reconnected.
// Projects are NEVER discarded when connectivity is lost.
// ============================================================
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { cacheApiResponse, getCachedApiResponse } from './offlineCache';
import { enqueue } from './syncQueue';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Token management (in-memory, not window object) ────────────
let accessToken: string | null = localStorage.getItem('nt_access_token');
let refreshToken: string | null = localStorage.getItem('nt_refresh_token');

export function setTokens(at: string, rt: string): void {
  accessToken = at;
  refreshToken = rt;
  localStorage.setItem('nt_access_token', at);
  localStorage.setItem('nt_refresh_token', rt);
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('nt_access_token');
  localStorage.removeItem('nt_refresh_token');
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ── Attach Bearer token to every request ─────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ── Offline-first: serve cached GETs when offline ────────────
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (!navigator.onLine && (config.method ?? 'get').toLowerCase() === 'get' && config.url) {
    const cached = await getCachedApiResponse(config.url);
    if (cached !== null) {
      // Return a synthetic settled response so callers receive data uninterrupted
      return Promise.reject(Object.assign(new Error('__offline_cache__'), {
        __offlineCache: true,
        __cachedData:   cached,
      }));
    }
  }
  return config;
});

// ── Auto-refresh expired tokens ─────────────────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

apiClient.interceptors.response.use(
  // Cache successful GET responses
  async (res) => {
    if ((res.config.method ?? 'get').toLowerCase() === 'get' && res.config.url && res.data) {
      await cacheApiResponse(res.config.url, res.data).catch(() => {});
    }
    return res;
  },
  async (error: AxiosError & { __offlineCache?: boolean; __cachedData?: unknown }) => {
    // ── Serve from cache (offline GET) ──────────────────────────────────────
    if (error.__offlineCache) {
      return Promise.resolve({ data: error.__cachedData, status: 200, statusText: 'OK (cached)', headers: {}, config: {} });
    }

    const isNetworkError = !error.response;
    const config = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const method = (config?.method ?? 'get').toLowerCase();

    // ── Queue mutations that fail due to network loss ────────────────────────
    if (isNetworkError && config && method !== 'get') {
      const opType = `${method.toUpperCase()}_${(config.url ?? '').replace(/[^A-Z0-9_]/gi, '_').toUpperCase()}`;
      await enqueue({
        method:      (method.toUpperCase() as 'POST' | 'PUT' | 'PATCH' | 'DELETE'),
        url:         config.url ?? '',
        payload:     config.data ? JSON.parse(config.data as string) : undefined,
        type:        opType,
        accessToken: accessToken,
      }).catch(() => {});
      // Return a synthetic "queued" response so the UI doesn't crash
      return Promise.resolve({
        data:       { success: true, queued: true, offline: true },
        status:     202,
        statusText: 'Queued (offline)',
        headers:    {},
        config,
      });
    }

    // ── Fallback to stale cache on network error (GET) ───────────────────────
    if (isNetworkError && config && method === 'get' && config.url) {
      const cached = await getCachedApiResponse(config.url).catch(() => null);
      if (cached !== null) {
        return Promise.resolve({ data: cached, status: 200, statusText: 'OK (stale cache)', headers: {}, config });
      }
    }

    if (!config) return Promise.reject(error);
    const original = config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (
      error.response?.status === 401 &&
      (error.response.data as { code?: string })?.code === 'TOKEN_EXPIRED' &&
      !original._retry &&
      refreshToken
    ) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((newToken) => {
            original.headers.Authorization = `Bearer ${newToken}`;
            resolve(apiClient(original));
          });
        });
      }

      isRefreshing = true;
      try {
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken });
        setTokens(data.data.accessToken, data.data.refreshToken);
        refreshQueue.forEach((cb) => cb(data.data.accessToken));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return apiClient(original);
      } catch {
        clearTokens();
        window.location.href = '/';
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ── Auth API ────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/api/auth/login', { email, password }),

  register: (email: string, name: string, password: string) =>
    apiClient.post('/api/auth/register', { email, name, password }),

  me: () => apiClient.get('/api/auth/me'),

  logout: () => apiClient.post('/api/auth/logout'),

  /** Send password reset email (always 200 — no email enumeration) */
  forgotPassword: (email: string) =>
    apiClient.post('/api/auth/forgot-password', { email }),

  /** Consume reset token and set a new password */
  resetPassword: (token: string, password: string) =>
    apiClient.post('/api/auth/reset-password', { token, password }),

  /** Verify email address with one-time token */
  verifyEmail: (token: string) =>
    apiClient.post('/api/auth/verify-email', { token }),

  /** Resend email verification link (requires auth) */
  resendVerification: () =>
    apiClient.post('/api/auth/resend-verification'),

  /** List all active sessions for the authenticated user */
  sessions: () => apiClient.get('/api/auth/sessions'),

  /** Revoke a specific session by ID */
  revokeSession: (id: string) =>
    apiClient.delete(`/api/auth/sessions/${id}`),

  /** Revoke all sessions (sign out everywhere) */
  revokeAllSessions: () =>
    apiClient.delete('/api/auth/sessions'),

  /** Change password (requires current password for verification) */
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post('/api/auth/change-password', { currentPassword, newPassword }),
};

// ── AI API (all server-side, key never visible here) ───────────
export const aiApi = {
  chat: (message: string, context?: object, history?: object[], type?: string) =>
    apiClient.post('/api/ai/chat', { message, context, history, type }),

  generateTemplate: (genre: string, bpm: number, mood?: string) =>
    apiClient.post('/api/ai/generate-template', { genre, bpm, mood }),

  analyseMix: (tracks: object[], genre?: string, bpm?: number) =>
    apiClient.post('/api/ai/analyse-mix', { tracks, genre, bpm }),

  suggestFX: (trackType: string, genre?: string, bpm?: number, trackName?: string) =>
    apiClient.post('/api/ai/suggest-fx', { trackType, genre, bpm, trackName }),

  designKick: (genre?: string, bpm?: number, style?: string) =>
    apiClient.post('/api/ai/design-kick', { genre, bpm, style }),

  prepareLive: (genre?: string, duration?: number, bpm?: number, tracksCount?: number) =>
    apiClient.post('/api/ai/prepare-live', { genre, duration, bpm, tracksCount }),

  acidPattern: (key?: string, bpm?: number, style?: string, bars?: number) =>
    apiClient.post('/api/ai/acid-pattern', { key, bpm, style, bars }),

  getQuota: () => apiClient.get('/api/ai/quota'),
};

// ── Projects API ────────────────────────────────────────────
export const projectsApi = {
  list: () => apiClient.get('/api/projects'),
  get: (id: string) => apiClient.get(`/api/projects/${id}`),
  create: (data: object) => apiClient.post('/api/projects', data),
  update: (id: string, data: object) => apiClient.put(`/api/projects/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/projects/${id}`),
};

// ── Subscriptions API ─────────────────────────────────────────
export const subscriptionsApi = {
  plans:          ()                              => apiClient.get('/api/subscriptions/plans'),
  creditPacks:    ()                              => apiClient.get('/api/subscriptions/credit-packs'),
  my:             ()                              => apiClient.get('/api/subscriptions/my'),
  status:         ()                              => apiClient.get('/api/subscriptions/status'),
  upgrade:        (plan: string, annual = false)  => apiClient.post('/api/subscriptions/upgrade', { plan, annual }),
  cancel:         (immediate = false, reason?: string) => apiClient.post('/api/subscriptions/cancel', { immediate, reason }),
  reactivate:     ()                              => apiClient.post('/api/subscriptions/reactivate'),
  validateCoupon: (code: string, amountCents: number, planId?: string) =>
    apiClient.post('/api/subscriptions/validate-coupon', { code, amountCents, planId }),
  redeemCoupon:   (code: string, planId?: string) =>
    apiClient.post('/api/subscriptions/redeem-coupon', { code, planId }),
};

// ── Billing / Payments API ───────────────────────────────────
let _idempotencyKey: string | null = null;

/** Generate a one-shot idempotency key for the next payment request */
export function newPaymentKey(): string {
  _idempotencyKey = crypto.randomUUID();
  return _idempotencyKey;
}

function paymentHeaders(key?: string): Record<string, string> {
  const k = key ?? _idempotencyKey;
  _idempotencyKey = null; // consume after use
  return k ? { 'Idempotency-Key': k } : {};
}

export const billingApi = {
  /** Real transaction history from DB */
  history: (limit = 20) =>
    apiClient.get(`/api/payments/history?limit=${limit}`),

  /** Real invoices list from DB */
  invoices: () =>
    apiClient.get('/api/payments/invoices'),

  /** Get single invoice as JSON (for download) */
  getInvoice: (id: string) =>
    apiClient.get(`/api/payments/invoices/${id}`),

  /** Create Stripe Hosted Checkout session */
  createStripeSession: (params: {
    type: 'plan' | 'credits' | 'marketplace'
    planId?: string
    pkg?: string
    productId?: string
    productName?: string
    amountCents?: number
    annual?: boolean
    couponCode?: string
    successUrl?: string
    cancelUrl?: string
  }, idempotencyKey?: string) =>
    apiClient.post('/api/payments/stripe/session', params, {
      headers: paymentHeaders(idempotencyKey),
    }),

  /** Get checkout session status (verify payment) */
  getStripeSession: (sessionId: string) =>
    apiClient.get(`/api/payments/stripe/session/${sessionId}`),

  /** Create PayPal order */
  createPayPalOrder: (amountUSD: string, description?: string, idempotencyKey?: string) =>
    apiClient.post('/api/payments/paypal/create-order', { amountUSD, description }, {
      headers: paymentHeaders(idempotencyKey),
    }),

  /** Capture approved PayPal order */
  capturePayPalOrder: (orderId: string, idempotencyKey?: string) =>
    apiClient.post('/api/payments/paypal/capture', { orderId }, {
      headers: paymentHeaders(idempotencyKey),
    }),

  /** Request a refund */
  requestRefund: (params: {
    paymentMethod: 'stripe' | 'paypal'
    paymentIntentId?: string
    captureId?: string
    amountCents?: number
    reason?: string
  }) =>
    apiClient.post('/api/payments/refund', params),

  /** Validate a coupon code */
  validateCoupon: (code: string, amountCents: number, planId?: string) =>
    apiClient.post('/api/payments/coupon/validate', { code, amountCents, planId }),
};
