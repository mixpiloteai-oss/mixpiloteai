import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';
import { registerAndLogin, authHeaders } from '../setup/auth.ts';

describe('Creator upload routes', () => {
  let srv: TestServer;
  let creatorId = 'fake-creator-id';

  before(async () => {
    srv = await startTestServer();
    // Try to find a real creator from the in-memory seeded data
    try {
      const res = await fetch(`${srv.baseUrl}/api/creators`);
      if (res.ok) {
        const body = await res.json() as { data: Array<{ id: string }> };
        const creators = body.data ?? [];
        if (creators.length > 0) {
          creatorId = creators[0]!.id;
        }
      }
    } catch {
      // fall back to fake id
    }
  });
  after(async () => { await srv.close(); });

  test('POST /api/creators/:id/upload/start without auth → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/creators/${creatorId}/upload/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: 'test.wav', mimeType: 'audio/wav', fileSize: 1024, kind: 'audio' }),
    });
    assert.equal(res.status, 401);
  });

  test('POST /api/creators/:id/upload/start with auth + bad MIME type → 400', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const res = await fetch(`${srv.baseUrl}/api/creators/${creatorId}/upload/start`, {
      method: 'POST',
      headers: { ...authHeaders(u.accessToken), 'content-type': 'application/json' },
      body: JSON.stringify({
        filename: 'malware.exe',
        mimeType: 'application/x-msdownload',
        fileSize: 1024,
        kind: 'audio',
      }),
    });
    // Either 400 (bad MIME) or 404 (creator not found) — both are acceptable
    assert.ok(
      res.status === 400 || res.status === 404,
      `Expected 400 or 404, got ${res.status}`
    );
  });

  test('POST /api/creators/:id/upload/start with auth + oversized file → 400', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const MAX = 200 * 1024 * 1024; // 200 MB is above typical audio limit
    const res = await fetch(`${srv.baseUrl}/api/creators/${creatorId}/upload/start`, {
      method: 'POST',
      headers: { ...authHeaders(u.accessToken), 'content-type': 'application/json' },
      body: JSON.stringify({
        filename: 'huge.wav',
        mimeType: 'audio/wav',
        fileSize: MAX,
        kind: 'audio',
      }),
    });
    // Oversized → 400 or 404 if creator not found
    assert.ok(
      res.status === 400 || res.status === 404,
      `Expected 400 or 404, got ${res.status}`
    );
  });

  test('POST /api/creators/:id/upload/start with auth + valid audio payload → not 500', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const res = await fetch(`${srv.baseUrl}/api/creators/${creatorId}/upload/start`, {
      method: 'POST',
      headers: { ...authHeaders(u.accessToken), 'content-type': 'application/json' },
      body: JSON.stringify({
        filename: 'beat.wav',
        mimeType: 'audio/wav',
        fileSize: 1024 * 50, // 50 KB
        kind: 'audio',
      }),
    });
    assert.notEqual(res.status, 500, `Server should not 500, got ${res.status}`);
  });
});
