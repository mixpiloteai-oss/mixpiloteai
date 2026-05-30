import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';
import { registerAndLogin, authHeaders } from '../setup/auth.ts';

describe('Plugins API', () => {
  let srv: TestServer;
  before(async () => { srv = await startTestServer(); });
  after(async () => { await srv.close(); });

  // ── crash-report ─────────────────────────────────────────────

  test('POST /api/plugins/crash-report without auth → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/plugins/crash-report`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pluginName: 'TestPlugin', message: 'Error occurred' }),
    });
    assert.equal(res.status, 401);
  });

  test('POST /api/plugins/crash-report with auth + missing pluginName → 400', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const res = await fetch(`${srv.baseUrl}/api/plugins/crash-report`, {
      method: 'POST',
      headers: { ...authHeaders(u.accessToken), 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Something went wrong' }), // no pluginName
    });
    assert.equal(res.status, 400);
  });

  test('POST /api/plugins/crash-report with auth + valid body → 2xx', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const res = await fetch(`${srv.baseUrl}/api/plugins/crash-report`, {
      method: 'POST',
      headers: { ...authHeaders(u.accessToken), 'content-type': 'application/json' },
      body: JSON.stringify({
        pluginName: 'TestPlugin',
        message: 'TypeError: Cannot read properties of undefined',
        stack: 'Error: ...\n    at Object.<anonymous>',
        appVersion: '1.2.3',
        platform: 'win32',
      }),
    });
    assert.ok(res.status >= 200 && res.status < 300, `Expected 2xx, got ${res.status}`);
  });

  // ── blacklist ─────────────────────────────────────────────────

  test('GET /api/plugins/blacklist with auth → 2xx with array result', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const res = await fetch(`${srv.baseUrl}/api/plugins/blacklist`, {
      headers: authHeaders(u.accessToken),
    });
    assert.ok(res.status >= 200 && res.status < 300, `Expected 2xx, got ${res.status}`);
    const body = await res.json() as { success: boolean; data: unknown[] };
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data), `Expected data to be array, got ${typeof body.data}`);
  });

  test('GET /api/plugins/blacklist without auth → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/plugins/blacklist`);
    assert.equal(res.status, 401);
  });
});
