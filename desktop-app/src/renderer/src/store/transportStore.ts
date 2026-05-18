/**
 * transportStore — Zustand store for transport UI state
 *
 * This store is the bridge between React components and the audio engine.
 * Rules:
 *   - Components READ from this store (selectors = cheap re-renders)
 *   - Components CALL actions on this store
 *   - Actions call the audio engine, which fires callbacks that update the store
 *   - Position (bar/beat) is updated by useTransportSync (rAF hook) — NOT here
 */

import { create } from 'zustand'
import { getTransport, getMetronome } from '../audio'
import { DEFAULT_BPM } from '../audio/types'

// ─── State shape ────────────────────────────────────────────────────────────

interface TransportState {
  playing:             boolean
  recording:           boolean
  looping:             boolean
  bpm:                 number
  timeSignatureTop:    number
  timeSignatureBottom: number
  loopStartBar:        number
  loopEndBar:          number
  /** Display position — driven by useTransportSync rAF hook. */
  positionBar:         number
  positionBeat:        number
  positionTick:        number
  metronomeEnabled:    boolean
  metronomeVolumeDb:   number
}

// ─── Actions shape ──────────────────────────────────────────────────────────

interface TransportActions {
  play():               void
  stop():               void
  pause():              void
  toggleRecord():       void
  toggleLoop():         void
  setBpm(bpm: number):  void
  nudgeBpm(delta: number): void
  setTimeSignature(top: number, bottom: number): void
  setLoopRegion(startBar: number, endBar: number): void
  toggleMetronome():    void
  setMetronomeVolume(db: number): void
  /** Called exclusively by useTransportSync rAF hook — not by components. */
  _syncPosition(bar: number, beat: number, tick: number): void
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useTransportStore = create<TransportState & TransportActions>((set) => {
  // Initialise audio engine state subscription once
  // (Lazy — getTransport() creates on first call, safe before user gesture)
  const transport = getTransport()
  const metronome = getMetronome()

  // Keep store in sync when engine state changes (play/stop/bpm etc.)
  transport.onStateChange(snap => {
    set({
      playing:             snap.playing,
      recording:           snap.recording,
      looping:             snap.looping,
      bpm:                 snap.bpm,
      timeSignatureTop:    snap.timeSignatureTop,
      timeSignatureBottom: snap.timeSignatureBottom,
      loopStartBar:        snap.loopStartBar,
      loopEndBar:          snap.loopEndBar,
    })
  })

  return {
    // ── Initial state ──────────────────────────────────────────────────
    playing:             false,
    recording:           false,
    looping:             false,
    bpm:                 DEFAULT_BPM,
    timeSignatureTop:    4,
    timeSignatureBottom: 4,
    loopStartBar:        1,
    loopEndBar:          9,
    positionBar:         1,
    positionBeat:        1,
    positionTick:        0,
    metronomeEnabled:    false,
    metronomeVolumeDb:   -6,

    // ── Actions ────────────────────────────────────────────────────────

    play() {
      transport.play()
      // State update comes via onStateChange callback above
    },

    stop() {
      transport.stop()
      // Reset display position immediately for snappy UI
      set({ positionBar: 1, positionBeat: 1, positionTick: 0 })
    },

    pause() {
      transport.pause()
    },

    toggleRecord() {
      transport.toggleRecord()
    },

    toggleLoop() {
      transport.toggleLoop()
    },

    setBpm(bpm) {
      transport.bpm = bpm
      set({ bpm })
    },

    nudgeBpm(delta) {
      transport.nudgeBpm(delta)
      set(() => ({ bpm: transport.bpm }))
    },

    setTimeSignature(top, bottom) {
      transport.setTimeSignature(top, bottom)
      set({ timeSignatureTop: top, timeSignatureBottom: bottom })
    },

    setLoopRegion(startBar, endBar) {
      transport.setLoopRegion(startBar, endBar)
      set({ loopStartBar: startBar, loopEndBar: endBar })
    },

    toggleMetronome() {
      set(s => {
        const next = !s.metronomeEnabled
        if (next) metronome.enable()
        else      metronome.disable()
        return { metronomeEnabled: next }
      })
    },

    setMetronomeVolume(db) {
      metronome.setVolume(db)
      set({ metronomeVolumeDb: db })
    },

    _syncPosition(bar, beat, tick) {
      set({ positionBar: bar, positionBeat: beat, positionTick: tick })
    },
  }
})
