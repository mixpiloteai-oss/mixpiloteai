import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';
import { registerAndLogin, authHeaders } from '../setup/auth.ts';
import jwt from 'jsonwebtoken';

describe('JWT security — replay and escalation', () => {
  let srv: TestServer;
  before(async () => { srv = await startTestServer(); });
  after(async () => { await srv.close(); });

  test('expired JWT → 401', async () => {
    const secret = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
    const expiredToken = jwt.sign(
      { id: 'fake-user', email: 'expired@test.com', plan: 'free', name: 'Expired' },
      secret,
      { expiresIn: -1 }
    );
    const res = await fetch(`${srv.baseUrl}/api/auth/me`, {
      headers: { authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(res.status, 401);
  });

  test('JWT signed with wrong secret → 401', async () => {
    const maliciousToken = jwt.sign(
      { id: 'attacker', email: 'attacker@evil.com', plan: 'studio', name: 'Attacker' },
      'wrong-secret-that-attacker-generated'
    );
    const res = await fetch(`${srv.baseUrl}/api/auth/me`, {
      headers: { authorization: `Bearer ${maliciousToken}` },
    });
    assert.equal(res.status, 401);
  });

  test('JWT with none algorithm → 401 (algorithm confusion attack)', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      id: 'attacker', email: 'admin@neurotek.ai', plan: 'studio', name: 'Evil',
      iat: Math.floor(Date.now() / 1000),
    })).toString('base64url');
    const noneToken = `${header}.${payload}.`;

    const res = await fetch(`${srv.baseUrl}/api/auth/me`, {
      headers: { authorization: `Bearer ${noneToken}` },
    });
    assert.equal(res.status, 401);
  });

  test('JWT with manipulated payload (plan escalation) → 401', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const [h, p] = u.accessToken.split('.');
    const origPayload = JSON.parse(Buffer.from(p!, 'base64url').toString());
    origPayload.plan = 'studio';
    const tamperedPayload = Buffer.from(JSON.stringify(origPayload)).toString('base64url');
    const tamperedToken = `${h}.${tamperedPayload}.invalid-signature`;

    const res = await fetch(`${srv.baseUrl}/api/auth/me`, {
      headers: { authorization: `Bearer ${tamperedToken}` },
    });
    assert.equal(res.status, 401);
  });

  // ── Admin escalation tests ─────────────────────────────────────────────────

  test('regular user cannot access admin routes', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const adminRoutes = ['/api/admin/stats', '/api/admin/users', '/api/admin/coupons'];
    for (const route of adminRoutes) {
      const res = await fetch(`${srv.baseUrl}${route}`, {
        headers: authHeaders(u.accessToken),
      });
      assert.ok(
        res.status === 401 || res.status === 403,
        `${route}: expected 401/403, got ${res.status}`
      );
    }
  });

  test('wrong admin key → 403', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/stats`, {
      headers: { 'x-admin-key': 'not-the-right-key' },
    });
    assert.equal(res.status, 403);
  });

  test('correct admin key → 200', async () => {
    const adminKey = process.env.ADMIN_KEY ?? '';
    if (!adminKey) return;
    const res = await fetch(`${srv.baseUrl}/api/admin/stats`, {
      headers: { 'x-admin-key': adminKey },
    });
    assert.equal(res.status, 200);
  });

  test('JWT with admin email but signed with wrong secret → 403', async () => {
    const adminToken = jwt.sign(
      { id: 'fake-admin', email: 'tifenn.cruchon@gmail.com', plan: 'studio' },
      'attacker-knows-email-but-not-secret'
    );
    const res = await fetch(`${srv.baseUrl}/api/admin/stats`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.ok(res.status === 401 || res.status === 403,
      `Expected 401/403 for fake admin JWT, got ${res.status}`);
  });

  // ── Concurrent session tests ───────────────────────────────────────────────

  test('multiple concurrent requests with same valid token → all succeed', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const promises = Array.from({ length: 10 }, () =>
      fetch(`${srv.baseUrl}/api/auth/me`, { headers: authHeaders(u.accessToken) })
    );
    const results = await Promise.all(promises);
    const statuses = results.map(r => r.status);
    assert.ok(
      statuses.every(s => s === 200),
      `Expected all 200, got: ${JSON.stringify(statuses)}`
    );
  });

  test('malformed Authorization header → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/auth/me`, {
      headers: { authorization: 'NotBearer token' },
    });
    assert.equal(res.status, 401);
  });
});
