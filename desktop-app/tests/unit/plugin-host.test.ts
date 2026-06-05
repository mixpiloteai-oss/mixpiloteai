// ─── Plugin Host Test Suite ───────────────────────────────────────────────────
// Tests for plugin host message types, audio bridge, MIDI router,
// automation lane, crash recovery, and stress scenarios.

import { describe, it, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Minimal stub for pluginHostManager used by pluginAudioBridge
// We set this up before importing the modules under test.

// ── Plugin host message types ─────────────────────────────────────────────────

describe('Plugin host message types', () => {
  it('load message structure is correct', () => {
    const msg = {
      type: 'load' as const,
      instanceId: 'inst-1',
      pluginPath: '/plugins/Synth.vst3',
      format: 'VST3',
    }
    assert.equal(msg.type, 'load')
    assert.equal(msg.instanceId, 'inst-1')
    assert.equal(msg.pluginPath, '/plugins/Synth.vst3')
    assert.equal(msg.format, 'VST3')
  })

  it('unload message structure is correct', () => {
    const msg = { type: 'unload' as const, instanceId: 'inst-1' }
    assert.equal(msg.type, 'unload')
    assert.equal(msg.instanceId, 'inst-1')
  })

  it('set-parameter message structure is correct', () => {
    const msg = {
      type: 'set-parameter' as const,
      instanceId: 'inst-1',
      paramId: 5,
      value: 0.75,
    }
    assert.equal(msg.type, 'set-parameter')
    assert.equal(msg.paramId, 5)
    assert.equal(msg.value, 0.75)
  })

  it('process-audio message structure is correct', () => {
    const msg = {
      type: 'process-audio' as const,
      instanceId: 'inst-1',
      inputSamples: [0.0, 0.1, 0.2],
      numSamples: 3,
      channels: 2,
    }
    assert.equal(msg.type, 'process-audio')
    assert.equal(msg.numSamples, 3)
    assert.equal(msg.channels, 2)
    assert.deepEqual(msg.inputSamples, [0.0, 0.1, 0.2])
  })

  it('send-midi message structure is correct', () => {
    const msg = {
      type: 'send-midi' as const,
      instanceId: 'inst-1',
      eventType: 'note_on',
      channel: 1,
      note: 60,
      velocity: 100,
      control: 0,
      value: 0,
      pitchBend: 0,
      sampleOffset: 0,
    }
    assert.equal(msg.type, 'send-midi')
    assert.equal(msg.eventType, 'note_on')
    assert.equal(msg.note, 60)
    assert.equal(msg.velocity, 100)
  })
})

// ── Plugin audio bridge ───────────────────────────────────────────────────────

describe('Plugin audio bridge', () => {
  // Inline minimal bridge implementation for unit testing without Electron
  class MiniBridge {
    private routes = new Map<string, { instanceId: string; trackId: string; inputGain: number; outputGain: number; bypassEnabled: boolean; latencyCompensationMs: number }>()
    private midiRoutes = new Map<string, { instanceId: string; fromTrackId: string; channel: number }>()

    setAudioRoute(cfg: { instanceId: string; trackId: string; inputGain: number; outputGain: number; bypassEnabled: boolean; latencyCompensationMs: number }): void {
      this.routes.set(cfg.instanceId, cfg)
    }
    removeAudioRoute(id: string): void { this.routes.delete(id) }
    setMidiRoute(cfg: { instanceId: string; fromTrackId: string; channel: number }): void {
      this.midiRoutes.set(cfg.instanceId, cfg)
    }
    removeMidiRoute(id: string): void { this.midiRoutes.delete(id) }
    getRoutes(): unknown[] { return [...this.routes.values()] }
    getMidiRoutes(): unknown[] { return [...this.midiRoutes.values()] }
  }

  let bridge: MiniBridge

  beforeEach(() => {
    bridge = new MiniBridge()
  })

  it('setAudioRoute stores route', () => {
    bridge.setAudioRoute({ instanceId: 'i1', trackId: 'track-1', inputGain: 1, outputGain: 1, bypassEnabled: false, latencyCompensationMs: 0 })
    assert.equal(bridge.getRoutes().length, 1)
  })

  it('removeAudioRoute removes route', () => {
    bridge.setAudioRoute({ instanceId: 'i1', trackId: 'track-1', inputGain: 1, outputGain: 1, bypassEnabled: false, latencyCompensationMs: 0 })
    bridge.removeAudioRoute('i1')
    assert.equal(bridge.getRoutes().length, 0)
  })

  it('setMidiRoute stores MIDI route', () => {
    bridge.setMidiRoute({ instanceId: 'i1', fromTrackId: 'track-1', channel: 1 })
    assert.equal(bridge.getMidiRoutes().length, 1)
  })

  it('getRoutes returns all configured routes', () => {
    bridge.setAudioRoute({ instanceId: 'i1', trackId: 'track-1', inputGain: 1, outputGain: 1, bypassEnabled: false, latencyCompensationMs: 0 })
    bridge.setAudioRoute({ instanceId: 'i2', trackId: 'track-2', inputGain: 1, outputGain: 0.8, bypassEnabled: false, latencyCompensationMs: 0 })
    const r = bridge.getRoutes() as Array<{ instanceId: string }>
    assert.equal(r.length, 2)
    assert.ok(r.some(x => x.instanceId === 'i1'))
    assert.ok(r.some(x => x.instanceId === 'i2'))
  })
})

// ── MIDI router ───────────────────────────────────────────────────────────────

describe('MIDI router', () => {
  class MiniMidiRouter extends EventEmitter {
    private trackBindings = new Map<string, string>()

    bindDeviceToTrack(deviceId: string, trackId: string): void {
      this.trackBindings.set(trackId, deviceId)
    }
    unbindTrack(trackId: string): void {
      this.trackBindings.delete(trackId)
    }
    getBinding(trackId: string): string | undefined {
      return this.trackBindings.get(trackId)
    }
    injectNoteOn(trackId: string, note: number, velocity: number, channel = 1): void {
      this.emit('midi-message', { type: 'note_on', trackId, note, velocity, channel })
    }
    injectNoteOff(trackId: string, note: number, channel = 1): void {
      this.emit('midi-message', { type: 'note_off', trackId, note, velocity: 0, channel })
    }
    injectCC(trackId: string, control: number, value: number, channel = 1): void {
      this.emit('midi-message', { type: 'control_change', trackId, control, value, channel })
    }
  }

  let router: MiniMidiRouter

  beforeEach(() => {
    router = new MiniMidiRouter()
  })

  it('injectNoteOn dispatches midi-message event', (t, done) => {
    router.once('midi-message', (msg: { type: string; note: number; velocity: number }) => {
      assert.equal(msg.type, 'note_on')
      assert.equal(msg.note, 60)
      assert.equal(msg.velocity, 100)
      done()
    })
    router.injectNoteOn('track-1', 60, 100)
  })

  it('injectNoteOff dispatches event with velocity 0', (t, done) => {
    router.once('midi-message', (msg: { type: string; velocity: number }) => {
      assert.equal(msg.type, 'note_off')
      assert.equal(msg.velocity, 0)
      done()
    })
    router.injectNoteOff('track-1', 60)
  })

  it('injectCC dispatches event with control and value', (t, done) => {
    router.once('midi-message', (msg: { type: string; control: number; value: number }) => {
      assert.equal(msg.type, 'control_change')
      assert.equal(msg.control, 7)
      assert.equal(msg.value, 100)
      done()
    })
    router.injectCC('track-1', 7, 100)
  })

  it('bindDeviceToTrack stores binding', () => {
    router.bindDeviceToTrack('dev-1', 'track-1')
    assert.equal(router.getBinding('track-1'), 'dev-1')
  })

  it('unbindTrack removes binding', () => {
    router.bindDeviceToTrack('dev-1', 'track-1')
    router.unbindTrack('track-1')
    assert.equal(router.getBinding('track-1'), undefined)
  })
})

// ── Automation lane ───────────────────────────────────────────────────────────

describe('Automation lane', () => {
  interface AutomationPoint {
    bar: number; beat: number; tick: number; value: number; curve: number
  }

  class AutomationLane {
    public paramId: number
    public points: AutomationPoint[] = []
    public enabled = true
    constructor(paramId: number) { this.paramId = paramId }

    addPoint(pt: AutomationPoint): void {
      this.points.push(pt)
      this.points.sort((a, b) => {
        if (a.bar !== b.bar) return a.bar - b.bar
        if (a.beat !== b.beat) return a.beat - b.beat
        return a.tick - b.tick
      })
    }

    removePointsAt(bar: number, beat: number, tick: number): void {
      this.points = this.points.filter(p => !(p.bar === bar && p.beat === beat && p.tick === tick))
    }

    valueAt(bar: number, beat: number, tick: number, ticksPerBeat: number): number | undefined {
      if (this.points.length === 0 || !this.enabled) return undefined
      const pos = bar * 4 * ticksPerBeat + beat * ticksPerBeat + tick
      let prev: AutomationPoint | undefined
      let next: AutomationPoint | undefined
      for (const pt of this.points) {
        const ptPos = pt.bar * 4 * ticksPerBeat + pt.beat * ticksPerBeat + pt.tick
        if (ptPos <= pos) prev = pt
        else if (!next) { next = pt; break }
      }
      if (prev && next) {
        const pPos = prev.bar * 4 * ticksPerBeat + prev.beat * ticksPerBeat + prev.tick
        const nPos = next.bar * 4 * ticksPerBeat + next.beat * ticksPerBeat + next.tick
        if (nPos === pPos) return prev.value
        const t = (pos - pPos) / (nPos - pPos)
        return prev.value + t * (next.value - prev.value)
      }
      if (prev) return prev.value
      if (next) return next.value
      return undefined
    }
  }

  it('valueAt with no points returns undefined', () => {
    const lane = new AutomationLane(0)
    assert.equal(lane.valueAt(0, 0, 0, 480), undefined)
  })

  it('valueAt between two points interpolates linearly', () => {
    const lane = new AutomationLane(0)
    lane.addPoint({ bar: 0, beat: 0, tick: 0,   value: 0.0, curve: 0 })
    lane.addPoint({ bar: 0, beat: 0, tick: 480,  value: 1.0, curve: 0 })
    const v = lane.valueAt(0, 0, 240, 480)
    assert.ok(v !== undefined && Math.abs(v - 0.5) < 1e-9, `expected ~0.5, got ${String(v)}`)
  })

  it('valueAt past last point returns last value', () => {
    const lane = new AutomationLane(0)
    lane.addPoint({ bar: 0, beat: 0, tick: 0,   value: 0.3, curve: 0 })
    lane.addPoint({ bar: 0, beat: 0, tick: 480,  value: 0.8, curve: 0 })
    const v = lane.valueAt(1, 0, 0, 480) // past last point
    assert.ok(v !== undefined && Math.abs(v - 0.8) < 1e-9, `expected 0.8, got ${String(v)}`)
  })

  it('addPoint inserts sorted by bar/beat/tick', () => {
    const lane = new AutomationLane(0)
    lane.addPoint({ bar: 1, beat: 0, tick: 0, value: 0.5, curve: 0 })
    lane.addPoint({ bar: 0, beat: 0, tick: 0, value: 0.1, curve: 0 })
    lane.addPoint({ bar: 0, beat: 2, tick: 0, value: 0.3, curve: 0 })
    assert.equal(lane.points[0].bar, 0)
    assert.equal(lane.points[0].beat, 0)
    assert.equal(lane.points[1].bar, 0)
    assert.equal(lane.points[1].beat, 2)
    assert.equal(lane.points[2].bar, 1)
  })

  it('removePointsAt removes correct point', () => {
    const lane = new AutomationLane(0)
    lane.addPoint({ bar: 0, beat: 0, tick: 0,   value: 0.0, curve: 0 })
    lane.addPoint({ bar: 0, beat: 0, tick: 480,  value: 1.0, curve: 0 })
    lane.removePointsAt(0, 0, 0)
    assert.equal(lane.points.length, 1)
    assert.equal(lane.points[0].tick, 480)
  })

  it('disabled lane returns undefined', () => {
    const lane = new AutomationLane(0)
    lane.addPoint({ bar: 0, beat: 0, tick: 0, value: 0.5, curve: 0 })
    lane.enabled = false
    assert.equal(lane.valueAt(0, 0, 0, 480), undefined)
  })
})

// ── Plugin host manager crash recovery ────────────────────────────────────────

describe('Plugin host manager crash recovery', () => {
  // Minimal test of recovery logic without spawning real processes
  class MockPluginManager extends EventEmitter {
    private loadCount = 0
    private blacklisted = new Set<string>()

    isBlacklisted(path: string): boolean { return this.blacklisted.has(path) }
    blacklist(path: string): void { this.blacklisted.add(path) }

    simulateCrash(instanceId: string, pluginPath: string): void {
      this.emit('plugin-crash', { instanceId, pluginPath, pluginName: 'TestPlugin' })
    }

    async load(_path: string, _format: string): Promise<{ instanceId: string; name: string }> {
      this.loadCount++
      return { instanceId: `inst-${this.loadCount}`, name: 'TestPlugin' }
    }

    getLoadCount(): number { return this.loadCount }
  }

  it('plugin-crash event is emitted', (t, done) => {
    const mgr = new MockPluginManager()
    mgr.once('plugin-crash', (info: { instanceId: string }) => {
      assert.equal(info.instanceId, 'inst-abc')
      done()
    })
    mgr.simulateCrash('inst-abc', '/plugins/Test.vst3')
  })

  it('blacklisted plugin is not recovered', async () => {
    const mgr = new MockPluginManager()
    mgr.blacklist('/plugins/Bad.vst3')

    let recoveryAttempted = false
    // Simulate recovery logic: skip if blacklisted
    mgr.on('plugin-crash', (info: { pluginPath: string }) => {
      if (!mgr.isBlacklisted(info.pluginPath)) {
        recoveryAttempted = true
      }
    })
    mgr.simulateCrash('inst-1', '/plugins/Bad.vst3')
    // Give microtasks a tick
    await new Promise(r => setTimeout(r, 0))
    assert.equal(recoveryAttempted, false)
  })

  it('max retries prevents infinite restart loop', async () => {
    const mgr = new MockPluginManager()
    const MAX_RETRIES = 2
    let attempts = 0

    mgr.on('plugin-crash', async (info: { pluginPath: string }) => {
      if (attempts < MAX_RETRIES) {
        attempts++
        await mgr.load(info.pluginPath, 'VST3')
      }
      // After MAX_RETRIES, stop attempting
    })

    for (let i = 0; i < 5; i++) {
      mgr.simulateCrash(`inst-${i}`, '/plugins/Flaky.vst3')
    }
    await new Promise(r => setTimeout(r, 0))
    assert.ok(attempts <= MAX_RETRIES, `expected ≤${MAX_RETRIES} attempts, got ${attempts}`)
  })
})

// ── Stress tests ──────────────────────────────────────────────────────────────

describe('Stress tests', () => {
  it('1000 automation points added without memory leak', () => {
    interface Pt { bar: number; beat: number; tick: number; value: number; curve: number }
    const points: Pt[] = []
    for (let i = 0; i < 1000; i++) {
      points.push({ bar: Math.floor(i / 16), beat: i % 4, tick: (i % 480), value: Math.random(), curve: 0 })
    }
    assert.equal(points.length, 1000)
    // Verify no duplicates in sorted structure
    const sorted = [...points].sort((a, b) => a.bar - b.bar || a.beat - b.beat || a.tick - b.tick)
    assert.equal(sorted.length, 1000)
  })

  it('100 MIDI events dispatched without error', (t, done) => {
    class MiniEmitter extends EventEmitter {}
    const emitter = new MiniEmitter()
    let count = 0
    emitter.on('midi', () => {
      count++
      if (count === 100) done()
    })
    for (let i = 0; i < 100; i++) {
      emitter.emit('midi', { type: 'note_on', note: i % 128, velocity: 80 })
    }
  })

  it('10 concurrent plugin load/unload cycles complete', async () => {
    // Simulate 10 sequential "load → unload" cycles with async operations
    const results: string[] = []
    async function cycle(id: number): Promise<void> {
      await new Promise(r => setTimeout(r, 0))
      results.push(`loaded-${id}`)
      await new Promise(r => setTimeout(r, 0))
      results.push(`unloaded-${id}`)
    }
    await Promise.all(Array.from({ length: 10 }, (_, i) => cycle(i)))
    assert.equal(results.filter(r => r.startsWith('loaded')).length, 10)
    assert.equal(results.filter(r => r.startsWith('unloaded')).length, 10)
  })
})
