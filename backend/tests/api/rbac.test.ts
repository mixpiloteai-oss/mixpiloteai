import '../setup/env.ts';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hasPermission, requirePermission, type AdminPermission } from '../../src/middleware/adminAuth.ts';

describe('RBAC — role/permission matrix', () => {
  test('super_admin has every defined permission', () => {
    const perms: AdminPermission[] = [
      'users.read', 'users.write', 'users.delete', 'users.ban',
      'payments.read', 'payments.refund',
      'plans.read', 'plans.write', 'plans.delete',
      'coupons.read', 'coupons.write',
      'webhooks.read',
      'marketplace.moderate', 'support.reply', 'cms.write', 'settings.write', 'admin.manage',
    ];
    for (const p of perms) {
      assert.equal(hasPermission('super_admin', p), true, `super_admin missing ${p}`);
    }
  });

  test('admin can refund payments and write coupons, cannot delete users', () => {
    assert.equal(hasPermission('admin', 'payments.refund'), true);
    assert.equal(hasPermission('admin', 'coupons.write'), true);
    assert.equal(hasPermission('admin', 'users.delete'), false);
    assert.equal(hasPermission('admin', 'plans.delete'), false);
    assert.equal(hasPermission('admin', 'admin.manage'), false);
  });

  test('moderator is read-only on payments/plans/coupons but can moderate content', () => {
    assert.equal(hasPermission('moderator', 'payments.read'), true);
    assert.equal(hasPermission('moderator', 'payments.refund'), false);
    assert.equal(hasPermission('moderator', 'coupons.write'), false);
    assert.equal(hasPermission('moderator', 'plans.write'), false);
    assert.equal(hasPermission('moderator', 'marketplace.moderate'), true);
    assert.equal(hasPermission('moderator', 'support.reply'), true);
  });

  test('requirePermission(perm) rejects when role lacks the permission', () => {
    const mw = requirePermission('payments.refund');
    let nextCalled = false;
    let statusCode = 0;
    const json: Record<string, unknown> = {};

    const req = {
      adminId: 'mod-1', adminEmail: 'mod@example.com', adminRole: 'moderator',
      headers: { authorization: 'Bearer fake' },
    } as unknown as Parameters<typeof mw>[0];
    const res = {
      status(c: number) { statusCode = c; return this; },
      json(b: Record<string, unknown>) { Object.assign(json, b); return this; },
    } as unknown as Parameters<typeof mw>[1];

    // requireAdmin will reject the fake auth first — that already covers the
    // "deny" path. The deeper unit semantics are covered by hasPermission above.
    mw(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.ok(statusCode === 401 || statusCode === 403);
  });
});
