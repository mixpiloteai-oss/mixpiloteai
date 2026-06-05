import '../setup/env.ts';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  recordRequest,
  getUserAnomalyScore,
  getIpAnomalyScore,
  getAnomalyStats,
} from '../../src/services/anomalyDetection.ts';

describe('Anomaly detection', () => {
  test('new user starts with score 0', () => {
    const score = getUserAnomalyScore(`fresh-user-${Date.now()}`);
    assert.equal(score, 0);
  });

  test('new IP starts with score 0', () => {
    const score = getIpAnomalyScore(`9.9.9.${Math.floor(Math.random() * 255)}`);
    assert.equal(score, 0);
  });

  test('recordRequest returns numeric scores', () => {
    const result = recordRequest({
      userId: `test-user-${Date.now()}`,
      ip: '10.0.0.1',
      endpoint: '/api/projects',
      statusCode: 200,
    });
    assert.ok(typeof result.userAnomaly === 'number');
    assert.ok(typeof result.ipAnomaly === 'number');
    assert.ok(result.userAnomaly >= 0 && result.userAnomaly <= 100);
    assert.ok(result.ipAnomaly >= 0 && result.ipAnomaly <= 100);
  });

  test('high error rate increases anomaly score', () => {
    const userId = `error-user-${Date.now()}`;
    const ip = '10.0.1.1';
    // Simulate many 401 errors
    for (let i = 0; i < 20; i++) {
      recordRequest({ userId, ip, endpoint: '/api/auth/login', statusCode: 401 });
    }
    const score = getUserAnomalyScore(userId);
    assert.ok(score > 0, `Expected elevated anomaly score, got ${score}`);
  });

  test('IP with many distinct users gets higher score', () => {
    const ip = `10.99.99.${Math.floor(Math.random() * 200) + 10}`;
    // Simulate many different users from same IP (botnet pattern)
    for (let i = 0; i < 25; i++) {
      recordRequest({ userId: `bot-user-${i}-${Date.now()}`, ip, endpoint: '/api/ai', statusCode: 200 });
    }
    const score = getIpAnomalyScore(ip);
    assert.ok(score > 0, `Expected elevated IP anomaly score, got ${score}`);
  });

  test('normal usage keeps score low', () => {
    const userId = `normal-user-${Date.now()}`;
    const ip = '10.1.2.3';
    // Normal pattern: spread requests across different endpoints, success responses
    const endpoints = ['/api/projects', '/api/ai', '/api/save', '/api/auth/me'];
    for (let i = 0; i < 10; i++) {
      recordRequest({ userId, ip, endpoint: endpoints[i % endpoints.length]!, statusCode: 200 });
    }
    const score = getUserAnomalyScore(userId);
    assert.ok(score < 50, `Expected low anomaly score for normal usage, got ${score}`);
  });

  test('getAnomalyStats returns valid structure', () => {
    const stats = getAnomalyStats();
    assert.ok(typeof stats.trackedUsers === 'number');
    assert.ok(typeof stats.trackedIPs === 'number');
    assert.ok(Array.isArray(stats.highRiskUsers));
    assert.ok(Array.isArray(stats.highRiskIPs));
  });
});
