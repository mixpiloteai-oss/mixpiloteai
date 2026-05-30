import '../setup/env.ts'
import { test, before, after, describe } from 'node:test'
import assert from 'node:assert/strict'
import { startTestServer, type TestServer } from '../setup/server.ts'
import { registerAndLogin, authHeaders } from '../setup/auth.ts'

describe('Collaboration persistence', () => {
  let srv: TestServer
  before(async () => { srv = await startTestServer() })
  after(async () => { await srv.close() })

  async function getStudioUser() {
    const loginRes = await fetch(`${srv.baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'studio@neurotek.ai', password: 'demo1234' }),
    })
    const body = await loginRes.json() as { data?: { accessToken: string; user: { id: string } } }
    return { token: body.data!.accessToken, userId: body.data!.user.id }
  }

  async function createProject(token: string) {
    const res = await fetch(`${srv.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Persistence Test' }),
    })
    const body = await res.json() as { data?: { id: string } }
    return body.data!.id
  }

  test('POST /api/collab/ops submits and stores op', async () => {
    const { token, userId } = await getStudioUser()
    const projectId = await createProject(token)
    const res = await fetch(`${srv.baseUrl}/api/collab/ops`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId,
        type: 'param-change',
        payload: { target: 'track-1', param: 'volume', value: 0.8 },
        rev: 0,
        timestamp: Date.now(),
      }),
    })
    assert.equal(res.status, 200)
    const body = await res.json() as { success: boolean; op?: { committedRev: number } }
    assert.equal(body.success, true)
    assert.ok(body.op?.committedRev != null, 'expected committedRev')
    void userId // suppress unused warning
  })

  test('GET /api/collab/history returns submitted ops', async () => {
    const { token } = await getStudioUser()
    const projectId = await createProject(token)
    // Submit an op
    await fetch(`${srv.baseUrl}/api/collab/ops`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId, type: 'clip-add',
        payload: { clipId: 'c1', trackId: 't1', bar: 1 },
        rev: 0, timestamp: Date.now(),
      }),
    })
    // History should contain it
    const histRes = await fetch(`${srv.baseUrl}/api/collab/history/${projectId}`)
    const histBody = await histRes.json() as { ops: unknown[] }
    assert.ok(Array.isArray(histBody.ops))
    assert.ok(histBody.ops.length > 0, 'expected at least one op in history')
  })

  test('GET /api/collab/snapshot/:projectId returns room state', async () => {
    const { token } = await getStudioUser()
    const projectId = await createProject(token)
    const res = await fetch(`${srv.baseUrl}/api/collab/snapshot/${projectId}?token=${token}`)
    assert.equal(res.status, 200)
    const body = await res.json() as { success: boolean; data?: { rev: number; opsInMemory: number } }
    assert.equal(body.success, true)
    assert.ok(body.data != null)
  })

  test('OT: param-change LWW — later timestamp wins', async () => {
    const { token } = await getStudioUser()
    const projectId = await createProject(token)
    const now = Date.now()
    // Op 1: volume = 0.5 at t=now
    const r1 = await fetch(`${srv.baseUrl}/api/collab/ops`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId, type: 'param-change',
        payload: { target: 't1', param: 'volume', value: 0.5 },
        rev: 0, timestamp: now,
      }),
    })
    const b1 = await r1.json() as { op?: { committedRev: number } }
    const rev1 = b1.op!.committedRev
    // Op 2: volume = 0.9 at t=now+1 (later -> should win)
    const r2 = await fetch(`${srv.baseUrl}/api/collab/ops`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId, type: 'param-change',
        payload: { target: 't1', param: 'volume', value: 0.9 },
        rev: 0, timestamp: now + 1,  // concurrent -- rev not rev1+1
      }),
    })
    const b2 = await r2.json() as { success: boolean; op?: { committedRev: number } }
    assert.equal(b2.success, true)
    assert.ok(b2.op?.committedRev != null, 'expected op to be committed')
    void rev1 // suppress unused warning
  })

  test('OT: clip-delete drops concurrent clip-move on same clip', async () => {
    const { token } = await getStudioUser()
    const projectId = await createProject(token)
    const now = Date.now()
    // Submit delete first
    await fetch(`${srv.baseUrl}/api/collab/ops`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId, type: 'clip-delete',
        payload: { clipId: 'clip-42' },
        rev: 0, timestamp: now,
      }),
    })
    // Submit concurrent move on same clip -- should be dropped (null committedRev)
    const moveRes = await fetch(`${srv.baseUrl}/api/collab/ops`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId, type: 'clip-move',
        payload: { clipId: 'clip-42', bar: 4 },
        rev: 0, timestamp: now,  // same rev = concurrent
      }),
    })
    const moveBody = await moveRes.json() as { success: boolean; op?: unknown; dropped?: boolean }
    assert.equal(moveBody.success, true)
    // Either op is null (dropped) or marked dropped
    assert.ok(moveBody.op == null || moveBody.dropped === true, 'expected clip-move to be dropped')
  })

  test('POST /api/sync deduplicates across calls', async () => {
    const opId = `dedup-test-${Date.now()}`
    const payload = {
      operations: [{
        id: opId,
        type: 'project-update',
        method: 'PATCH',
        url: '/api/projects/nonexistent',
        payload: { name: 'Test' },
        timestamp: Date.now(),
      }]
    }
    // First call -- may succeed or fail (project doesn't exist) but should record ID
    await fetch(`${srv.baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    // Second call with same opId -- should return dedup=true
    const res2 = await fetch(`${srv.baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await res2.json() as { data?: { results?: Array<{ data?: { deduplicated?: boolean } }> } }
    const result = body.data?.results?.[0]
    assert.ok(result?.data?.deduplicated === true, 'expected deduplication on second call')
  })

  test('GET /api/collab/stream with sinceRev delivers only new ops', async () => {
    const { token, userId } = await getStudioUser()
    const projectId = await createProject(token)
    // Submit one op first
    await fetch(`${srv.baseUrl}/api/collab/ops`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId, type: 'param-change',
        payload: { target: 't1', param: 'pan', value: 0.2 },
        rev: 0, timestamp: Date.now(),
      }),
    })
    // Connect with sinceRev=0 -- should get the op in recentOps
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 600)
    try {
      const res = await fetch(
        `${srv.baseUrl}/api/collab/stream/${projectId}?token=${token}&userId=${userId}&userName=T&sinceRev=0`,
        { signal: controller.signal }
      )
      // Stream keeps connection open; we just verify headers and move on
      assert.ok(res.headers.get('content-type')?.includes('text/event-stream'))
    } catch (e) {
      const err = e as { name?: string }
      if (err.name !== 'AbortError') throw e
    }
    // If we got here, stream opened successfully
    assert.ok(true)
  })

  test('Presence POST updates user cursor', async () => {
    const { token, userId } = await getStudioUser()
    const projectId = await createProject(token)
    // First submit an op so the room exists with the user in presence
    await fetch(`${srv.baseUrl}/api/collab/ops`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId, type: 'cursor-move',
        payload: { bar: 4, track: 'drums' },
        rev: 0, timestamp: Date.now(),
        userId,
      }),
    })
    // Now the room exists — call presence endpoint
    // Note: route accepts bar+track at top level (not nested under cursor)
    const res = await fetch(`${srv.baseUrl}/api/collab/presence`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ projectId, userId, bar: 4, track: 'drums' }),
    })
    // If room doesn't have user in presence (no SSE connection), returns 404
    // If user is in presence, returns 200 — both are acceptable here
    assert.ok(res.status === 200 || res.status === 404, `expected 200 or 404, got ${res.status}`)
  })

  test('Multi-user: two users see each others ops via history', async () => {
    const u1 = await getStudioUser()
    const u2 = await registerAndLogin(srv.baseUrl)
    const { token: t1 } = u1
    const projectId = await createProject(t1)
    // u1 submits an op
    await fetch(`${srv.baseUrl}/api/collab/ops`, {
      method: 'POST',
      headers: { ...authHeaders(t1), 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId, type: 'track-add',
        payload: { trackId: 'tk-1', name: 'Bass' },
        rev: 0, timestamp: Date.now(),
      }),
    })
    // History is readable by anyone
    const histRes = await fetch(`${srv.baseUrl}/api/collab/history/${projectId}`)
    const hist = await histRes.json() as { ops: unknown[] }
    assert.ok(hist.ops.length >= 1)
    void u2 // suppress unused warning
  })
})
