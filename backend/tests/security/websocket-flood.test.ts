import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';
import { registerAndLogin } from '../setup/auth.ts';

describe('WebSocket/SSE flood protection', () => {
  let srv: TestServer;
  before(async () => { srv = await startTestServer(); });
  after(async () => { await srv.close(); });

  test('POST /api/collab/ops rejects >120 ops/min per user', async () => {
    // Use pre-seeded studio plan user so the plan gate passes and we can hit the rate limiter
    const loginRes = await fetch(`${srv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'studio@neurotek.ai', password: 'demo1234' }),
    });
    assert.ok(loginRes.ok, `studio login failed: ${loginRes.status}`);
    const loginBody = await loginRes.json() as { data?: { accessToken: string; user: { id: string } } };
    const accessToken = loginBody.data?.accessToken;
    assert.ok(accessToken, 'expected accessToken from studio login');

    // Create a project so collab ops don't 403 on the project-access check
    const projRes = await fetch(`${srv.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ name: 'Flood Test Project' }),
    });
    assert.ok(projRes.ok, `create project failed: ${projRes.status}`);
    const projBody = await projRes.json() as { data?: { id: string } };
    const projectId = projBody.data?.id;
    assert.ok(projectId, 'expected project id');

    const statuses: number[] = [];
    // Send 140 ops rapidly — rate limit is 120/min
    for (let i = 0; i < 140; i++) {
      const res = await fetch(`${srv.baseUrl}/api/collab/ops`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ projectId, type: 'param-change', payload: { v: i } }),
      });
      statuses.push(res.status);
    }
    const got429 = statuses.some(s => s === 429);
    assert.ok(got429, `Expected at least one 429 from collab ops flood, got: ${JSON.stringify([...new Set(statuses)])}`);
  });

  test('POST /api/collab/ops batch with missing fields → 400', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const res = await fetch(`${srv.baseUrl}/api/collab/ops`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${u.accessToken}` },
      body: JSON.stringify({ projectId: 'test' /* missing type */ }),
    });
    assert.equal(res.status, 400);
  });

  test('GET /api/collab/history returns empty array for unknown project', async () => {
    const res = await fetch(`${srv.baseUrl}/api/collab/history/non-existent-project-xyz`);
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; ops: unknown[] };
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.ops));
  });

  test('POST /api/collab/invite with invalid role → 400', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const res = await fetch(`${srv.baseUrl}/api/collab/invite`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${u.accessToken}` },
      body: JSON.stringify({ teamId: 'team-1', email: 'x@x.com', role: 'SUPERUSER_EVIL' }),
    });
    assert.equal(res.status, 400);
  });
});
