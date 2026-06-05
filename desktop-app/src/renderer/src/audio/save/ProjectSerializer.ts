import type { ProjectSaveData, ProjectSnapshot } from './types'
import { validateProjectSaveData } from './projectSchema'
import { migrateToLatest, isMigrationError } from './ProjectMigrator'
import { useProjectStore }   from '../../store/projectStore'
import { useMixerStore }     from '../../components/mixer/useMixerStore'
import { useTransportStore } from '../../store/transportStore'
import { usePianoRollStore } from '../../components/piano-roll/usePianoRollStore'
import { useMidiStore }      from '../../store/midiStore'
import type { ChannelMixerState, MixerBus } from '../../components/mixer/useMixerStore'
import type { ArpState, DrumPad, SeqTrack } from '../../store/midiStore'
import type { PRNote } from '../../components/piano-roll/types'
import type { Project } from '../../types/project'

// ─── Serialized sub-shapes ────────────────────────────────────────────────────

interface SerializedMixer {
  channels:      Record<string, ChannelMixerState>
  buses:         MixerBus[]
  masterLimiter: boolean
  monitoring:    boolean
}

interface SerializedTransport {
  bpm:                 number
  timeSignatureTop:    number
  timeSignatureBottom: number
  looping:             boolean
  loopStartBar:        number
  loopEndBar:          number
}

interface SerializedPianoRoll {
  notes: PRNote[]
  snap:  string
  zoomX: number
  zoomY: number
}

interface SerializedMidi {
  arp:       ArpState
  seqTracks: SeqTrack[]
  drumPads:  DrumPad[]
}

// ─── ProjectSerializer ────────────────────────────────────────────────────────

export class ProjectSerializer {
  /** Collect all store states and serialize to ProjectSaveData */
  collect(): ProjectSaveData {
    return {
      version:    1,
      savedAt:    Date.now(),
      appVersion: '1.0.0',
      project:    useProjectStore.getState().project,
      mixer:      this._serializeMixer(),
      transport:  this._serializeTransport(),
      pianoRoll:  this._serializePianoRoll(),
      midi:       this._serializeMidi(),
    }
  }

  /**
   * Restore all stores from saved data.
   *
   * Returns `{ ok: true }` on success or `{ ok: false, reason }` if validation
   * failed. Never throws — callers should branch on the result.
   *
   * Existing call-sites that rely on the legacy throw-on-failure behaviour
   * remain safe because we still throw inside the wrapper-free helpers used
   * directly elsewhere; the typed return is additive.
   */
  restore(data: unknown): { ok: true } | { ok: false; reason: string } {
    // Migrate to latest schema version before validation.
    const migResult = migrateToLatest(data)
    if (isMigrationError(migResult)) {
      return { ok: false, reason: migResult.error }
    }
    if (migResult.didMigrate) {
      console.info(`[ProjectSerializer] migrated project from schema v${migResult.fromVersion} to v${migResult.toVersion}`)
      if (migResult.warnings.length) console.warn('[ProjectSerializer] migration warnings:', migResult.warnings)
    }

    // Strict schema validation (checksum is verified by callers via verify()).
    const result = validateProjectSaveData(migResult.data)
    if (!result.ok) return { ok: false, reason: result.reason }

    const safe = result.data
    this._applyValidated(safe)
    return { ok: true }
  }

  /** Apply already-validated data to all stores. Internal use only. */
  private _applyValidated(data: ProjectSaveData): void {
    // Restore project store
    if (data.project !== null && data.project !== undefined) {
      useProjectStore.setState({ project: data.project as Project })
    }

    // Restore transport
    if (data.transport !== null && data.transport !== undefined) {
      const t = data.transport as Partial<SerializedTransport>
      if (t.bpm !== undefined)                useTransportStore.setState({ bpm: t.bpm })
      if (t.timeSignatureTop !== undefined)    useTransportStore.setState({ timeSignatureTop: t.timeSignatureTop })
      if (t.timeSignatureBottom !== undefined) useTransportStore.setState({ timeSignatureBottom: t.timeSignatureBottom })
      if (t.looping !== undefined)             useTransportStore.setState({ looping: t.looping })
      if (t.loopStartBar !== undefined)        useTransportStore.setState({ loopStartBar: t.loopStartBar })
      if (t.loopEndBar !== undefined)          useTransportStore.setState({ loopEndBar: t.loopEndBar })
    }

    // Restore mixer
    if (data.mixer !== null && data.mixer !== undefined) {
      const m = data.mixer as Partial<SerializedMixer>
      const patch: Partial<SerializedMixer> = {}
      if (m.channels !== undefined)      patch.channels      = m.channels
      if (m.buses !== undefined)         patch.buses         = m.buses
      if (m.masterLimiter !== undefined) patch.masterLimiter = m.masterLimiter
      if (m.monitoring !== undefined)    patch.monitoring    = m.monitoring
      useMixerStore.setState(patch)
    }

    // Restore piano roll notes
    if (data.pianoRoll !== null && data.pianoRoll !== undefined) {
      const p = data.pianoRoll as Partial<SerializedPianoRoll>
      if (p.notes !== undefined) usePianoRollStore.getState().loadNotes(p.notes)
    }

    // Restore MIDI
    if (data.midi !== null && data.midi !== undefined) {
      const m = data.midi as Partial<SerializedMidi>
      const patch: Partial<SerializedMidi> = {}
      if (m.arp !== undefined)       patch.arp       = m.arp
      if (m.seqTracks !== undefined) patch.seqTracks = m.seqTracks
      if (m.drumPads !== undefined)  patch.drumPads  = m.drumPads
      useMidiStore.setState(patch)
    }
  }

  /** Compute a simple checksum of a JSON string (djb2 hash → hex) */
  checksum(data: ProjectSaveData): string {
    const str = JSON.stringify(data)
    let h = 5381
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h) ^ str.charCodeAt(i)
      h = h >>> 0
    }
    return h.toString(16).padStart(8, '0')
  }

  /** Validate checksum integrity */
  verify(snapshot: ProjectSnapshot): boolean {
    return snapshot.checksum === this.checksum(snapshot.data)
  }

  /** Create a named snapshot */
  makeSnapshot(label: string, type: ProjectSnapshot['type']): ProjectSnapshot {
    const data = this.collect()
    const cs   = this.checksum(data)
    const json = JSON.stringify(data)
    return {
      id:        this._makeId(),
      label,
      createdAt: Date.now(),
      type,
      data,
      checksum:  cs,
      sizeBytes: new Blob([json]).size,
      dirty:     false,
    }
  }

  private _makeId(): string {
    const ts  = Date.now().toString(16)
    const rnd = Math.random().toString(16).slice(2, 8)
    return `${ts}-${rnd}`
  }

  private _serializeMixer(): SerializedMixer {
    const s = useMixerStore.getState()
    return {
      channels:      s.channels,
      buses:         s.buses,
      masterLimiter: s.masterLimiter,
      monitoring:    s.monitoring,
    }
  }

  private _serializeTransport(): SerializedTransport {
    const s = useTransportStore.getState()
    return {
      bpm:                 s.bpm,
      timeSignatureTop:    s.timeSignatureTop,
      timeSignatureBottom: s.timeSignatureBottom,
      looping:             s.looping,
      loopStartBar:        s.loopStartBar,
      loopEndBar:          s.loopEndBar,
    }
  }

  private _serializePianoRoll(): SerializedPianoRoll {
    const s = usePianoRollStore.getState()
    return {
      notes: s.notes,
      snap:  s.snap,
      zoomX: s.zoomX,
      zoomY: s.zoomY,
    }
  }

  private _serializeMidi(): SerializedMidi {
    const s = useMidiStore.getState()
    return {
      arp:       s.arp,
      seqTracks: s.seqTracks,
      drumPads:  s.drumPads,
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _serializerInstance: ProjectSerializer | null = null

export function getProjectSerializer(): ProjectSerializer {
  if (!_serializerInstance) {
    _serializerInstance = new ProjectSerializer()
  }
  return _serializerInstance
}
