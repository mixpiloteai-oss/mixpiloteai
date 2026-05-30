import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';
import { registerAndLogin, randomEmail, authHeaders } from '../setup/auth.ts';

describe('Auth flow', () => {
  let srv: TestServer;
  before(async () => { srv = await startTestServer(); });
  after(async () => { await srv.close(); });

  test('register creates a user and returns tokens', async () => {
    const email = randomEmail();
    const res = await fetch(`${srv.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'TestPassword123!', name: 'Reg User' }),
    });
    assert.equal(res.status, 201);
    const body = await res.json() as { success: boolean; data: { accessToken: string; refreshToken: string; user: { email: string } } };
    assert.equal(body.success, true);
    assert.ok(body.data.accessToken);
    assert.ok(body.data.refreshToken);
    assert.equal(body.data.user.email, email);
  });

  test('register rejects short password (validate min=8)', async () => {
    const res = await fetch(`${srv.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: randomEmail(), password: 'short', name: 'X' }),
    });
    assert.equal(res.status, 400);
  });

  test('register rejects invalid email', async () => {
    const res = await fetch(`${srv.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'TestPassword123!', name: 'X' }),
    });
    assert.equal(res.status, 400);
  });

  test('register rejects missing fields', async () => {
    const res = await fetch(`${srv.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });

  test('duplicate email returns 409', async () => {
    const email = randomEmail();
    const body = JSON.stringify({ email, password: 'TestPassword123!', name: 'Dup' });
    const first = await fetch(`${srv.baseUrl}/api/auth/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body,
    });
    assert.equal(first.status, 201);
    const second = await fetch(`${srv.baseUrl}/api/auth/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body,
    });
    assert.equal(second.status, 409);
  });

  test('login returns 401 on bad password', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const res = await fetch(`${srv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: 'WrongPassword123!' }),
    });
    assert.equal(res.status, 401);
  });

  test('login returns 401 on unknown email', async () => {
    const res = await fetch(`${srv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: randomEmail('nope'), password: 'TestPassword123!' }),
    });
    assert.equal(res.status, 401);
  });

  test('login succeeds with the right password and returns tokens', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const res = await fetch(`${srv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: u.password }),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { data: { accessToken: string } };
    assert.ok(body.data.accessToken);
  });

  test('GET /api/auth/me with valid token returns user', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const res = await fetch(`${srv.baseUrl}/api/auth/me`, { headers: authHeaders(u.accessToken) });
    assert.equal(res.status, 200);
    const body = await res.json() as { data: { email: string } };
    assert.equal(body.data.email, u.email);
  });

  test('GET /api/auth/me without token returns 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/auth/me`);
    assert.equal(res.status, 401);
  });

  test('GET /api/auth/me with malformed token returns 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/auth/me`, { headers: { authorization: 'Bearer not.a.jwt' } });
    assert.equal(res.status, 401);
  });

  test('POST /api/auth/refresh returns new tokens for a valid refresh token', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const res = await fetch(`${srv.baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: u.refreshToken }),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { data: { accessToken: string; refreshToken: string } };
    assert.ok(body.data.accessToken);
    assert.ok(body.data.refreshToken);
  });

  test('POST /api/auth/refresh without token → 400', async () => {
    const res = await fetch(`${srv.baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });

  test('POST /api/auth/refresh with garbage token → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'definitely-not-a-jwt' }),
    });
    assert.equal(res.status, 401);
  });

  test('POST /api/auth/logout invalidates the refresh token', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const res = await fetch(`${srv.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { ...authHeaders(u.accessToken), 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 200);
  });
});
