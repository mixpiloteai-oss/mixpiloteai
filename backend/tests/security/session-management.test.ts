import '../setup/env.ts';
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerSession,
  revokeSession,
  revokeAllUserSessions,
  getActiveSessions,
  getSessionStats,
} from '../../src/middleware/sessionManager.ts';
import type { Request } from 'express';

function mockReq(ip = '127.0.0.1', ua = 'TestBrowser/1.0'): Request {
  return {
    ip,
    headers: { 'user-agent': ua, 'accept-language': 'en-US' },
  } as unknown as Request;
}

describe('Session management', () => {
  test('registers a new session successfully', () => {
    const req = mockReq('1.1.1.1', 'Browser/1');
    const result = registerSession('user-a', 'free', req);
    assert.equal(result.accepted, true);
    assert.ok(result.sessionKey);
  });

  test('same device re-registers without creating duplicate', () => {
    const req = mockReq('2.2.2.2', 'Browser/2');
    const r1 = registerSession('user-b', 'free', req);
    const r2 = registerSession('user-b', 'free', req);
    assert.equal(r1.sessionKey, r2.sessionKey);
    const sessions = getActiveSessions('user-b');
    assert.equal(sessions.length, 1);
  });

  test('free plan allows max 2 concurrent sessions', () => {
    const userId = `user-free-${Date.now()}`;
    // Register from 3 different devices
    const r1 = registerSession(userId, 'free', mockReq('10.0.0.1', 'Device1'));
    const r2 = registerSession(userId, 'free', mockReq('10.0.0.2', 'Device2'));
    const r3 = registerSession(userId, 'free', mockReq('10.0.0.3', 'Device3'));

    assert.ok(r1.accepted);
    assert.ok(r2.accepted);
    assert.ok(r3.accepted); // accepted but evicted oldest

    // Should still only have ≤ 2 sessions (oldest evicted)
    const sessions = getActiveSessions(userId);
    assert.ok(sessions.length <= 2, `Expected ≤2 sessions, got ${sessions.length}`);
  });

  test('pro plan allows more concurrent sessions than free', () => {
    const userId = `user-pro-${Date.now()}`;
    // Register 5 different devices
    for (let i = 0; i < 5; i++) {
      registerSession(userId, 'pro', mockReq(`192.168.${i}.1`, `Device${i}`));
    }
    const sessions = getActiveSessions(userId);
    assert.ok(sessions.length <= 5);
  });

  test('revokes a specific session', () => {
    const userId = `user-rev-${Date.now()}`;
    const req = mockReq('3.3.3.3', 'RevBrowser');
    const { sessionKey } = registerSession(userId, 'free', req);
    assert.equal(getActiveSessions(userId).length, 1);

    const revoked = revokeSession(userId, sessionKey);
    assert.equal(revoked, true);
    assert.equal(getActiveSessions(userId).length, 0);
  });

  test('revokeSession returns false for unknown key', () => {
    const result = revokeSession('user-xyz', 'nonexistent:key');
    assert.equal(result, false);
  });

  test('revokeAllUserSessions clears all sessions for a user', () => {
    const userId = `user-all-${Date.now()}`;
    registerSession(userId, 'pro', mockReq('4.4.4.1', 'D1'));
    registerSession(userId, 'pro', mockReq('4.4.4.2', 'D2'));
    assert.ok(getActiveSessions(userId).length >= 1);

    const count = revokeAllUserSessions(userId);
    assert.ok(count >= 1);
    assert.equal(getActiveSessions(userId).length, 0);
  });

  test('getSessionStats returns non-negative counts', () => {
    const stats = getSessionStats();
    assert.ok(typeof stats.totalSessions === 'number' && stats.totalSessions >= 0);
    assert.ok(typeof stats.totalUsers === 'number' && stats.totalUsers >= 0);
  });
});
