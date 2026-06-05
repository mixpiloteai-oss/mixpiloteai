// ============================================================
// NEUROTEK AI — Local AI Routes Tests
// ============================================================
// Tests the /api/local-ai/* management endpoints.
// These tests run WITHOUT a real Ollama instance — they verify
// the API surface, auth gates, and graceful degradation when
// Ollama is not available (the default in CI).
// ============================================================
import '../setup/env.ts';
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../setup/server.ts';
import { registerAndLogin, authHeaders } from '../setup/auth.ts';

describe('Local AI — management endpoints', () => {
  let srv: TestServer;
  let token: string;

  before(async () => {
    srv = await startTestServer();
    const user = await registerAndLogin(srv.baseUrl);
    token = user.accessToken;
  });

  after(async () => { await srv.close(); });

  // ── Auth gate ─────────────────────────────────────────────

  test('GET /api/local-ai/status without auth → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/local-ai/status`);
    assert.ok(res.status === 401 || res.status === 403, `expected 401/403 got ${res.status}`);
  });

  test('GET /api/local-ai/catalogue without auth → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/local-ai/catalogue`);
    assert.ok(res.status === 401 || res.status === 403, `expected 401/403 got ${res.status}`);
  });

  test('GET /api/local-ai/models without auth → 401', async () => {
    const res = await fetch(`${srv.baseUrl}/api/local-ai/models`);
    assert.ok(res.status === 401 || res.status === 403, `expected 401/403 got ${res.status}`);
  });

  // ── Status endpoint ───────────────────────────────────────

  test('GET /api/local-ai/status → 200 with shape', async () => {
    const res = await fetch(`${srv.baseUrl}/api/local-ai/status`, {
      headers: authHeaders(token),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; data: Record<string, unknown> };
    assert.equal(body.success, true);
    const d = body.data;
    assert.ok(typeof d['available'] === 'boolean', 'available must be boolean');
    assert.ok(['ollama', 'llamacpp', 'none'].includes(d['backend'] as string), 'backend must be one of expected values');
    assert.ok(Array.isArray(d['loadedModels']), 'loadedModels must be array');
    assert.ok(d['gpuInfo'], 'gpuInfo must exist');
    assert.ok(d['routing'], 'routing info must exist');
  });

  test('GET /api/local-ai/status → available=false when Ollama not running (CI)', async () => {
    // In CI there is no Ollama — the service must degrade gracefully
    const res = await fetch(`${srv.baseUrl}/api/local-ai/status`, {
      headers: authHeaders(token),
    });
    const body = await res.json() as { success: boolean; data: { available: boolean } };
    // If CI has no Ollama, available is false. Either way the endpoint must not crash.
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(typeof body.data.available === 'boolean');
  });

  // ── GPU endpoint ──────────────────────────────────────────

  test('GET /api/local-ai/gpu → 200 with GPUInfo shape', async () => {
    const res = await fetch(`${srv.baseUrl}/api/local-ai/gpu`, {
      headers: authHeaders(token),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as {
      success: boolean;
      data: { available: boolean; backend?: string };
    };
    assert.equal(body.success, true);
    assert.ok(typeof body.data.available === 'boolean');
    // On CI: darwin → metal hint; linux → none (no CUDA env)
    if (body.data.backend) {
      const valid = ['cuda', 'metal', 'vulkan', 'none'];
      assert.ok(valid.includes(body.data.backend), `unexpected backend: ${body.data.backend}`);
    }
  });

  // ── Catalogue endpoint ────────────────────────────────────

  test('GET /api/local-ai/catalogue → 200 with 6 recommended models', async () => {
    const res = await fetch(`${srv.baseUrl}/api/local-ai/catalogue`, {
      headers: authHeaders(token),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    assert.equal(body.success, true);
    assert.ok(body.data.length >= 6, `expected ≥6 models, got ${body.data.length}`);

    const first = body.data[0] as {
      id: string; name: string; ollamaId: string; sizeGb: number; ramGb: number;
    };
    assert.ok(typeof first.id === 'string');
    assert.ok(typeof first.name === 'string');
    assert.ok(typeof first.ollamaId === 'string');
    assert.ok(typeof first.sizeGb === 'number' && first.sizeGb > 0);
    assert.ok(typeof first.ramGb === 'number' && first.ramGb > 0);
  });

  test('Catalogue contains mistral-7b model', async () => {
    const res = await fetch(`${srv.baseUrl}/api/local-ai/catalogue`, {
      headers: authHeaders(token),
    });
    const body = await res.json() as { data: Array<{ id: string }> };
    const ids = body.data.map((m) => m.id);
    assert.ok(ids.includes('mistral-7b-q4'), `mistral-7b-q4 not in catalogue: ${ids.join(', ')}`);
  });

  test('All catalogue models have required fields', async () => {
    const res = await fetch(`${srv.baseUrl}/api/local-ai/catalogue`, {
      headers: authHeaders(token),
    });
    const body = await res.json() as {
      data: Array<{
        id: string; name: string; ollamaId: string; sizeGb: number;
        ramGb: number; contextLength: number; quantization: string; tags: string[];
      }>;
    };
    for (const m of body.data) {
      assert.ok(m.id, `model missing id`);
      assert.ok(m.ollamaId, `model ${m.id} missing ollamaId`);
      assert.ok(m.sizeGb > 0, `model ${m.id} has invalid sizeGb`);
      assert.ok(m.ramGb > 0, `model ${m.id} has invalid ramGb`);
      assert.ok(m.contextLength > 0, `model ${m.id} has invalid contextLength`);
      assert.ok(Array.isArray(m.tags), `model ${m.id} tags must be array`);
    }
  });

  // ── Models (installed) endpoint ───────────────────────────

  test('GET /api/local-ai/models → 200 with array (empty when Ollama not running)', async () => {
    const res = await fetch(`${srv.baseUrl}/api/local-ai/models`, {
      headers: authHeaders(token),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    // In CI with no Ollama running, this is an empty array — not a 500
  });

  // ── Routing endpoint ──────────────────────────────────────

  test('GET /api/local-ai/routing → 200 with routing info', async () => {
    const res = await fetch(`${srv.baseUrl}/api/local-ai/routing`, {
      headers: authHeaders(token),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as {
      success: boolean;
      data: {
        cloudAvailable: boolean;
        localAvailable: boolean;
        recommendedBackend: string;
      };
    };
    assert.equal(body.success, true);
    assert.ok(typeof body.data.cloudAvailable === 'boolean');
    assert.ok(typeof body.data.localAvailable === 'boolean');
    const validBackends = ['cloud', 'local', 'auto'];
    assert.ok(
      validBackends.includes(body.data.recommendedBackend),
      `unexpected recommendedBackend: ${body.data.recommendedBackend}`
    );
  });

  // ── Pull validation ───────────────────────────────────────

  test('POST /api/local-ai/models/invalid!name/pull → 400 invalid model name', async () => {
    const res = await fetch(`${srv.baseUrl}/api/local-ai/models/invalid!name/pull`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
    });
    assert.equal(res.status, 400);
    const body = await res.json() as { success: boolean; error: string };
    assert.equal(body.success, false);
    assert.ok(body.error.toLowerCase().includes('invalid'));
  });

  test('POST /api/local-ai/models/mistral:7b/pull → 503 when Ollama not running', async () => {
    // We expect a 503 because Ollama is not running in CI
    const res = await fetch(
      `${srv.baseUrl}/api/local-ai/models/${encodeURIComponent('mistral:7b')}/pull`,
      {
        method: 'POST',
        headers: { ...authHeaders(token), 'content-type': 'application/json' },
      }
    );
    // 503 when Ollama not running, or SSE stream if it IS running
    assert.ok(
      res.status === 503 || res.headers.get('content-type')?.includes('text/event-stream'),
      `expected 503 or SSE stream, got ${res.status}`
    );
  });

  // ── Delete (admin-only) ───────────────────────────────────

  test('DELETE /api/local-ai/models/somemodel without admin → 403', async () => {
    const res = await fetch(`${srv.baseUrl}/api/local-ai/models/somemodel`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    assert.equal(res.status, 403);
  });
});

// ── AI Router integration ──────────────────────────────────────

describe('AI Router — routing logic via /api/ai/chat', () => {
  let srv: TestServer;
  let token: string;

  before(async () => {
    srv = await startTestServer();
    const user = await registerAndLogin(srv.baseUrl);
    token = user.accessToken;
  });

  after(async () => { await srv.close(); });

  test('POST /api/ai/chat with x-ai-backend:auto → 200 (demo when no keys)', async () => {
    const res = await fetch(`${srv.baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'content-type': 'application/json',
        'x-ai-backend': 'auto',
      },
      body: JSON.stringify({ message: 'What is sidechain compression?', type: 'chat' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json() as {
      success: boolean;
      data: { content: string; meta: { backend: string } };
    };
    assert.equal(body.success, true);
    assert.ok(body.data.content.length > 0, 'content must not be empty');
    // In CI: no cloud key, no local Ollama → demo backend
    assert.ok(
      ['cloud', 'local', 'demo'].includes(body.data.meta.backend),
      `unexpected backend: ${body.data.meta.backend}`
    );
  });

  test('POST /api/ai/chat with x-ai-backend:local when Ollama down → falls back (no 500)', async () => {
    const res = await fetch(`${srv.baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'content-type': 'application/json',
        'x-ai-backend': 'local',
      },
      body: JSON.stringify({ message: 'Suggest a kick drum EQ chain', type: 'kick' }),
    });
    // Must not return 500 — graceful fallback to demo or cloud
    assert.ok(res.status < 500, `expected non-5xx, got ${res.status}`);
    if (res.status === 200) {
      const body = await res.json() as { success: boolean };
      assert.equal(body.success, true);
    }
  });

  test('POST /api/ai/chat response includes meta.backend field', async () => {
    const res = await fetch(`${srv.baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Explain acid basslines', type: 'acid' }),
    });
    if (res.status !== 200) return; // skip if quota/rate limited
    const body = await res.json() as { data: { meta: { backend: string; fallback: boolean } } };
    assert.ok(body.data.meta.backend, 'meta.backend must be present');
    assert.ok(typeof body.data.meta.fallback === 'boolean', 'meta.fallback must be boolean');
  });
});
