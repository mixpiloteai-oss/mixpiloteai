import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';
import { registerAndLogin, authHeaders } from '../setup/auth.ts';
import { cloudSyncService } from '../../src/services/cloudSyncService.ts';

describe('Cloud Sync API', () => {
  let srv: TestServer;

  before(async () => {
    srv = await startTestServer();
    cloudSyncService.clear();
  });

  after(async () => {
    cloudSyncService.clear();
    await srv.close();
  });

  test('POST /api/cloud-sync/push/:projectId without auth → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/cloud-sync/push/test-project`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: {}, baseVersion: 0 }),
    });
    assert.equal(res.status, 401);
  });

  test('POST /api/cloud-sync/push/:projectId with auth and baseVersion=0 → 200 with version', async () => {
    const user = await registerAndLogin(srv.baseUrl);
    const projectId = `proj-${Date.now()}`;

    const res = await fetch(`${srv.baseUrl}/api/cloud-sync/push/${projectId}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...authHeaders(user.accessToken),
      },
      body: JSON.stringify({ data: { tracks: [] }, baseVersion: 0, label: 'Initial' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; data: { projectId: string; version: number; checksum: string } };
    assert.equal(body.success, true);
    assert.equal(body.data.projectId, projectId);
    assert.equal(body.data.version, 1);
    assert.ok(body.data.checksum);
  });

  test('GET /api/cloud-sync/pull/:projectId returns latest pushed version', async () => {
    const user = await registerAndLogin(srv.baseUrl);
    const projectId = `proj-pull-${Date.now()}`;

    // Push first
    await fetch(`${srv.baseUrl}/api/cloud-sync/push/${projectId}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...authHeaders(user.accessToken),
      },
      body: JSON.stringify({ data: { name: 'my project' }, baseVersion: 0 }),
    });

    // Pull
    const res = await fetch(`${srv.baseUrl}/api/cloud-sync/pull/${projectId}`, {
      headers: authHeaders(user.accessToken),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; data: { version: number; data: unknown } };
    assert.equal(body.success, true);
    assert.equal(body.data.version, 1);
  });

  test('Second push with wrong baseVersion → 409 conflict', async () => {
    const user = await registerAndLogin(srv.baseUrl);
    const projectId = `proj-conflict-${Date.now()}`;

    // Push version 1
    await fetch(`${srv.baseUrl}/api/cloud-sync/push/${projectId}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...authHeaders(user.accessToken),
      },
      body: JSON.stringify({ data: { v: 1 }, baseVersion: 0 }),
    });

    // Try to push with wrong baseVersion (0 again instead of 1)
    const res = await fetch(`${srv.baseUrl}/api/cloud-sync/push/${projectId}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...authHeaders(user.accessToken),
      },
      body: JSON.stringify({ data: { v: 2 }, baseVersion: 0 }),
    });
    assert.equal(res.status, 409);
    const body = await res.json() as { success: boolean; conflict: { type: string; localVersion: number; serverVersion: number } };
    assert.equal(body.success, false);
    assert.equal(body.conflict.type, 'version-mismatch');
    assert.equal(body.conflict.localVersion, 0);
    assert.equal(body.conflict.serverVersion, 1);
  });

  test('Force push with force=true always succeeds', async () => {
    const user = await registerAndLogin(srv.baseUrl);
    const projectId = `proj-force-${Date.now()}`;

    // Push initial
    await fetch(`${srv.baseUrl}/api/cloud-sync/push/${projectId}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...authHeaders(user.accessToken),
      },
      body: JSON.stringify({ data: { v: 1 }, baseVersion: 0 }),
    });

    // Force push with wrong baseVersion — should still succeed
    const res = await fetch(`${srv.baseUrl}/api/cloud-sync/push/${projectId}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...authHeaders(user.accessToken),
      },
      body: JSON.stringify({ data: { v: 2 }, baseVersion: 0, force: true }),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; data: { version: number } };
    assert.equal(body.success, true);
    assert.equal(body.data.version, 2);
  });

  test('GET /api/cloud-sync/versions/:projectId lists all versions', async () => {
    const user = await registerAndLogin(srv.baseUrl);
    const projectId = `proj-list-${Date.now()}`;

    // Push 3 versions
    await fetch(`${srv.baseUrl}/api/cloud-sync/push/${projectId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders(user.accessToken) },
      body: JSON.stringify({ data: { v: 1 }, baseVersion: 0 }),
    });
    await fetch(`${srv.baseUrl}/api/cloud-sync/push/${projectId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders(user.accessToken) },
      body: JSON.stringify({ data: { v: 2 }, baseVersion: 1 }),
    });
    await fetch(`${srv.baseUrl}/api/cloud-sync/push/${projectId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders(user.accessToken) },
      body: JSON.stringify({ data: { v: 3 }, baseVersion: 2 }),
    });

    const res = await fetch(`${srv.baseUrl}/api/cloud-sync/versions/${projectId}`, {
      headers: authHeaders(user.accessToken),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; data: Array<{ version: number }> };
    assert.equal(body.success, true);
    assert.equal(body.data.length, 3);
    assert.deepEqual(body.data.map((v) => v.version), [1, 2, 3]);
  });
});
