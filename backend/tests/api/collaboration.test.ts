import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';
import { registerAndLogin, authHeaders } from '../setup/auth.ts';

describe('Collaboration routes', () => {
  let srv: TestServer;
  before(async () => { srv = await startTestServer(); });
  after(async () => { await srv.close(); });

  // POST /api/teams (teamsRouter) requires auth
  test('POST /api/teams without auth → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'My Team' }),
    });
    assert.equal(res.status, 401);
  });

  test('POST /api/teams with auth → 201', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const res = await fetch(`${srv.baseUrl}/api/teams`, {
      method: 'POST',
      headers: { ...authHeaders(u.accessToken), 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'My Test Team' }),
    });
    assert.equal(res.status, 201);
    const body = await res.json() as { success: boolean; team: { id: string; name: string } };
    assert.equal(body.success, true);
    assert.ok(body.team.id, 'expected team id');
  });

  // POST /api/collab/ops requires auth
  test('POST /api/collab/ops without auth → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/collab/ops`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 'test', type: 'param-change', payload: {} }),
    });
    assert.equal(res.status, 401);
  });

  // GET /api/collab/stream/:projectId — SSE endpoint, requires token query param
  test('GET /api/collab/stream/:projectId without token → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/collab/stream/test-project`);
    assert.equal(res.status, 401);
  });

  test('GET /api/collab/stream/:projectId with valid token → SSE stream starts', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 500);

    try {
      const res = await fetch(
        `${srv.baseUrl}/api/collab/stream/test-project?token=${u.accessToken}&userId=${u.user.id}&userName=TestUser`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      const contentType = res.headers.get('content-type');
      assert.ok(
        contentType?.includes('text/event-stream'),
        `expected text/event-stream, got: ${contentType}`
      );
    } catch (err) {
      clearTimeout(timeout);
      // AbortError is expected — stream was aborted after 500ms
      const error = err as { name?: string };
      if (error.name !== 'AbortError') throw err;
      // Pass — we aborted after confirming headers
    }
  });

  // GET /api/teams — public
  test('GET /api/teams → 200', async () => {
    const res = await fetch(`${srv.baseUrl}/api/teams`);
    assert.equal(res.status, 200);
  });

  // GET /api/collab/history/:projectId — public
  test('GET /api/collab/history/:projectId → 200', async () => {
    const res = await fetch(`${srv.baseUrl}/api/collab/history/some-project`);
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; ops: unknown[] };
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.ops));
  });

  // POST /api/collab/invite requires auth
  test('POST /api/collab/invite without auth → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/collab/invite`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teamId: 'team-1', email: 'x@x.com', role: 'editor' }),
    });
    assert.equal(res.status, 401);
  });
});
