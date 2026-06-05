import '../setup/env.ts';
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startTestServer, type TestServer } from '../setup/server.ts'

let server: TestServer

before(async () => { server = await startTestServer() })
after(async () => { await server.close() })

const get = (path: string) => fetch(`${server.baseUrl}${path}`)

describe('GET /api/updates/check', () => {
  it('returns hasUpdate=false when current is latest', async () => {
    const r = await get('/api/updates/check?version=0.2.0&platform=win32&arch=x64')
    assert.equal(r.status, 200)
    const body = await r.json() as { data: { hasUpdate: boolean } }
    assert.equal(body.data.hasUpdate, false)
  })

  it('returns hasUpdate=true when current is older', async () => {
    const r = await get('/api/updates/check?version=0.1.0&platform=win32&arch=x64')
    assert.equal(r.status, 200)
    const body = await r.json() as { data: { hasUpdate: boolean; latest: string } }
    assert.equal(body.data.hasUpdate, true)
    assert.equal(body.data.latest, '0.2.0')
  })
})

describe('GET /api/updates/manifest', () => {
  it('returns latest manifest with required fields', async () => {
    const r = await get('/api/updates/manifest')
    assert.equal(r.status, 200)
    const body = await r.json() as { data: { version: string; schemaVersion: number } }
    assert.ok(body.data.version)
    assert.ok(typeof body.data.schemaVersion === 'number')
  })
})

describe('GET /api/updates/compatibility', () => {
  it('returns canOpen=true for same version', async () => {
    const r = await get('/api/updates/compatibility?from=0.2.0&to=0.2.0')
    assert.equal(r.status, 200)
    const body = await r.json() as { data: { canOpen: boolean } }
    assert.equal(body.data.canOpen, true)
  })
})
