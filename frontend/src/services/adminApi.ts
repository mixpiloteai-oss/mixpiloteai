// ============================================================
// NEUROTEK AI — Admin API Client
// ============================================================
// Typed wrappers around all /api/admin/* endpoints.
// Handles admin auth tokens separately from user tokens.
// ============================================================
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

const adminHttp = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Admin token management ────────────────────────────────────
let adminToken: string | null = sessionStorage.getItem('nt_admin_token');

export function setAdminToken(token: string): void {
  adminToken = token;
  sessionStorage.setItem('nt_admin_token', token);
}
export function clearAdminToken(): void {
  adminToken = null;
  sessionStorage.removeItem('nt_admin_token');
}
export function getAdminToken(): string | null { return adminToken; }

adminHttp.interceptors.request.use((cfg) => {
  if (adminToken) cfg.headers['Authorization'] = `Bearer ${adminToken}`;
  return cfg;
});

// ── Types ─────────────────────────────────────────────────────

export interface RevenueMetrics {
  mrr: number; arr: number; totalRevenue: number;
  revenueThisMonth: number; revenueLastMonth: number;
  mrrGrowthPct: number; churnRate: number;
  newSubscriptions: number; cancelledSubscriptions: number;
  averageRevenuePerUser: number; isMock: boolean;
}
export interface TimeSeriesPoint { date: string; value: number; }
export interface RevenueTimeSeries { daily: TimeSeriesPoint[]; monthly: TimeSeriesPoint[]; }

export interface UserMetrics {
  totalUsers: number; activeUsers: number;
  newUsersThisMonth: number; newUsersLastMonth: number;
  userGrowthPct: number;
  byPlan: { free: number; pro: number; studio: number; label: number };
  conversionRate: number; retentionRate: number; isMock: boolean;
}

export interface AIUsageMetrics {
  totalRequestsAllTime: number; requestsToday: number; requestsThisMonth: number;
  avgLatencyMs: number; cacheHitRate: number; errorRate: number;
  estimatedCostCents: number;
  topModels: Array<{ model: string; requests: number; costCents: number }>;
  byPlan: { free: number; pro: number; studio: number };
  hourlyDistribution: number[];
  isMock: boolean;
}

export interface MarketplaceMetrics {
  totalProducts: number; approvedProducts: number; pendingProducts: number;
  totalSales: number; totalRevenueCents: number; platformCommissionCents: number;
  topCategories: Array<{ category: string; count: number }>;
  topSellers: Array<{ sellerId: string; sales: number; revenueCents: number }>;
  isMock: boolean;
}

export interface SystemMetrics {
  cpuUsagePct: number; memUsedMb: number; memTotalMb: number;
  uptimeSeconds: number; activeConnections: number; requestsPerMinute: number;
  errorRate: number; p50LatencyMs: number; p95LatencyMs: number; p99LatencyMs: number;
  nodeVersion: string; platform: string;
}

export interface DashboardSummary {
  revenue: RevenueMetrics; users: UserMetrics;
  ai: AIUsageMetrics; marketplace: MarketplaceMetrics; system: SystemMetrics;
  generatedAt: string;
}

export interface StripeOverview {
  mrr: number; arr: number; totalRevenue: number; successRate: number;
  activeSubscriptions: number; balance: { available: number; pending: number };
  isMock: boolean;
}

export interface AdminUser {
  id: string; email: string; name: string; plan: string;
  status: string; createdAt: number; lastActive: number;
  totalProjects: number; aiCreditsUsed: number;
}

// ── API calls ─────────────────────────────────────────────────

async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const res = await adminHttp.get<{ success: boolean; data: T }>(path, { params });
  return res.data.data;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await adminHttp.post<{ success: boolean; data: T }>(path, body);
  return res.data.data;
}

// Analytics
export const adminAnalytics = {
  dashboard: () => get<DashboardSummary>('/api/admin/analytics/dashboard'),
  revenue: () => get<RevenueMetrics>('/api/admin/analytics/revenue'),
  revenueSeries: (period: '30d' | '12m' = '30d') =>
    get<RevenueTimeSeries>('/api/admin/analytics/revenue/timeseries', { period }),
  users: () => get<UserMetrics>('/api/admin/analytics/users'),
  ai: () => get<AIUsageMetrics>('/api/admin/analytics/ai'),
  marketplace: () => get<MarketplaceMetrics>('/api/admin/analytics/marketplace'),
  system: () => get<SystemMetrics>('/api/admin/analytics/system'),
  exportCsv: (type: 'revenue' | 'users' | 'ai' | 'marketplace') =>
    `${BASE_URL}/api/admin/analytics/export/csv?type=${type}`,
};

// Existing admin endpoints
export const adminApi = {
  stats: () => get<Record<string, unknown>>('/api/admin/stats'),
  users: (params?: { page?: number; limit?: number; plan?: string; status?: string; search?: string }) =>
    get<{ users: AdminUser[]; total: number }>('/api/admin/users', params as Record<string, unknown>),
  banUser: (id: string, reason: string, days: number) =>
    post('/api/admin/users/' + id + '/ban', { reason, days }),
  unbanUser: (id: string) =>
    post('/api/admin/users/' + id + '/unban'),
  deleteUser: (id: string) =>
    adminHttp.delete('/api/admin/users/' + id),
  stripeOverview: () => get<StripeOverview>('/api/admin/stripe/overview'),
  stripeCharges: (limit = 20) => get('/api/admin/stripe/charges', { limit }),
  paypalAnalytics: () => get('/api/admin/paypal/analytics'),
  marketplace: (params?: { status?: string; page?: number }) =>
    get('/api/admin/marketplace', params as Record<string, unknown>),
  tickets: (params?: { status?: string; priority?: string }) =>
    get('/api/admin/tickets', params as Record<string, unknown>),
  coupons: () => get('/api/admin/coupons'),
  settings: () => get('/api/admin/settings'),
  updateSettings: (updates: Record<string, unknown>) =>
    adminHttp.patch('/api/admin/settings', updates),
  logs: (limit = 50) => get('/api/admin/logs', { limit }),
};

// Admin auth
export const adminAuth = {
  login: async (email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> => {
    const res = await adminHttp.post<{
      success: boolean;
      data: { accessToken: string; refreshToken: string };
    }>('/api/admin/auth/login', { email, password });
    return res.data.data;
  },
  logout: () => adminHttp.post('/api/admin/auth/logout'),
  me: () => get('/api/admin/auth/me'),
};
