import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    ?? 'admin@test.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'test-admin-pass-1234';
const ADMIN_KEY      = process.env.ADMIN_KEY      ?? '';

describe('Admin API', () => {
  let srv: TestServer;
  before(async () => { srv = await startTestServer(); });
  after(async () => { await srv.close(); });

  // ── Auth login ──────────────────────────────────────────────────

  test('POST /api/admin/auth/login with wrong creds → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nope@example.com', password: 'WrongPass!' }),
    });
    assert.equal(res.status, 401);
  });

  test('POST /api/admin/auth/login with correct env creds → 200 with token', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; data: { accessToken: string } };
    assert.equal(body.success, true);
    assert.ok(body.data.accessToken, 'expected accessToken in response');
  });

  // ── Stats ───────────────────────────────────────────────────────

  test('GET /api/admin/stats with x-admin-key → 200', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/stats`, {
      headers: { 'x-admin-key': ADMIN_KEY },
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean };
    assert.equal(body.success, true);
  });

  test('GET /api/admin/stats without x-admin-key → 403', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/stats`);
    assert.equal(res.status, 403);
  });

  // ── Users ───────────────────────────────────────────────────────

  test('GET /api/admin/users with x-admin-key → 200', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/users`, {
      headers: { 'x-admin-key': ADMIN_KEY },
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean };
    assert.equal(body.success, true);
  });

  // ── Monitoring ──────────────────────────────────────────────────

  test('GET /api/admin/monitoring with x-admin-key → 200', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/monitoring`, {
      headers: { 'x-admin-key': ADMIN_KEY },
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean };
    assert.equal(body.success, true);
  });

  // ── Marketplace ─────────────────────────────────────────────────

  test('GET /api/admin/marketplace with x-admin-key → 200', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/marketplace`, {
      headers: { 'x-admin-key': ADMIN_KEY },
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean };
    assert.equal(body.success, true);
  });

  // ── Settings ────────────────────────────────────────────────────

  test('GET /api/admin/settings with x-admin-key → 200', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/settings`, {
      headers: { 'x-admin-key': ADMIN_KEY },
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean };
    assert.equal(body.success, true);
  });
});
