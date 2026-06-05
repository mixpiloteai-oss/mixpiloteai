import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';
import { registerAndLogin, authHeaders } from '../setup/auth.ts';
import { cloudSyncService } from '../../src/services/cloudSyncService.ts';

describe('Cloud Sync — Multi-user scenarios', () => {
  let srv: TestServer;

  before(async () => {
    srv = await startTestServer();
    cloudSyncService.clear();
  });

  after(async () => {
    cloudSyncService.clear();
    await srv.close();
  });

  test('User A pushes version 0 → succeeds (version 1)', async () => {
    const userA = await registerAndLogin(srv.baseUrl);
    const projectId = `multi-${Date.now()}`;

    const res = await fetch(`${srv.baseUrl}/api/cloud-sync/push/${projectId}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...authHeaders(userA.accessToken),
      },
      body: JSON.stringify({ data: { user: 'A', tracks: ['track1'] }, baseVersion: 0 }),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; data: { version: number } };
    assert.equal(body.success, true);
    assert.equal(body.data.version, 1);
  });

  test('User B pushes with baseVersion=0 after User A → 409 conflict', async () => {
    const userA = await registerAndLogin(srv.baseUrl);
    const userB = await registerAndLogin(srv.baseUrl);
    const projectId = `multi-conflict-${Date.now()}`;

    // User A pushes first
    await fetch(`${srv.baseUrl}/api/cloud-sync/push/${projectId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders(userA.accessToken) },
      body: JSON.stringify({ data: { user: 'A' }, baseVersion: 0 }),
    });

    // User B tries to push with stale baseVersion
    const res = await fetch(`${srv.baseUrl}/api/cloud-sync/push/${projectId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders(userB.accessToken) },
      body: JSON.stringify({ data: { user: 'B' }, baseVersion: 0 }),
    });
    assert.equal(res.status, 409);
    const body = await res.json() as {
      success: boolean;
      conflict: { type: string; localVersion: number; serverVersion: number; serverData: unknown };
    };
    assert.equal(body.success, false);
    assert.equal(body.conflict.type, 'version-mismatch');
    assert.equal(body.conflict.localVersion, 0);
    assert.equal(body.conflict.serverVersion, 1);
    // serverData should be User A's data
    assert.ok(body.conflict.serverData !== undefined);
  });

  test('User B uses forcePush → succeeds (version 2)', async () => {
    const userA = await registerAndLogin(srv.baseUrl);
    const userB = await registerAndLogin(srv.baseUrl);
    const projectId = `multi-force-${Date.now()}`;

    // User A pushes version 1
    await fetch(`${srv.baseUrl}/api/cloud-sync/push/${projectId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders(userA.accessToken) },
      body: JSON.stringify({ data: { user: 'A' }, baseVersion: 0 }),
    });

    // User B force pushes → should create version 2
    const res = await fetch(`${srv.baseUrl}/api/cloud-sync/push/${projectId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders(userB.accessToken) },
      body: JSON.stringify({ data: { user: 'B', merged: true }, baseVersion: 0, force: true }),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; data: { version: number } };
    assert.equal(body.success, true);
    assert.equal(body.data.version, 2);
  });

  test('Both users can GET pull the latest version', async () => {
    const userA = await registerAndLogin(srv.baseUrl);
    const userB = await registerAndLogin(srv.baseUrl);
    const projectId = `multi-pull-${Date.now()}`;

    // User A pushes
    await fetch(`${srv.baseUrl}/api/cloud-sync/push/${projectId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders(userA.accessToken) },
      body: JSON.stringify({ data: { shared: true }, baseVersion: 0 }),
    });

    // Both can pull
    const [resA, resB] = await Promise.all([
      fetch(`${srv.baseUrl}/api/cloud-sync/pull/${projectId}`, {
        headers: authHeaders(userA.accessToken),
      }),
      fetch(`${srv.baseUrl}/api/cloud-sync/pull/${projectId}`, {
        headers: authHeaders(userB.accessToken),
      }),
    ]);

    assert.equal(resA.status, 200);
    assert.equal(resB.status, 200);

    const bodyA = await resA.json() as { data: { version: number; data: unknown } };
    const bodyB = await resB.json() as { data: { version: number; data: unknown } };
    assert.equal(bodyA.data.version, 1);
    assert.equal(bodyB.data.version, 1);
    assert.deepEqual(bodyA.data.data, bodyB.data.data);
  });
});
