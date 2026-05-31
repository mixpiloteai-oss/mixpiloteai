// ─── VstAudioRouter.test.ts ───────────────────────────────────────────────────
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { VstAudioRouter } from '../../src/renderer/src/audio/vst/VstAudioRouter.ts'

describe('VstAudioRouter', () => {
  it('addRoute + getRoutingGraph has correct instanceIds and routes', () => {
    const router = new VstAudioRouter()
    const route = router.addRoute({
      fromInstanceId: 'inst-A',
      fromBusIndex: 0,
      toInstanceId: 'mixer',
      toBusIndex: 0,
      gainDb: 0,
    })
    assert.ok(route.routeId.length > 0)

    const graph = router.getRoutingGraph()
    assert.ok(graph.instanceIds.includes('inst-A'))
    assert.ok(graph.routes.some(r => r.routeId === route.routeId))
    // 'mixer' is a terminal and should not appear in instanceIds
    assert.ok(!graph.instanceIds.includes('mixer'))
  })

  it('removeRoute removes it from graph', () => {
    const router = new VstAudioRouter()
    const route = router.addRoute({
      fromInstanceId: 'inst-R',
      fromBusIndex: 0,
      toInstanceId: 'mixer',
      toBusIndex: 0,
      gainDb: 0,
    })
    router.removeRoute(route.routeId)
    const graph = router.getRoutingGraph()
    assert.ok(!graph.routes.some(r => r.routeId === route.routeId))
  })

  it('detectCycles: A→mixer (no cycle) → false', () => {
    const router = new VstAudioRouter()
    router.addRoute({ fromInstanceId: 'A', fromBusIndex: 0, toInstanceId: 'mixer', toBusIndex: 0, gainDb: 0 })
    assert.equal(router.detectCycles(), false)
  })

  it('detectCycles: A→B route + B→A route → true', () => {
    const router = new VstAudioRouter()
    router.addRoute({ fromInstanceId: 'A', fromBusIndex: 0, toInstanceId: 'B', toBusIndex: 0, gainDb: 0 })
    router.addRoute({ fromInstanceId: 'B', fromBusIndex: 0, toInstanceId: 'A', toBusIndex: 0, gainDb: 0 })
    assert.equal(router.detectCycles(), true)
  })

  it('detectCycles: A→B→C (no cycle) → false', () => {
    const router = new VstAudioRouter()
    router.addRoute({ fromInstanceId: 'A', fromBusIndex: 0, toInstanceId: 'B', toBusIndex: 0, gainDb: 0 })
    router.addRoute({ fromInstanceId: 'B', fromBusIndex: 0, toInstanceId: 'C', toBusIndex: 0, gainDb: 0 })
    router.addRoute({ fromInstanceId: 'C', fromBusIndex: 0, toInstanceId: 'mixer', toBusIndex: 0, gainDb: 0 })
    assert.equal(router.detectCycles(), false)
  })

  it('detectCycles: A→B→C→A (three-node cycle) → true', () => {
    const router = new VstAudioRouter()
    router.addRoute({ fromInstanceId: 'A', fromBusIndex: 0, toInstanceId: 'B', toBusIndex: 0, gainDb: 0 })
    router.addRoute({ fromInstanceId: 'B', fromBusIndex: 0, toInstanceId: 'C', toBusIndex: 0, gainDb: 0 })
    router.addRoute({ fromInstanceId: 'C', fromBusIndex: 0, toInstanceId: 'A', toBusIndex: 0, gainDb: 0 })
    assert.equal(router.detectCycles(), true)
  })

  it('getOutputOrder: A→B→mixer → A comes before B in output', () => {
    const router = new VstAudioRouter()
    // A feeds into B, B feeds into mixer
    router.addRoute({ fromInstanceId: 'A', fromBusIndex: 0, toInstanceId: 'B', toBusIndex: 0, gainDb: 0 })
    router.addRoute({ fromInstanceId: 'B', fromBusIndex: 0, toInstanceId: 'mixer', toBusIndex: 0, gainDb: 0 })

    const order = router.getOutputOrder()
    const idxA = order.indexOf('A')
    const idxB = order.indexOf('B')
    assert.ok(idxA !== -1, 'A should be in the output order')
    assert.ok(idxB !== -1, 'B should be in the output order')
    assert.ok(idxA < idxB, `A (${idxA}) should come before B (${idxB})`)
  })

  it('getOutputOrder: independent nodes → both included', () => {
    const router = new VstAudioRouter()
    router.addRoute({ fromInstanceId: 'X', fromBusIndex: 0, toInstanceId: 'mixer', toBusIndex: 0, gainDb: 0 })
    router.addRoute({ fromInstanceId: 'Y', fromBusIndex: 0, toInstanceId: 'mixer', toBusIndex: 0, gainDb: 0 })

    const order = router.getOutputOrder()
    assert.ok(order.includes('X'))
    assert.ok(order.includes('Y'))
  })

  it('getRoutingGraph with multiple routes contains all non-mixer instanceIds', () => {
    const router = new VstAudioRouter()
    router.addRoute({ fromInstanceId: 'inst1', fromBusIndex: 0, toInstanceId: 'inst2', toBusIndex: 0, gainDb: 0 })
    router.addRoute({ fromInstanceId: 'inst2', fromBusIndex: 0, toInstanceId: 'mixer', toBusIndex: 0, gainDb: 0 })

    const graph = router.getRoutingGraph()
    assert.ok(graph.instanceIds.includes('inst1'))
    assert.ok(graph.instanceIds.includes('inst2'))
    assert.ok(!graph.instanceIds.includes('mixer'))
    assert.equal(graph.routes.length, 2)
  })
})
