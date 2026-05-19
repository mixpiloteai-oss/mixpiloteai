// ─── Strict ProjectSaveData validator (hand-written, no Zod) ─────────────────
// Defends against malformed / malicious / tampered project files corrupting
// the application stores when loaded via the Project Serializer.

import type { ProjectSaveData } from './types'

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB

export type ValidationResult =
  | { ok: true;  data: ProjectSaveData }
  | { ok: false; reason: string }

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function inRange(v: unknown, lo: number, hi: number): v is number {
  return isFiniteNumber(v) && v >= lo && v <= hi
}

/**
 * Strict validator. Returns the original (typed) data on success or an error
 * reason on failure. Never throws.
 */
export function validateProjectSaveData(data: unknown): ValidationResult {
  // Size guard FIRST — refuse to even inspect oversized blobs deeply.
  try {
    const size = JSON.stringify(data ?? null).length
    if (size > MAX_BYTES) {
      return { ok: false, reason: `Project too large: ${size} bytes exceeds ${MAX_BYTES}` }
    }
  } catch {
    return { ok: false, reason: 'Project data is not JSON-serializable' }
  }

  if (!isObj(data)) return { ok: false, reason: 'Root is not an object' }

  // ── Version ────────────────────────────────────────────────────────────
  if (data.version !== 1) {
    return { ok: false, reason: `Unsupported version: ${String(data.version)}` }
  }

  // ── Mixer ──────────────────────────────────────────────────────────────
  // Real app shape: { channels: Record<string, ChannelState>, buses: MixerBus[] }
  // We validate buses (array of objects with id) and channels (object map).
  // Optional fields are coerced.
  if (data.mixer !== undefined && data.mixer !== null) {
    if (!isObj(data.mixer)) {
      return { ok: false, reason: 'mixer must be an object' }
    }
    const m = data.mixer
    if (m.buses !== undefined) {
      if (!Array.isArray(m.buses)) return { ok: false, reason: 'mixer.buses must be an array' }
      for (let i = 0; i < m.buses.length; i++) {
        const b = m.buses[i] as unknown
        if (!isObj(b)) return { ok: false, reason: `mixer.buses[${i}] not an object` }
        if (typeof b.id !== 'string') return { ok: false, reason: `mixer.buses[${i}].id missing` }
        if (b.gainDb !== undefined && !isFiniteNumber(b.gainDb)) {
          return { ok: false, reason: `mixer.buses[${i}].gainDb invalid` }
        }
        if (b.panCenter !== undefined && !inRange(b.panCenter, -1, 1)) {
          return { ok: false, reason: `mixer.buses[${i}].panCenter out of range` }
        }
        if (b.muted  !== undefined && typeof b.muted  !== 'boolean') {
          return { ok: false, reason: `mixer.buses[${i}].muted invalid` }
        }
        if (b.soloed !== undefined && typeof b.soloed !== 'boolean') {
          return { ok: false, reason: `mixer.buses[${i}].soloed invalid` }
        }
      }
    }
    if (m.channels !== undefined && !isObj(m.channels)) {
      return { ok: false, reason: 'mixer.channels must be an object map' }
    }
  }

  // ── Transport ──────────────────────────────────────────────────────────
  if (data.transport !== undefined && data.transport !== null) {
    if (!isObj(data.transport)) return { ok: false, reason: 'transport must be an object' }
    const t = data.transport
    if (!inRange(t.bpm, 20, 999)) {
      return { ok: false, reason: `transport.bpm out of range (20–999): ${String(t.bpm)}` }
    }
    if (t.timeSignatureTop    !== undefined && !inRange(t.timeSignatureTop,    1, 32)) {
      return { ok: false, reason: 'transport.timeSignatureTop out of range' }
    }
    if (t.timeSignatureBottom !== undefined && !inRange(t.timeSignatureBottom, 1, 64)) {
      return { ok: false, reason: 'transport.timeSignatureBottom out of range' }
    }
    if (t.looping !== undefined && typeof t.looping !== 'boolean') {
      return { ok: false, reason: 'transport.looping not boolean' }
    }
  }

  // ── Piano roll ─────────────────────────────────────────────────────────
  if (data.pianoRoll !== undefined && data.pianoRoll !== null) {
    if (!isObj(data.pianoRoll)) return { ok: false, reason: 'pianoRoll must be an object' }
    const p = data.pianoRoll
    if (p.notes !== undefined && !Array.isArray(p.notes)) {
      return { ok: false, reason: 'pianoRoll.notes must be an array' }
    }
  }

  // ── MIDI ───────────────────────────────────────────────────────────────
  if (data.midi !== undefined && data.midi !== null) {
    if (!isObj(data.midi)) return { ok: false, reason: 'midi must be an object' }
    const mi = data.midi
    if (mi.seqTracks !== undefined && !Array.isArray(mi.seqTracks)) {
      return { ok: false, reason: 'midi.seqTracks must be an array' }
    }
    if (mi.drumPads !== undefined && !Array.isArray(mi.drumPads)) {
      return { ok: false, reason: 'midi.drumPads must be an array' }
    }
  }

  // Coerce optional metadata fields
  const clean: ProjectSaveData = {
    version:    1,
    savedAt:    isFiniteNumber(data.savedAt) ? data.savedAt : Date.now(),
    appVersion: typeof data.appVersion === 'string' ? data.appVersion : '1.0.0',
    project:    data.project    ?? null,
    mixer:      data.mixer      ?? null,
    transport:  data.transport  ?? null,
    pianoRoll:  data.pianoRoll  ?? null,
    midi:       data.midi       ?? null,
  }

  return { ok: true, data: clean }
}
