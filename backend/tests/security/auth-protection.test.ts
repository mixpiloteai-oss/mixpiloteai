import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';
import { registerAndLogin, authHeaders } from '../setup/auth.ts';
import jwt from 'jsonwebtoken';

describe('Auth middleware protection', () => {
  let srv: TestServer;
  before(async () => { srv = await startTestServer(); });
  after(async () => { await srv.close(); });

  test('protected route without token → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/auth/me`);
    assert.equal(res.status, 401);
  });

  test('protected route with tampered JWT → 401', async () => {
    // Tamper: valid header.payload but wrong signature
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZha2UiLCJlbWFpbCI6ImZha2VAZXhhbXBsZS5jb20ifQ.invalid-sig';
    const res = await fetch(`${srv.baseUrl}/api/auth/me`, {
      headers: { authorization: `Bearer ${fakeToken}` },
    });
    assert.equal(res.status, 401);
  });

  test('protected route with valid JWT → 200', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const res = await fetch(`${srv.baseUrl}/api/auth/me`, {
      headers: authHeaders(u.accessToken),
    });
    assert.equal(res.status, 200);
  });

  test('admin route without credentials → 403', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/stats`);
    assert.equal(res.status, 403);
  });

  test('admin route with user JWT (non-admin email) → 403', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const res = await fetch(`${srv.baseUrl}/api/admin/stats`, {
      headers: authHeaders(u.accessToken),
    });
    assert.equal(res.status, 403);
  });

  test('admin route with wrong x-admin-key → 403', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/stats`, {
      headers: { 'x-admin-key': 'definitely-wrong-key' },
    });
    assert.equal(res.status, 403);
  });

  test('admin route with correct x-admin-key → 200', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/stats`, {
      headers: { 'x-admin-key': process.env.ADMIN_KEY ?? '' },
    });
    assert.equal(res.status, 200);
  });
});
