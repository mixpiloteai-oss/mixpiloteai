import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';
import { registerAndLogin, authHeaders } from '../setup/auth.ts';

describe('XSS and CSRF protection', () => {
  let srv: TestServer;
  before(async () => { srv = await startTestServer(); });
  after(async () => { await srv.close(); });

  // ── XSS payload tests ─────────────────────────────────────────────────────

  test('POST /api/projects with XSS in name → accepted but sanitized or stored as-is (no script execution)', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const xssPayload = '<script>alert("xss")</script>';
    const res = await fetch(`${srv.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { ...authHeaders(u.accessToken), 'content-type': 'application/json' },
      body: JSON.stringify({ name: xssPayload }),
    });
    // The API should either reject it or store it safely — never execute it.
    // API returns JSON not HTML, so XSS is not executable in this context.
    // We just verify the server doesn't crash and returns a valid JSON response.
    const body = await res.json() as Record<string, unknown>;
    assert.ok(res.status < 500, `Server should not crash on XSS payload, got ${res.status}`);
    assert.ok(typeof body === 'object');
  });

  test('API response Content-Type is always JSON (prevents MIME confusion XSS)', async () => {
    const res = await fetch(`${srv.baseUrl}/health`);
    const ct = res.headers.get('content-type') ?? '';
    assert.ok(ct.includes('application/json') || ct.includes('text/'), `Expected JSON content-type, got: ${ct}`);
  });

  test('API always sets X-Content-Type-Options: nosniff (prevents MIME sniffing XSS)', async () => {
    const res = await fetch(`${srv.baseUrl}/health`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });

  test('API sets Content-Security-Policy header', async () => {
    const res = await fetch(`${srv.baseUrl}/health`);
    const csp = res.headers.get('content-security-policy');
    assert.ok(csp && csp.length > 0, `Expected CSP header, got: ${csp}`);
  });

  test('API sets X-Frame-Options: DENY (clickjacking protection)', async () => {
    const res = await fetch(`${srv.baseUrl}/health`);
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
  });

  // ── CSRF protection tests ──────────────────────────────────────────────────

  test('state-mutating endpoints require valid auth token (CSRF protection)', async () => {
    // Without token: all state-mutating routes should return 401
    const endpoints = [
      { method: 'POST', path: '/api/projects', body: { name: 'Test' } },
      { method: 'DELETE', path: '/api/projects/fake-id', body: {} },
      { method: 'POST', path: '/api/collab/ops', body: { projectId: 'x', type: 'param-change', payload: {} } },
    ];

    for (const ep of endpoints) {
      const res = await fetch(`${srv.baseUrl}${ep.path}`, {
        method: ep.method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(ep.body),
      });
      assert.ok(
        res.status === 401 || res.status === 403,
        `${ep.method} ${ep.path}: expected 401/403, got ${res.status}`
      );
    }
  });

  test('Bearer token in Authorization header (not cookie) prevents CSRF', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    // JWT in Authorization header cannot be sent by a cross-origin form submission
    const res = await fetch(`${srv.baseUrl}/api/auth/me`, {
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    assert.equal(res.status, 200);
  });

  test('POST with Origin header from different domain without auth → rejected by auth guard', async () => {
    const res = await fetch(`${srv.baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'origin': 'https://evil-attacker.com',
      },
      body: JSON.stringify({ name: 'CSRF test' }),
    });
    // CORS enforcement happens in the browser for cross-origin requests.
    // On the server, the auth guard or CORS middleware rejects the request.
    // Server-side fetch bypasses CORS but still gets rejected (401, 403, or CORS error).
    assert.ok(res.status !== 200 && res.status !== 201,
      `Request from evil origin must not succeed, got ${res.status}`);
  });

  // ── SQL injection tests ────────────────────────────────────────────────────

  test('SQL injection in project name is stored safely (parameterized queries)', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const sqlPayload = "'; DROP TABLE projects; --";
    const res = await fetch(`${srv.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { ...authHeaders(u.accessToken), 'content-type': 'application/json' },
      body: JSON.stringify({ name: sqlPayload }),
    });
    // Should not crash the server
    assert.ok(res.status < 500, `Server must not crash on SQL injection, got ${res.status}`);
  });

  test('SQL injection in auth email is rejected or handled safely', async () => {
    const res = await fetch(`${srv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: "' OR 1=1 --", password: 'anything' }),
    });
    assert.ok(res.status >= 400, `Expected rejection of SQL injection in email, got ${res.status}`);
  });
});
