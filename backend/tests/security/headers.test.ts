import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';

describe('Security headers', () => {
  let srv: TestServer;
  before(async () => { srv = await startTestServer(); });
  after(async () => { await srv.close(); });

  test('GET /health returns X-Content-Type-Options: nosniff', async () => {
    const res = await fetch(`${srv.baseUrl}/health`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });

  test('GET /health returns X-Frame-Options: DENY', async () => {
    const res = await fetch(`${srv.baseUrl}/health`);
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
  });

  test('GET /health returns Referrer-Policy header', async () => {
    const res = await fetch(`${srv.baseUrl}/health`);
    const header = res.headers.get('referrer-policy');
    assert.ok(header && header.length > 0, `expected Referrer-Policy header, got: ${header}`);
  });

  test('GET /health returns Permissions-Policy header', async () => {
    const res = await fetch(`${srv.baseUrl}/health`);
    const header = res.headers.get('permissions-policy');
    assert.ok(header && header.length > 0, `expected Permissions-Policy header, got: ${header}`);
  });

  test('GET /health does NOT expose X-Powered-By header', async () => {
    const res = await fetch(`${srv.baseUrl}/health`);
    const header = res.headers.get('x-powered-by');
    assert.equal(header, null, `X-Powered-By should not be present, got: ${header}`);
  });
});
