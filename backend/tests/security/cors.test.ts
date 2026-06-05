import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';

describe('CORS policy', () => {
  let srv: TestServer;
  before(async () => { srv = await startTestServer(); });
  after(async () => { await srv.close(); });

  test('evil origin is blocked — no ACAO header', async () => {
    const res = await fetch(`${srv.baseUrl}/health`, {
      headers: { origin: 'https://evil.attacker.com' },
    });
    const acao = res.headers.get('access-control-allow-origin');
    // Either CORS rejected the request (res not ok) or ACAO is absent / not the evil origin
    assert.ok(
      acao === null || acao !== 'https://evil.attacker.com',
      `should not echo back evil origin but got: ${acao}`
    );
  });

  test('allowed vercel origin gets ACAO header', async () => {
    const res = await fetch(`${srv.baseUrl}/health`, {
      headers: { origin: 'https://mixpiloteai.vercel.app' },
    });
    const acao = res.headers.get('access-control-allow-origin');
    assert.ok(
      acao === 'https://mixpiloteai.vercel.app' || acao === '*',
      `expected ACAO for vercel origin, got: ${acao}`
    );
  });

  test('localhost:5173 gets ACAO header', async () => {
    const res = await fetch(`${srv.baseUrl}/health`, {
      headers: { origin: 'http://localhost:5173' },
    });
    const acao = res.headers.get('access-control-allow-origin');
    assert.ok(
      acao === 'http://localhost:5173' || acao === '*',
      `expected ACAO for localhost:5173, got: ${acao}`
    );
  });

  test('no Origin header (server-to-server) returns 200 OK', async () => {
    const res = await fetch(`${srv.baseUrl}/health`);
    assert.equal(res.status, 200);
  });
});
