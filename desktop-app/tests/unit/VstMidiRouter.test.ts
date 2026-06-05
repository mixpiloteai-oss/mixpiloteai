// ─── VstMidiRouter.test.ts ────────────────────────────────────────────────────
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { VstMidiRouter } from '../../src/renderer/src/audio/vst/VstMidiRouter.ts'
import type { MidiEvent } from '../../src/renderer/src/audio/vst/vstTypes.ts'

function makeNoteOn(channel: number, note: number, velocity: number): MidiEvent {
  return { type: 'noteOn', channel, note, velocity }
}

describe('VstMidiRouter', () => {
  it('addRoute + getRoutesForTrack returns correct routes', () => {
    const router = new VstMidiRouter()
    const route = router.addRoute({
      sourceTrackId: 'track-1',
      targetInstanceId: 'inst-1',
      channelFilter: 'all',
      noteTranspose: 0,
      velocityScale: 1,
    })
    assert.ok(route.routeId.length > 0)
    const routes = router.getRoutesForTrack('track-1')
    assert.equal(routes.length, 1)
    assert.equal(routes[0].routeId, route.routeId)
    assert.equal(routes[0].targetInstanceId, 'inst-1')
  })

  it('routeEvent: noteTranspose +12 shifts note by 12', () => {
    const router = new VstMidiRouter()
    router.addRoute({
      sourceTrackId: 'track-t',
      targetInstanceId: 'inst-t',
      channelFilter: 'all',
      noteTranspose: 12,
      velocityScale: 1,
    })
    const event = makeNoteOn(1, 60, 100)
    const results = router.routeEvent('track-t', event)
    assert.equal(results.length, 1)
    assert.equal(results[0].event.note, 72)
  })

  it('routeEvent: noteTranspose clamps to 0-127', () => {
    const router = new VstMidiRouter()
    router.addRoute({
      sourceTrackId: 'track-clamp',
      targetInstanceId: 'inst-clamp',
      channelFilter: 'all',
      noteTranspose: 100,
      velocityScale: 1,
    })
    const event = makeNoteOn(1, 100, 100)
    const results = router.routeEvent('track-clamp', event)
    assert.equal(results[0].event.note, 127)  // Clamped at 127
  })

  it('routeEvent: velocityScale 0.5 halves velocity', () => {
    const router = new VstMidiRouter()
    router.addRoute({
      sourceTrackId: 'track-v',
      targetInstanceId: 'inst-v',
      channelFilter: 'all',
      noteTranspose: 0,
      velocityScale: 0.5,
    })
    const event = makeNoteOn(1, 60, 100)
    const results = router.routeEvent('track-v', event)
    assert.equal(results[0].event.velocity, 50)
  })

  it('routeEvent: velocityScale rounds to integer', () => {
    const router = new VstMidiRouter()
    router.addRoute({
      sourceTrackId: 'track-round',
      targetInstanceId: 'inst-round',
      channelFilter: 'all',
      noteTranspose: 0,
      velocityScale: 0.5,
    })
    const event = makeNoteOn(1, 60, 101)
    const results = router.routeEvent('track-round', event)
    assert.equal(results[0].event.velocity, Math.round(101 * 0.5))
  })

  it('routeEvent: channelFilter=all passes all channels', () => {
    const router = new VstMidiRouter()
    router.addRoute({
      sourceTrackId: 'track-ch',
      targetInstanceId: 'inst-ch',
      channelFilter: 'all',
      noteTranspose: 0,
      velocityScale: 1,
    })
    const ch1Event = makeNoteOn(1, 60, 100)
    const ch5Event = makeNoteOn(5, 60, 100)
    assert.equal(router.routeEvent('track-ch', ch1Event).length, 1)
    assert.equal(router.routeEvent('track-ch', ch5Event).length, 1)
  })

  it('routeEvent: channelFilter=2 skips channel 1 events', () => {
    const router = new VstMidiRouter()
    router.addRoute({
      sourceTrackId: 'track-cf',
      targetInstanceId: 'inst-cf',
      channelFilter: 2,
      noteTranspose: 0,
      velocityScale: 1,
    })
    const ch1Event = makeNoteOn(1, 60, 100)
    const ch2Event = makeNoteOn(2, 60, 100)
    assert.equal(router.routeEvent('track-cf', ch1Event).length, 0)
    assert.equal(router.routeEvent('track-cf', ch2Event).length, 1)
  })

  it('clearTrackRoutes removes all routes for given trackId', () => {
    const router = new VstMidiRouter()
    router.addRoute({ sourceTrackId: 'track-clear', targetInstanceId: 'i1', channelFilter: 'all', noteTranspose: 0, velocityScale: 1 })
    router.addRoute({ sourceTrackId: 'track-clear', targetInstanceId: 'i2', channelFilter: 'all', noteTranspose: 0, velocityScale: 1 })
    router.addRoute({ sourceTrackId: 'track-other', targetInstanceId: 'i3', channelFilter: 'all', noteTranspose: 0, velocityScale: 1 })

    router.clearTrackRoutes('track-clear')
    assert.equal(router.getRoutesForTrack('track-clear').length, 0)
    assert.equal(router.getRoutesForTrack('track-other').length, 1)
  })

  it('routeEvent does not mutate original event', () => {
    const router = new VstMidiRouter()
    router.addRoute({
      sourceTrackId: 'track-mut',
      targetInstanceId: 'inst-mut',
      channelFilter: 'all',
      noteTranspose: 12,
      velocityScale: 0.5,
    })
    const event = makeNoteOn(1, 60, 100)
    router.routeEvent('track-mut', event)
    assert.equal(event.note, 60)   // Original unchanged
    assert.equal(event.velocity, 100)
  })
})
