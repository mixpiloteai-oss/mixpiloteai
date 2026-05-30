import '../setup/env.ts';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyWebhookSignature } from '../../src/services/stripeService.ts';
import {
  recordWebhookEvent,
  getWebhookLogs,
} from '../../src/services/stripeAdminService.ts';
import {
  recordPayPalWebhookEvent,
  getPayPalWebhookLogs,
} from '../../src/services/paypalAdminService.ts';

const SECRET = 'whsec_test_secret';

function signStripe(payload: string, ts: number = Math.floor(Date.now() / 1000)): string {
  const mac = createHmac('sha256', SECRET).update(`${ts}.${payload}`).digest('hex');
  return `t=${ts},v1=${mac}`;
}

describe('Stripe webhook signature', () => {
  test('accepts a freshly-signed payload', () => {
    const body = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
    const sig = signStripe(body);
    assert.equal(verifyWebhookSignature(body, sig, SECRET), true);
  });

  test('rejects a tampered payload', () => {
    const body = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
    const sig = signStripe(body);
    const tampered = body.replace('evt_1', 'evt_X');
    assert.equal(verifyWebhookSignature(tampered, sig, SECRET), false);
  });

  test('rejects a signature older than 5 minutes (replay protection)', () => {
    const body = JSON.stringify({ id: 'evt_old' });
    const sig = signStripe(body, Math.floor(Date.now() / 1000) - 600);
    assert.equal(verifyWebhookSignature(body, sig, SECRET), false);
  });

  test('rejects a signature with a missing v1 field', () => {
    assert.equal(verifyWebhookSignature('{}', 't=123', SECRET), false);
  });
});

describe('Webhook event log persistence', () => {
  test('Stripe events land in the admin webhook log', () => {
    recordWebhookEvent('checkout.session.completed', 'success');
    const logs = getWebhookLogs(10);
    assert.ok(logs.length > 0);
    assert.equal(logs[0]!.type, 'checkout.session.completed');
    assert.equal(logs[0]!.status, 'success');
  });

  test('Stripe failure events capture the error message', () => {
    recordWebhookEvent('invoice.payment_failed', 'failed', 'connection reset');
    const logs = getWebhookLogs(10);
    assert.equal(logs[0]!.status, 'failed');
    assert.equal(logs[0]!.error, 'connection reset');
  });

  test('PayPal events land in their dedicated log with resource type', () => {
    recordPayPalWebhookEvent('PAYMENT.CAPTURE.COMPLETED', 'success', undefined, 'evt_pp_1', 'capture');
    const logs = getPayPalWebhookLogs(10);
    assert.ok(logs.some((l) => l.id === 'evt_pp_1' && l.resource_type === 'capture'));
  });
});
