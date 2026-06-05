import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';
import { registerAndLogin, authHeaders } from '../setup/auth.ts';

describe('Route permissions', () => {
  let srv: TestServer;
  before(async () => { srv = await startTestServer(); });
  after(async () => { await srv.close(); });

  test('GET /api/projects is public (read-only listing)', async () => {
    const res = await fetch(`${srv.baseUrl}/api/projects`);
    assert.equal(res.status, 200);
  });

  test('POST /api/projects without token → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'My Project' }),
    });
    assert.equal(res.status, 401);
  });

  test('POST /api/projects with malformed token → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer xxx.yyy.zzz' },
      body: JSON.stringify({ name: 'My Project' }),
    });
    assert.equal(res.status, 401);
  });

  test('POST /api/projects with valid token → 2xx', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const res = await fetch(`${srv.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { ...authHeaders(u.accessToken), 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Real Project', bpm: 128 }),
    });
    assert.ok(res.status >= 200 && res.status < 300, `expected 2xx, got ${res.status}`);
  });

  test('DELETE /api/projects/:id without token → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/projects/some-id`, { method: 'DELETE' });
    assert.equal(res.status, 401);
  });

  test('PATCH /api/projects/:id without token → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/projects/some-id`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    assert.equal(res.status, 401);
  });

  test('POST /api/projects/:id/star without token → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/projects/abc/star`, { method: 'POST' });
    assert.equal(res.status, 401);
  });
});
