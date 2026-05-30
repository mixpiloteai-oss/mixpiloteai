import '../setup/env.ts';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../../src/utils/validate.ts';
import type { Request, Response } from 'express';

// Minimal mock req/res — no Express dependency needed.
function mockReq(body: Record<string, unknown>): Request {
  return { body } as unknown as Request;
}

function mockRes() {
  const r = {
    _status: 0,
    _body: null as unknown,
    status(s: number) { this._status = s; return this; },
    json(b: unknown) { this._body = b; return this; },
  };
  return r as typeof r & Response;
}

describe('validate() helper', () => {
  test('required field missing → returns false, sends 400', () => {
    const req = mockReq({});
    const res = mockRes();
    const result = validate(req, res, { name: { required: true, type: 'string' } });
    assert.equal(result, false);
    assert.equal(res._status, 400);
  });

  test('field present but wrong type → returns false, sends 400', () => {
    const req = mockReq({ age: 'not-a-number' });
    const res = mockRes();
    const result = validate(req, res, { age: { required: true, type: 'number' } });
    assert.equal(result, false);
    assert.equal(res._status, 400);
  });

  test('string min length violation → returns false, sends 400', () => {
    const req = mockReq({ password: 'abc' });
    const res = mockRes();
    const result = validate(req, res, { password: { required: true, type: 'string', min: 8 } });
    assert.equal(result, false);
    assert.equal(res._status, 400);
  });

  test('string max length violation → returns false, sends 400', () => {
    const req = mockReq({ bio: 'x'.repeat(201) });
    const res = mockRes();
    const result = validate(req, res, { bio: { type: 'string', max: 200 } });
    assert.equal(result, false);
    assert.equal(res._status, 400);
  });

  test('invalid email format → returns false, sends 400', () => {
    const req = mockReq({ email: 'not-an-email' });
    const res = mockRes();
    const result = validate(req, res, { email: { required: true, type: 'email' } });
    assert.equal(result, false);
    assert.equal(res._status, 400);
  });

  test('empty required string → returns false, sends 400', () => {
    const req = mockReq({ username: '' });
    const res = mockRes();
    const result = validate(req, res, { username: { required: true, type: 'string' } });
    assert.equal(result, false);
    assert.equal(res._status, 400);
  });

  test('all valid fields → returns true, no status set', () => {
    const req = mockReq({ email: 'user@example.com', password: 'SecurePass123!' });
    const res = mockRes();
    const result = validate(req, res, {
      email: { required: true, type: 'email' },
      password: { required: true, type: 'string', min: 8 },
    });
    assert.equal(result, true);
    assert.equal(res._status, 0, 'no status should have been set');
  });

  test('optional field absent → returns true (not required)', () => {
    const req = mockReq({ name: 'Alice' });
    const res = mockRes();
    const result = validate(req, res, {
      name: { required: true, type: 'string' },
      bio: { type: 'string', max: 500 },
    });
    assert.equal(result, true);
  });

  test('valid email passes email type check', () => {
    const req = mockReq({ email: 'test@test.local' });
    const res = mockRes();
    const result = validate(req, res, { email: { required: true, type: 'email' } });
    assert.equal(result, true);
  });
});
