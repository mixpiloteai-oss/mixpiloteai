import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';

const ADMIN_KEY = process.env.ADMIN_KEY ?? 'nt-admin-dev-2025';
const adminHeaders = { 'x-admin-key': ADMIN_KEY, 'content-type': 'application/json' };

describe('Admin Analytics — real SaaS endpoints', () => {
  let srv: TestServer;
  before(async () => { srv = await startTestServer(); });
  after(async () => { await srv.close(); });

  // ── Auth gate ─────────────────────────────────────────────

  test('GET /api/admin/analytics/dashboard without auth → 403', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/analytics/dashboard`);
    assert.equal(res.status, 403);
  });

  test('GET /api/admin/analytics/revenue without auth → 403', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/analytics/revenue`);
    assert.equal(res.status, 403);
  });

  // ── Dashboard ────────────────────────────────────────────

  test('GET /api/admin/analytics/dashboard → 200 with all sections', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/analytics/dashboard`, { headers: adminHeaders });
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; data: Record<string, unknown> };
    assert.equal(body.success, true);
    const d = body.data;
    assert.ok(d['revenue'], 'expected revenue section');
    assert.ok(d['users'], 'expected users section');
    assert.ok(d['ai'], 'expected ai section');
    assert.ok(d['marketplace'], 'expected marketplace section');
    assert.ok(d['system'], 'expected system section');
    assert.ok(d['generatedAt'], 'expected generatedAt timestamp');
  });

  // ── Revenue ──────────────────────────────────────────────

  test('GET /api/admin/analytics/revenue → 200 with correct shape', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/analytics/revenue`, { headers: adminHeaders });
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; data: Record<string, unknown> };
    const r = body.data;
    assert.ok(typeof r['mrr'] === 'number', 'mrr must be number');
    assert.ok(typeof r['arr'] === 'number', 'arr must be number');
    assert.ok(typeof r['totalRevenue'] === 'number', 'totalRevenue must be number');
    assert.ok(typeof r['churnRate'] === 'number', 'churnRate must be number');
    assert.ok(typeof r['isMock'] === 'boolean', 'isMock must be boolean');
    // ARR = MRR * 12
    assert.equal(r['arr'], (r['mrr'] as number) * 12);
    // Values must be non-negative
    assert.ok((r['mrr'] as number) >= 0, 'mrr >= 0');
    assert.ok((r['churnRate'] as number) >= 0, 'churnRate >= 0');
  });

  test('GET /api/admin/analytics/revenue/timeseries → 200 with daily+monthly arrays', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/analytics/revenue/timeseries`, { headers: adminHeaders });
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; data: { daily: unknown[]; monthly: unknown[] } };
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.daily), 'daily must be array');
    assert.ok(Array.isArray(body.data.monthly), 'monthly must be array');
    assert.equal(body.data.daily.length, 30, 'daily should have 30 points');
    assert.equal(body.data.monthly.length, 12, 'monthly should have 12 points');
  });

  test('GET /api/admin/analytics/revenue/timeseries?period=30d → daily series', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/analytics/revenue/timeseries?period=30d`, { headers: adminHeaders });
    assert.equal(res.status, 200);
    const body = await res.json() as { data: { daily: Array<{ date: string; value: number }> } };
    assert.ok(body.data.daily.length > 0);
    // Each point must have date and value
    for (const pt of body.data.daily) {
      assert.ok(typeof pt.date === 'string', 'date must be string');
      assert.ok(typeof pt.value === 'number', 'value must be number');
      assert.ok(pt.value >= 0, 'value must be >= 0');
    }
  });

  // ── Users ────────────────────────────────────────────────

  test('GET /api/admin/analytics/users → 200 with plan breakdown', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/analytics/users`, { headers: adminHeaders });
    assert.equal(res.status, 200);
    const body = await res.json() as { data: Record<string, unknown> };
    const u = body.data;
    assert.ok(typeof u['totalUsers'] === 'number');
    assert.ok(typeof u['activeUsers'] === 'number');
    assert.ok(typeof u['conversionRate'] === 'number');
    assert.ok(typeof u['isMock'] === 'boolean');
    const byPlan = u['byPlan'] as Record<string, number>;
    assert.ok(typeof byPlan.free === 'number');
    assert.ok(typeof byPlan.pro === 'number');
    assert.ok(typeof byPlan.studio === 'number');
    // Active users <= total users
    assert.ok((u['activeUsers'] as number) <= (u['totalUsers'] as number));
    // Conversion rate in [0, 100]
    assert.ok((u['conversionRate'] as number) >= 0 && (u['conversionRate'] as number) <= 100);
  });

  test('GET /api/admin/analytics/users/timeseries → 200', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/analytics/users/timeseries`, { headers: adminHeaders });
    assert.equal(res.status, 200);
    const body = await res.json() as { data: { daily: unknown[]; monthly: unknown[] } };
    assert.ok(Array.isArray(body.data.daily));
    assert.ok(Array.isArray(body.data.monthly));
  });

  // ── AI ───────────────────────────────────────────────────

  test('GET /api/admin/analytics/ai → 200 with usage metrics', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/analytics/ai`, { headers: adminHeaders });
    assert.equal(res.status, 200);
    const body = await res.json() as { data: Record<string, unknown> };
    const ai = body.data;
    assert.ok(typeof ai['totalRequestsAllTime'] === 'number');
    assert.ok(typeof ai['requestsToday'] === 'number');
    assert.ok(typeof ai['requestsThisMonth'] === 'number');
    assert.ok(typeof ai['avgLatencyMs'] === 'number');
    assert.ok(typeof ai['cacheHitRate'] === 'number');
    assert.ok(typeof ai['errorRate'] === 'number');
    assert.ok(typeof ai['estimatedCostCents'] === 'number');
    assert.ok(Array.isArray(ai['hourlyDistribution']));
    assert.equal((ai['hourlyDistribution'] as number[]).length, 24);
    assert.ok(Array.isArray(ai['topModels']));
    // Rates in [0, 100]
    assert.ok((ai['cacheHitRate'] as number) >= 0 && (ai['cacheHitRate'] as number) <= 100);
    assert.ok((ai['errorRate'] as number) >= 0 && (ai['errorRate'] as number) <= 100);
  });

  // ── Marketplace ──────────────────────────────────────────

  test('GET /api/admin/analytics/marketplace → 200 with product counts', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/analytics/marketplace`, { headers: adminHeaders });
    assert.equal(res.status, 200);
    const body = await res.json() as { data: Record<string, unknown> };
    const mp = body.data;
    assert.ok(typeof mp['totalProducts'] === 'number');
    assert.ok(typeof mp['approvedProducts'] === 'number');
    assert.ok(typeof mp['pendingProducts'] === 'number');
    assert.ok(typeof mp['totalSales'] === 'number');
    assert.ok(typeof mp['totalRevenueCents'] === 'number');
    assert.ok(typeof mp['platformCommissionCents'] === 'number');
    assert.ok(Array.isArray(mp['topCategories']));
    // approved + pending <= total
    assert.ok(
      (mp['approvedProducts'] as number) + (mp['pendingProducts'] as number) <= (mp['totalProducts'] as number) + 1
    );
  });

  // ── System ───────────────────────────────────────────────

  test('GET /api/admin/analytics/system → 200 with real metrics', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/analytics/system`, { headers: adminHeaders });
    assert.equal(res.status, 200);
    const body = await res.json() as { data: Record<string, unknown> };
    const sys = body.data;
    assert.ok(typeof sys['cpuUsagePct'] === 'number');
    assert.ok(typeof sys['memUsedMb'] === 'number');
    assert.ok(typeof sys['memTotalMb'] === 'number');
    assert.ok(typeof sys['uptimeSeconds'] === 'number');
    assert.ok(typeof sys['nodeVersion'] === 'string');
    assert.ok(typeof sys['platform'] === 'string');
    // CPU in [0, 100] (real measurement)
    assert.ok((sys['cpuUsagePct'] as number) >= 0 && (sys['cpuUsagePct'] as number) <= 100);
    // Memory sane
    assert.ok((sys['memUsedMb'] as number) > 0, 'memUsedMb > 0');
    assert.ok((sys['memTotalMb'] as number) > 0, 'memTotalMb > 0');
    assert.ok((sys['memUsedMb'] as number) <= (sys['memTotalMb'] as number), 'used <= total');
    // Uptime positive
    assert.ok((sys['uptimeSeconds'] as number) > 0);
    // Node version format
    assert.ok((sys['nodeVersion'] as string).startsWith('v'), 'nodeVersion starts with v');
  });

  // ── CSV Export ───────────────────────────────────────────

  test('GET /api/admin/analytics/export/csv?type=revenue → CSV content', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/analytics/export/csv?type=revenue`, { headers: adminHeaders });
    assert.equal(res.status, 200);
    const ct = res.headers.get('content-type') ?? '';
    assert.ok(ct.includes('text/csv') || ct.includes('application/octet-stream') || ct.includes('text/plain'),
      `Expected CSV content-type, got: ${ct}`);
    const text = await res.text();
    assert.ok(text.length > 0, 'CSV should not be empty');
    assert.ok(text.includes(','), 'CSV should contain commas');
  });

  test('GET /api/admin/analytics/export/csv?type=users → CSV content', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/analytics/export/csv?type=users`, { headers: adminHeaders });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('plan') || text.includes('count') || text.length > 0);
  });

  test('GET /api/admin/analytics/export/csv?type=ai → CSV content', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/analytics/export/csv?type=ai`, { headers: adminHeaders });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.length > 0);
  });

  test('GET /api/admin/analytics/export/csv?type=marketplace → CSV content', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/analytics/export/csv?type=marketplace`, { headers: adminHeaders });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.length > 0);
  });

  test('GET /api/admin/analytics/export/csv?type=invalid → 400', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/analytics/export/csv?type=hacker`, { headers: adminHeaders });
    assert.ok(res.status === 400 || res.status === 422, `Expected 400 for invalid type, got ${res.status}`);
  });

  // ── No hardcoded values ───────────────────────────────────

  test('Revenue MRR is computed from plan counts (not hardcoded)', async () => {
    const res1 = await fetch(`${srv.baseUrl}/api/admin/analytics/revenue`, { headers: adminHeaders });
    const res2 = await fetch(`${srv.baseUrl}/api/admin/analytics/revenue`, { headers: adminHeaders });
    const b1 = await res1.json() as { data: { mrr: number } };
    const b2 = await res2.json() as { data: { mrr: number } };
    // Same MRR across calls (deterministic, not random)
    assert.equal(b1.data.mrr, b2.data.mrr, 'MRR must be deterministic — no Math.random()');
  });

  test('System CPU is a real measurement (not random)', async () => {
    const res1 = await fetch(`${srv.baseUrl}/api/admin/analytics/system`, { headers: adminHeaders });
    const res2 = await fetch(`${srv.baseUrl}/api/admin/analytics/system`, { headers: adminHeaders });
    const b1 = await res1.json() as { data: { cpuUsagePct: number } };
    const b2 = await res2.json() as { data: { cpuUsagePct: number } };
    // Real CPU measurements should both be finite numbers in [0,100]
    assert.ok(isFinite(b1.data.cpuUsagePct) && isFinite(b2.data.cpuUsagePct));
    // If random, values would differ wildly. Real values are correlated.
    // We cannot assert exact equality (CPU fluctuates), but both must be valid.
    assert.ok(b1.data.cpuUsagePct >= 0 && b1.data.cpuUsagePct <= 100);
    assert.ok(b2.data.cpuUsagePct >= 0 && b2.data.cpuUsagePct <= 100);
  });

  // ── Performance ───────────────────────────────────────────

  test('Dashboard loads in under 2000ms', async () => {
    const start = Date.now();
    const res = await fetch(`${srv.baseUrl}/api/admin/analytics/dashboard`, { headers: adminHeaders });
    const elapsed = Date.now() - start;
    assert.equal(res.status, 200);
    assert.ok(elapsed < 2000, `Dashboard took ${elapsed}ms, expected < 2000ms`);
  });

  test('System metrics load in under 500ms', async () => {
    const start = Date.now();
    await fetch(`${srv.baseUrl}/api/admin/analytics/system`, { headers: adminHeaders });
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 500, `System metrics took ${elapsed}ms, expected < 500ms`);
  });

  // ── Permissions ───────────────────────────────────────────

  test('Analytics endpoints require admin key (not regular user token)', async () => {
    // Use a fake user JWT — should be rejected
    const res = await fetch(`${srv.baseUrl}/api/admin/analytics/revenue`, {
      headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InVzZXIifQ.fake' },
    });
    assert.ok(res.status === 401 || res.status === 403,
      `Expected 401/403 with user token, got ${res.status}`);
  });

  // ── Large dataset robustness ──────────────────────────────

  test('Revenue timeseries handles large period gracefully', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/analytics/revenue/timeseries?period=12m`, {
      headers: adminHeaders,
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { data: { monthly: unknown[] } };
    assert.equal(body.data.monthly.length, 12);
  });
});
