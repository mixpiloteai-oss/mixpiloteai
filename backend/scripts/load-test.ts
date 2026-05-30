#!/usr/bin/env node
// ============================================================
// NEUROTEK AI — Load Test / Stress Test Script
// ============================================================
// Runs concurrent HTTP requests against the running backend
// and reports P50/P95/P99 latency, throughput, and error rate.
//
// Usage:
//   BASE_URL=http://localhost:4000 npx tsx scripts/load-test.ts
//   BASE_URL=https://api.neurotek.ai npx tsx scripts/load-test.ts --rps=100 --duration=60
// ============================================================

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4000';
const TARGET_RPS = Number(process.argv.find(a => a.startsWith('--rps='))?.slice(6) ?? 50);
const DURATION_SEC = Number(process.argv.find(a => a.startsWith('--duration='))?.slice(11) ?? 30);

interface Result {
  url: string;
  status: number;
  latencyMs: number;
  ok: boolean;
}

const results: Result[] = [];
let inFlight = 0;

// Endpoints to probe (no auth required = /health, auth-free variants)
const ENDPOINTS = [
  { method: 'GET',  path: '/health' },
  { method: 'GET',  path: '/health/detailed' },
];

async function probe(endpoint: typeof ENDPOINTS[0]): Promise<Result> {
  const start = Date.now();
  const url = `${BASE_URL}${endpoint.path}`;
  try {
    const res = await fetch(url, {
      method: endpoint.method,
      signal: AbortSignal.timeout(10_000),
    });
    return { url, status: res.status, latencyMs: Date.now() - start, ok: res.ok };
  } catch (err) {
    return { url, status: 0, latencyMs: Date.now() - start, ok: false };
  }
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.ceil((p / 100) * sorted.length) - 1]!;
}

function printReport(results: Result[], elapsed: number): void {
  const latencies = results.map(r => r.latencyMs);
  const errors = results.filter(r => !r.ok);
  const rps = results.length / elapsed;

  console.log('\n═══════════════════════════════════════════');
  console.log('  NEUROTEK AI — LOAD TEST RESULTS');
  console.log('═══════════════════════════════════════════');
  console.log(`  Duration:      ${elapsed.toFixed(1)}s`);
  console.log(`  Target RPS:    ${TARGET_RPS}`);
  console.log(`  Total Reqs:    ${results.length}`);
  console.log(`  Actual RPS:    ${rps.toFixed(1)}`);
  console.log(`  Errors:        ${errors.length} (${((errors.length / results.length) * 100).toFixed(1)}%)`);
  console.log('───────────────────────────────────────────');
  console.log(`  Latency P50:   ${percentile(latencies, 50)} ms`);
  console.log(`  Latency P95:   ${percentile(latencies, 95)} ms`);
  console.log(`  Latency P99:   ${percentile(latencies, 99)} ms`);
  console.log(`  Max:           ${Math.max(...latencies)} ms`);
  console.log(`  Min:           ${Math.min(...latencies)} ms`);

  if (errors.length > 0) {
    console.log('───────────────────────────────────────────');
    console.log('  Error samples:');
    errors.slice(0, 5).forEach(e => console.log(`    ${e.status} ${e.url} (${e.latencyMs}ms)`));
  }

  console.log('═══════════════════════════════════════════');

  // Exit non-zero if error rate > 1%
  if (errors.length / results.length > 0.01) {
    console.error('  FAIL: error rate exceeds 1%');
    process.exit(1);
  }
  // Exit non-zero if P95 > 2000ms
  if (percentile(latencies, 95) > 2000) {
    console.error('  FAIL: P95 latency exceeds 2000ms');
    process.exit(1);
  }
  console.log('  PASS');
}

async function run(): Promise<void> {
  console.log(`[Load Test] ${BASE_URL} — ${TARGET_RPS} RPS for ${DURATION_SEC}s`);

  const intervalMs = 1000 / TARGET_RPS;
  const endAt = Date.now() + DURATION_SEC * 1000;
  const startAt = Date.now();

  while (Date.now() < endAt) {
    const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)]!;
    inFlight++;
    probe(endpoint).then(r => {
      results.push(r);
      inFlight--;
    });
    await new Promise(r => setTimeout(r, intervalMs));
  }

  // Wait for in-flight requests
  while (inFlight > 0) {
    await new Promise(r => setTimeout(r, 100));
  }

  printReport(results, (Date.now() - startAt) / 1000);
}

run().catch(err => {
  console.error('Load test failed:', err);
  process.exit(1);
});
