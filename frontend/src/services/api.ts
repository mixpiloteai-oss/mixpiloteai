// ============================================================
// NEUROTEK AI — Centralized API Client
//
// All requests go through this module.
// JWT token is stored in memory (never in source code).
// ============================================================
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

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

// ── Auto-refresh expired tokens ─────────────────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

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
  plans: () => apiClient.get('/api/subscriptions/plans'),
  my: () => apiClient.get('/api/subscriptions/my'),
  upgrade: (plan: string) => apiClient.post('/api/subscriptions/upgrade', { plan }),
};
