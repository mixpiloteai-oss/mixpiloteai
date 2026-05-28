import '../setup/env.ts';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { writeAuditLog, getRecentAuditLogs, filterAuditLogs } from '../../src/services/auditLog.ts';

describe('Audit log service', () => {
  test('writeAuditLog returns a stored entry with id and timestamp', () => {
    const entry = writeAuditLog({
      action: 'user.login',
      actorId: 'user-123',
      actorEmail: 'test@example.com',
      ip: '1.2.3.4',
      outcome: 'success',
    });
    assert.ok(entry.id.startsWith('aud-'));
    assert.ok(entry.timestamp.length > 0);
    assert.equal(entry.action, 'user.login');
    assert.equal(entry.outcome, 'success');
  });

  test('getRecentAuditLogs returns latest entries', () => {
    writeAuditLog({ action: 'admin.login', actorEmail: 'admin@neurotek.ai', outcome: 'success' });
    writeAuditLog({ action: 'payment.initiated', actorId: 'user-x', outcome: 'success' });

    const logs = getRecentAuditLogs(10);
    assert.ok(logs.length >= 2);
    // Most recent should be first
    assert.equal(logs[0]?.action, 'payment.initiated');
  });

  test('filterAuditLogs filters by actorId', () => {
    const uid = `filter-user-${Date.now()}`;
    writeAuditLog({ action: 'project.created', actorId: uid, outcome: 'success' });
    writeAuditLog({ action: 'project.deleted', actorId: 'other-user', outcome: 'success' });

    const filtered = filterAuditLogs({ actorId: uid });
    assert.ok(filtered.every(e => e.actorId === uid));
    assert.ok(filtered.length >= 1);
  });

  test('filterAuditLogs filters by action', () => {
    writeAuditLog({ action: 'upload.rejected', ip: '5.5.5.5', outcome: 'blocked', reason: 'MIME spoof' });

    const filtered = filterAuditLogs({ action: 'upload.rejected' });
    assert.ok(filtered.length >= 1);
    assert.ok(filtered.every(e => e.action === 'upload.rejected'));
  });

  test('filterAuditLogs filters by outcome', () => {
    writeAuditLog({ action: 'user.login', ip: '6.6.6.6', outcome: 'failure', reason: 'bad password' });

    const filtered = filterAuditLogs({ outcome: 'failure' });
    assert.ok(filtered.length >= 1);
    assert.ok(filtered.every(e => e.outcome === 'failure'));
  });

  test('filterAuditLogs with since parameter excludes old entries', () => {
    const now = new Date();
    writeAuditLog({ action: 'security.ip_blocked', ip: '7.7.7.7', outcome: 'blocked' });

    const filtered = filterAuditLogs({ since: now, action: 'security.ip_blocked' });
    assert.ok(filtered.every(e => new Date(e.timestamp) >= now));
  });

  test('audit entry includes meta fields when provided', () => {
    const entry = writeAuditLog({
      action: 'admin.user.ban',
      actorId: 'admin-1',
      targetId: 'user-bad',
      targetType: 'user',
      outcome: 'success',
      meta: { reason: 'spam', previousViolations: 3 },
    });
    assert.equal(entry.targetType, 'user');
    assert.equal(entry.meta?.reason, 'spam');
  });
});
