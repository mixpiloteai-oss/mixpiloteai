import '../setup/env.ts';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { retryWithBackoff, CircuitBreaker } from '../../src/lib/resilience.ts';

describe('retryWithBackoff', () => {
  test('returns the first successful attempt', async () => {
    let calls = 0;
    const out = await retryWithBackoff(async () => { calls++; return 'ok'; }, { attempts: 3, baseMs: 1 });
    assert.equal(out, 'ok');
    assert.equal(calls, 1);
  });

  test('retries transient failures up to the limit', async () => {
    let calls = 0;
    const out = await retryWithBackoff(async () => {
      calls++;
      if (calls < 3) throw new Error('transient');
      return 'ok';
    }, { attempts: 5, baseMs: 1, jitter: false });
    assert.equal(out, 'ok');
    assert.equal(calls, 3);
  });

  test('throws after exhausting attempts', async () => {
    let calls = 0;
    await assert.rejects(
      () => retryWithBackoff(async () => { calls++; throw new Error('boom'); }, { attempts: 3, baseMs: 1 }),
      /boom/,
    );
    assert.equal(calls, 3);
  });

  test('aborts early on permanent errors', async () => {
    let calls = 0;
    await assert.rejects(
      () => retryWithBackoff(
        async () => { calls++; throw new Error('400 bad request'); },
        { attempts: 5, baseMs: 1, isPermanent: (e) => /400/.test((e as Error).message) },
      ),
    );
    assert.equal(calls, 1);
  });
});

describe('CircuitBreaker', () => {
  test('closes on success, trips after N consecutive failures', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, openMs: 50, label: 'test' });
    for (let i = 0; i < 3; i++) {
      await assert.rejects(() => cb.exec(async () => { throw new Error('upstream down'); }));
    }
    assert.equal(cb.status().state, 'open');
    await assert.rejects(() => cb.exec(async () => 'ok'), /Circuit open/);
  });

  test('moves to half-open after timeout and recovers on success', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, openMs: 30, halfOpenMax: 1, label: 'test2' });
    await assert.rejects(() => cb.exec(async () => { throw new Error('x'); }));
    assert.equal(cb.status().state, 'open');
    await new Promise((r) => setTimeout(r, 50));
    const out = await cb.exec(async () => 'recovered');
    assert.equal(out, 'recovered');
    assert.equal(cb.status().state, 'closed');
  });
});
