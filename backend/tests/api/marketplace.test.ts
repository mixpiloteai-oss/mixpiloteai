import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';
import { registerAndLogin, authHeaders } from '../setup/auth.ts';

describe('Marketplace', () => {
  let srv: TestServer;
  before(async () => { srv = await startTestServer(); });
  after(async () => { await srv.close(); });

  test('GET /api/marketplace/products is public', async () => {
    const res = await fetch(`${srv.baseUrl}/api/marketplace/products`);
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; data: unknown };
    assert.equal(body.success, true);
    assert.ok(body.data);
  });

  test('GET /api/marketplace/products/featured is public', async () => {
    const res = await fetch(`${srv.baseUrl}/api/marketplace/products/featured`);
    assert.equal(res.status, 200);
  });

  test('GET /api/marketplace/products/trending is public', async () => {
    const res = await fetch(`${srv.baseUrl}/api/marketplace/products/trending?limit=3`);
    assert.equal(res.status, 200);
  });

  test('GET /api/marketplace/search requires q', async () => {
    const res = await fetch(`${srv.baseUrl}/api/marketplace/search`);
    assert.equal(res.status, 400);
  });

  test('GET /api/marketplace/search with q returns 200', async () => {
    const res = await fetch(`${srv.baseUrl}/api/marketplace/search?q=test`);
    assert.equal(res.status, 200);
  });

  test('POST /api/marketplace/products/:id/like without auth → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/marketplace/products/some-id/like`, { method: 'POST' });
    assert.equal(res.status, 401);
  });

  test('POST /api/marketplace/products/:id/comment without auth → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/marketplace/products/some-id/comment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'great', rating: 5 }),
    });
    assert.equal(res.status, 401);
  });

  test('POST /api/marketplace/products/:id/download without auth → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/marketplace/products/some-id/download`, { method: 'POST' });
    assert.equal(res.status, 401);
  });

  test('POST /api/marketplace/products/<unknown>/like with auth → 404 (not 401)', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const res = await fetch(`${srv.baseUrl}/api/marketplace/products/unknown-product-id-xyz/like`, {
      method: 'POST',
      headers: authHeaders(u.accessToken),
    });
    assert.equal(res.status, 404);
  });

  test('POST /api/marketplace/products/:id/like with real product + auth → 200', async () => {
    const u = await registerAndLogin(srv.baseUrl);
    const list = await fetch(`${srv.baseUrl}/api/marketplace/products?limit=1`);
    const listBody = await list.json() as { data: { products?: Array<{ id: string }>; items?: Array<{ id: string }> } };
    const products = listBody.data.products ?? listBody.data.items ?? [];
    if (products.length === 0) {
      // Nothing to like — still verify auth path works against unknown id.
      return;
    }
    const id = products[0]!.id;
    const res = await fetch(`${srv.baseUrl}/api/marketplace/products/${id}/like`, {
      method: 'POST',
      headers: authHeaders(u.accessToken),
    });
    assert.equal(res.status, 200);
  });
});
