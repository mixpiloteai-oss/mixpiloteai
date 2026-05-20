import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';
import { randomEmail } from '../setup/auth.ts';

describe('Suspicious activity detection', () => {
  let srv: TestServer;
  before(async () => { srv = await startTestServer(); });
  after(async () => { await srv.close(); });

  test('repeated failed logins → eventually get 429', async () => {
    // suspiciousActivity blocks after 20 auth failures from same IP
    // authRateLimiter also triggers at 20. Either triggers 429.
    const statuses: number[] = [];
    for (let i = 0; i < 25; i++) {
      const email = randomEmail('brute');
      const res = await fetch(`${srv.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'WrongPassword!' }),
      });
      statuses.push(res.status);
    }
    const got429 = statuses.some(s => s === 429);
    assert.ok(
      got429,
      `Expected 429 after 25 failed logins, statuses: ${JSON.stringify(statuses)}`
    );
  });
});
