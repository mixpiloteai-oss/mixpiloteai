// ============================================================
// NEUROTEK AI — API Performance Benchmarks
// ============================================================
// Validates that key endpoints stay within latency budgets.
// Runs against the real app (not mocked services).
// ============================================================
import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';
import { registerAndLogin } from '../setup/auth.ts';

const ADMIN_KEY = process.env.ADMIN_KEY ?? 'nt-admin-dev-2025';

describe('API Performance Benchmarks', () => {
  let srv: TestServer;
  let token: string;

  before(async () => {
    srv = await startTestServer();
    const user = await registerAndLogin(srv.baseUrl);
    token = user.accessToken;
  });

  after(async () => { await srv.close(); });

  function authH(): Record<string, string> {
    return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  }

  async function measureLatency(fn: () => Promise<Response>): Promise<number> {
    const start = Date.now();
    await fn();
    return Date.now() - start;
  }

  async function benchmarkN(
    label: string,
    n: number,
    fn: () => Promise<Response>
  ): Promise<{ p50: number; p95: number; p99: number; max: number }> {
    const latencies: number[] = [];
    for (let i = 0; i < n; i++) {
      latencies.push(await measureLatency(fn));
    }
    latencies.sort((a, b) => a - b);
    const pct = (p: number) => latencies[Math.ceil((p / 100) * latencies.length) - 1]!;
    const result = { p50: pct(50), p95: pct(95), p99: pct(99), max: Math.max(...latencies) };
    console.log(`  [${label}] P50=${result.p50}ms P95=${result.p95}ms P99=${result.p99}ms max=${result.max}ms`);
    return result;
  }

  // ── Health endpoint ─────────────────────────────────────────

  test('GET /health P95 < 50ms (20 samples)', async () => {
    const r = await benchmarkN('health', 20, () =>
      fetch(`${srv.baseUrl}/health`)
    );
    assert.ok(r.p95 < 50, `P95 was ${r.p95}ms, expected < 50ms`);
  });

  test('GET /health/detailed P95 < 200ms (10 samples)', async () => {
    const r = await benchmarkN('health/detailed', 10, () =>
      fetch(`${srv.baseUrl}/health/detailed`)
    );
    assert.ok(r.p95 < 200, `P95 was ${r.p95}ms, expected < 200ms`);
  });

  // ── Auth endpoints ──────────────────────────────────────────

  test('POST /api/auth/login P95 < 500ms (5 samples)', async () => {
    // Create a user first
    const email = `bench-${Date.now()}@test.local`;
    await fetch(`${srv.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'BenchPassword123!', name: 'Bench' }),
    });

    const r = await benchmarkN('login', 5, () =>
      fetch(`${srv.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'BenchPassword123!' }),
      })
    );
    assert.ok(r.p95 < 500, `P95 was ${r.p95}ms, expected < 500ms`);
  });

  // ── Projects endpoint ───────────────────────────────────────

  test('GET /api/projects P95 < 200ms (10 samples)', async () => {
    const r = await benchmarkN('projects', 10, () =>
      fetch(`${srv.baseUrl}/api/projects`, { headers: authH() })
    );
    assert.ok(r.p95 < 200, `P95 was ${r.p95}ms, expected < 200ms`);
  });

  // ── Templates endpoint ─────────────────────────────────────

  test('GET /api/templates P95 < 100ms (10 samples)', async () => {
    const r = await benchmarkN('templates', 10, () =>
      fetch(`${srv.baseUrl}/api/templates`, { headers: authH() })
    );
    assert.ok(r.p95 < 100, `P95 was ${r.p95}ms, expected < 100ms`);
  });

  test('POST /api/templates/generate P95 < 100ms (5 samples)', async () => {
    // Verify fake delay is removed
    const r = await benchmarkN('templates/generate', 5, () =>
      fetch(`${srv.baseUrl}/api/templates/generate`, {
        method: 'POST',
        headers: authH(),
        body: JSON.stringify({ genre: 'mentalcore', bpm: 200 }),
      })
    );
    assert.ok(r.p95 < 100, `P95 was ${r.p95}ms, expected < 100ms (fake delay should be removed)`);
  });

  // ── Admin analytics (parallel fetch) ───────────────────────

  test('GET /api/admin/analytics/dashboard P95 < 2000ms (5 samples)', async () => {
    const adminH = { 'x-admin-key': ADMIN_KEY };
    const r = await benchmarkN('admin/dashboard', 5, () =>
      fetch(`${srv.baseUrl}/api/admin/analytics/dashboard`, { headers: adminH })
    );
    assert.ok(r.p95 < 2000, `P95 was ${r.p95}ms, expected < 2000ms`);
  });

  test('GET /api/admin/analytics/system P95 < 500ms (5 samples)', async () => {
    const adminH = { 'x-admin-key': ADMIN_KEY };
    const r = await benchmarkN('admin/system', 5, () =>
      fetch(`${srv.baseUrl}/api/admin/analytics/system`, { headers: adminH })
    );
    assert.ok(r.p95 < 500, `P95 was ${r.p95}ms, expected < 500ms`);
  });

  // ── Metrics endpoint ────────────────────────────────────────

  test('GET /api/metrics P95 < 100ms (10 samples)', async () => {
    const adminH = { 'x-admin-key': ADMIN_KEY };
    const r = await benchmarkN('metrics', 10, () =>
      fetch(`${srv.baseUrl}/api/metrics`, { headers: adminH })
    );
    assert.ok(r.p95 < 100, `P95 was ${r.p95}ms, expected < 100ms`);
  });

  test('GET /api/metrics/prometheus returns valid Prometheus format', async () => {
    const adminH = { 'x-admin-key': ADMIN_KEY };
    const res = await fetch(`${srv.baseUrl}/api/metrics/prometheus`, { headers: adminH });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('# HELP neurotek_uptime_seconds'), 'missing uptime metric');
    assert.ok(text.includes('# HELP neurotek_requests_total'), 'missing requests counter');
    assert.ok(text.includes('neurotek_heap_used_bytes'), 'missing heap metric');
    // Prometheus content type
    const ct = res.headers.get('content-type') ?? '';
    assert.ok(ct.includes('text/plain'), `unexpected content-type: ${ct}`);
  });

  // ── Concurrency stress test ─────────────────────────────────

  test('20 concurrent /health requests all succeed', async () => {
    const requests = Array.from({ length: 20 }, () =>
      fetch(`${srv.baseUrl}/health`)
    );
    const responses = await Promise.all(requests);
    const failed = responses.filter(r => r.status !== 200);
    assert.equal(failed.length, 0, `${failed.length} of 20 concurrent requests failed`);
  });

  test('10 concurrent /api/projects requests all succeed', async () => {
    const requests = Array.from({ length: 10 }, () =>
      fetch(`${srv.baseUrl}/api/projects`, { headers: authH() })
    );
    const responses = await Promise.all(requests);
    const failed = responses.filter(r => r.status !== 200);
    assert.equal(failed.length, 0, `${failed.length} of 10 concurrent requests failed`);
  });
});
