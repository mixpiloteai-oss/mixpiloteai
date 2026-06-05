// ─── SidechainRouter.test.ts ─────────────────────────────────────────────────

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { SidechainRouter } from '../../src/renderer/src/audio/SidechainRouter.ts'
import type { ConnectableNode } from '../../src/renderer/src/audio/SidechainRouter.ts'

// Minimal mock that records connect/disconnect calls
function makeNode(id: string): ConnectableNode & { connected: string[]; id: string } {
  const connected: string[] = []
  return {
    id,
    connected,
    connect(dst: ConnectableNode) {
      connected.push((dst as { id: string }).id)
    },
    disconnect(dst?: ConnectableNode) {
      if (dst) {
        const i = connected.indexOf((dst as { id: string }).id)
        if (i !== -1) connected.splice(i, 1)
      } else {
        connected.length = 0
      }
    },
  }
}

describe('SidechainRouter / registration', () => {
  let router: SidechainRouter
  beforeEach(() => { router = new SidechainRouter() })

  it('registerSource marks source as registered', () => {
    const node = makeNode('a')
    router.registerSource('track-a', node)
    assert.equal(router.hasRegisteredSource('track-a'), true)
  })

  it('unregistered track is not registered', () => {
    assert.equal(router.hasRegisteredSource('ghost'), false)
  })

  it('unregisterSource removes source', () => {
    router.registerSource('track-a', makeNode('a'))
    router.unregisterSource('track-a')
    assert.equal(router.hasRegisteredSource('track-a'), false)
  })
})

describe('SidechainRouter / connect & disconnect', () => {
  let router: SidechainRouter
  beforeEach(() => { router = new SidechainRouter() })

  it('getSidechainSourceId returns null before connect', () => {
    assert.equal(router.getSidechainSourceId('target'), null)
  })

  it('connectSidechain records the source id', () => {
    const src = makeNode('src')
    const dst = makeNode('dst')
    router.registerSource('src-track',  src)
    router.registerSource('dst-track',  dst)
    router.connectSidechain('dst-track', 'src-track')
    assert.equal(router.getSidechainSourceId('dst-track'), 'src-track')
  })

  it('connectSidechain calls connect on source node', () => {
    const src = makeNode('src')
    const dst = makeNode('dst')
    router.registerSource('src-track', src)
    router.registerSource('dst-track', dst)
    router.connectSidechain('dst-track', 'src-track')
    assert.deepEqual(src.connected, ['dst'])
  })

  it('disconnectSidechain removes connection record', () => {
    const src = makeNode('src')
    const dst = makeNode('dst')
    router.registerSource('src-track', src)
    router.registerSource('dst-track', dst)
    router.connectSidechain('dst-track', 'src-track')
    router.disconnectSidechain('dst-track')
    assert.equal(router.getSidechainSourceId('dst-track'), null)
  })

  it('disconnectSidechain calls disconnect on source node', () => {
    const src = makeNode('src')
    const dst = makeNode('dst')
    router.registerSource('src-track', src)
    router.registerSource('dst-track', dst)
    router.connectSidechain('dst-track', 'src-track')
    router.disconnectSidechain('dst-track')
    assert.deepEqual(src.connected, [])
  })

  it('connectSidechain replaces existing connection', () => {
    const srcA = makeNode('a')
    const srcB = makeNode('b')
    const dst  = makeNode('dst')
    router.registerSource('src-a', srcA)
    router.registerSource('src-b', srcB)
    router.registerSource('dst-track', dst)
    router.connectSidechain('dst-track', 'src-a')
    router.connectSidechain('dst-track', 'src-b')
    assert.equal(router.getSidechainSourceId('dst-track'), 'src-b')
    assert.deepEqual(srcA.connected, [])  // previous was disconnected
  })

  it('getSidechainNode returns the source node', () => {
    const src = makeNode('src')
    const dst = makeNode('dst')
    router.registerSource('src-track', src)
    router.registerSource('dst-track', dst)
    router.connectSidechain('dst-track', 'src-track')
    assert.equal(router.getSidechainNode('dst-track'), src)
  })

  it('getSidechainNode returns null when not connected', () => {
    assert.equal(router.getSidechainNode('nobody'), null)
  })
})

describe('SidechainRouter / unregisterSource cascade', () => {
  it('unregistering source disconnects dependent targets', () => {
    const router = new SidechainRouter()
    const src = makeNode('src')
    const dst = makeNode('dst')
    router.registerSource('src-track', src)
    router.registerSource('dst-track', dst)
    router.connectSidechain('dst-track', 'src-track')
    router.unregisterSource('src-track')
    assert.equal(router.getSidechainSourceId('dst-track'), null)
  })
})

describe('SidechainRouter / dispose', () => {
  it('dispose clears all connections', () => {
    const router = new SidechainRouter()
    const src = makeNode('src')
    const dst = makeNode('dst')
    router.registerSource('src-track', src)
    router.registerSource('dst-track', dst)
    router.connectSidechain('dst-track', 'src-track')
    router.dispose()
    assert.equal(router.getSidechainSourceId('dst-track'), null)
    assert.equal(router.hasRegisteredSource('src-track'), false)
  })
})
