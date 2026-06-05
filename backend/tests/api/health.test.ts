import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';

describe('GET /health', () => {
  let srv: TestServer;
  before(async () => { srv = await startTestServer(); });
  after(async () => { await srv.close(); });

  test('returns 200', async () => {
    const res = await fetch(`${srv.baseUrl}/health`);
    assert.equal(res.status, 200);
  });

  test('body is { ok: true }', async () => {
    const res = await fetch(`${srv.baseUrl}/health`);
    const body = await res.json() as { ok: boolean };
    assert.equal(body.ok, true);
  });

  test('content-type is JSON', async () => {
    const res = await fetch(`${srv.baseUrl}/health`);
    assert.match(res.headers.get('content-type') ?? '', /application\/json/);
  });

  test('survives many sequential probes', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${srv.baseUrl}/health`);
      assert.equal(res.status, 200);
    }
  });
});
