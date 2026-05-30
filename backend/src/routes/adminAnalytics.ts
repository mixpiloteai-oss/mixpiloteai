// ============================================================
// NEUROTEK AI — Admin Analytics Routes
// ============================================================
// Mounted at /api/admin/analytics. All endpoints require admin auth.
// Delegates to analyticsService which computes real KPIs from
// actual payment logs, user data, AI counters, and marketplace.
// ============================================================
import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { requireAdmin } from '../middleware/adminAuth';
import {
  getRevenueMetrics,
  getRevenueTimeSeries,
  getUserMetrics,
  getUserTimeSeries,
  getAIUsageMetrics,
  getMarketplaceMetrics,
  getSystemMetrics,
  getDashboardMetrics,
  RevenueMetrics,
  UserMetrics,
  AIUsageMetrics,
  MarketplaceMetrics,
  SystemMetrics,
  TimeSeriesPoint,
} from '../services/analyticsService';

const router = Router();

// All routes in this file require admin JWT
// Cast needed because requireAdmin declares req as AdminRequest (extends Request)
router.use(requireAdmin as unknown as RequestHandler);

// ── Helper: send JSON ─────────────────────────────────────────
function ok(res: Response, data: unknown): void {
  res.json({ success: true, data, generatedAt: new Date().toISOString() });
}

function fail(res: Response, err: unknown, status = 500): void {
  const message = err instanceof Error ? err.message : String(err);
  res.status(status).json({ success: false, error: message });
}

// ── Revenue ──────────────────────────────────────────────────

/**
 * GET /api/admin/analytics/revenue
 * Returns full revenue KPIs: MRR, ARR, growth, churn, ARPU.
 */
router.get('/revenue', async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await getRevenueMetrics();
    ok(res, data);
  } catch (err) {
    fail(res, err);
  }
});

/**
 * GET /api/admin/analytics/revenue/timeseries?period=30d|12m
 * Returns daily (last 30d) and monthly (last 12m) revenue time series.
 * The `period` query param filters which series to return.
 */
router.get('/revenue/timeseries', async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = 'all' } = req.query as { period?: string };
    const ts = await getRevenueTimeSeries();

    let data: { daily?: TimeSeriesPoint[]; monthly?: TimeSeriesPoint[] };
    if (period === '30d')      data = { daily:   ts.daily };
    else if (period === '12m') data = { monthly: ts.monthly };
    else                       data = ts;

    ok(res, data);
  } catch (err) {
    fail(res, err);
  }
});

// ── Users ────────────────────────────────────────────────────

/**
 * GET /api/admin/analytics/users
 * Returns user KPIs: total, active, growth, by-plan, conversion.
 */
router.get('/users', async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await getUserMetrics();
    ok(res, data);
  } catch (err) {
    fail(res, err);
  }
});

/**
 * GET /api/admin/analytics/users/timeseries?period=30d|12m
 * Returns daily/monthly user signup growth time series.
 */
router.get('/users/timeseries', async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = 'all' } = req.query as { period?: string };
    const ts = await getUserTimeSeries();

    let data: { daily?: TimeSeriesPoint[]; monthly?: TimeSeriesPoint[] };
    if (period === '30d')      data = { daily:   ts.daily };
    else if (period === '12m') data = { monthly: ts.monthly };
    else                       data = ts;

    ok(res, data);
  } catch (err) {
    fail(res, err);
  }
});

// ── AI Usage ─────────────────────────────────────────────────

/**
 * GET /api/admin/analytics/ai
 * Returns AI request counts, latency, cache hit rate, cost estimate.
 */
router.get('/ai', async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await getAIUsageMetrics();
    ok(res, data);
  } catch (err) {
    fail(res, err);
  }
});

// ── Marketplace ──────────────────────────────────────────────

/**
 * GET /api/admin/analytics/marketplace
 * Returns marketplace KPIs: products, sales, revenue, top categories/sellers.
 */
router.get('/marketplace', async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await getMarketplaceMetrics();
    ok(res, data);
  } catch (err) {
    fail(res, err);
  }
});

// ── System ───────────────────────────────────────────────────

/**
 * GET /api/admin/analytics/system
 * Returns real CPU %, RAM usage, uptime, request latency percentiles.
 */
router.get('/system', async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await getSystemMetrics();
    ok(res, data);
  } catch (err) {
    fail(res, err);
  }
});

// ── Dashboard ────────────────────────────────────────────────

/**
 * GET /api/admin/analytics/dashboard
 * All KPIs in one call — optimized for initial page load.
 * Fires all analytics computations in parallel.
 */
router.get('/dashboard', async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await getDashboardMetrics();
    ok(res, data);
  } catch (err) {
    fail(res, err);
  }
});

// ── CSV Export ───────────────────────────────────────────────

type ExportType = 'revenue' | 'users' | 'ai' | 'marketplace';

function flattenToCsv(records: Record<string, unknown>[]): string {
  if (records.length === 0) return '';
  const headers = Object.keys(records[0]!);
  const rows = records.map(r =>
    headers.map(h => {
      const v = r[h];
      if (typeof v === 'object' && v !== null) return JSON.stringify(v);
      return String(v ?? '');
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

function metricsToRecord<T extends object>(data: T): Record<string, unknown>[] {
  return [data as unknown as Record<string, unknown>];
}

/**
 * GET /api/admin/analytics/export/csv?type=revenue|users|ai|marketplace
 * Downloads any dataset as a CSV file.
 */
router.get('/export/csv', async (req: Request, res: Response): Promise<void> => {
  const { type } = req.query as { type?: ExportType };
  if (!type || !['revenue', 'users', 'ai', 'marketplace'].includes(type)) {
    res.status(400).json({ success: false, error: 'type must be one of: revenue, users, ai, marketplace' });
    return;
  }

  try {
    let csv = '';
    let filename = `${type}-analytics-${new Date().toISOString().slice(0, 10)}.csv`;

    if (type === 'revenue') {
      const data: RevenueMetrics = await getRevenueMetrics();
      const ts = await getRevenueTimeSeries();
      // Export daily time series
      csv = flattenToCsv(ts.daily as unknown as Record<string, unknown>[]);
      filename = `revenue-daily-${new Date().toISOString().slice(0, 10)}.csv`;
      // Prepend KPI summary as comment lines
      const summary = [
        `# MRR (cents): ${data.mrr}`,
        `# ARR (cents): ${data.arr}`,
        `# Total Revenue (cents): ${data.totalRevenue}`,
        `# MRR Growth %: ${data.mrrGrowthPct}`,
        `# Churn Rate %: ${data.churnRate}`,
        '',
      ].join('\n');
      csv = summary + csv;
    } else if (type === 'users') {
      const data: UserMetrics = await getUserMetrics();
      const ts = await getUserTimeSeries();
      csv = flattenToCsv(ts.daily as unknown as Record<string, unknown>[]);
      filename = `user-growth-daily-${new Date().toISOString().slice(0, 10)}.csv`;
      const summary = [
        `# Total Users: ${data.totalUsers}`,
        `# Active (30d): ${data.activeUsers}`,
        `# New This Month: ${data.newUsersThisMonth}`,
        `# Conversion Rate %: ${data.conversionRate}`,
        '',
      ].join('\n');
      csv = summary + csv;
    } else if (type === 'ai') {
      const data: AIUsageMetrics = await getAIUsageMetrics();
      // Export top models
      csv = flattenToCsv(metricsToRecord(data));
    } else if (type === 'marketplace') {
      const data: MarketplaceMetrics = await getMarketplaceMetrics();
      // Export top categories
      csv = flattenToCsv(data.topCategories as unknown as Record<string, unknown>[]);
      const summary = [
        `# Total Products: ${data.totalProducts}`,
        `# Total Sales: ${data.totalSales}`,
        `# Total Revenue (cents): ${data.totalRevenueCents}`,
        `# Platform Commission (cents): ${data.platformCommissionCents}`,
        '',
      ].join('\n');
      csv = summary + csv;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    fail(res, err);
  }
});

export default router;
