import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';

describe('Rate limiting', () => {
  let srv: TestServer;
  before(async () => { srv = await startTestServer(); });
  after(async () => { await srv.close(); });

  test('general rate limiter triggers 429 after 300 requests to /health', async () => {
    // The generalRateLimiter allows 300 req per 15 min per IP.
    // We hit it 320 times; at least one must become 429.
    const statuses: number[] = [];
    for (let i = 0; i < 320; i++) {
      const res = await fetch(`${srv.baseUrl}/health`);
      statuses.push(res.status);
    }
    const got429 = statuses.some(s => s === 429);
    assert.ok(got429, `Expected at least one 429, got statuses: ${JSON.stringify([...new Set(statuses)])}`);
  });
});
