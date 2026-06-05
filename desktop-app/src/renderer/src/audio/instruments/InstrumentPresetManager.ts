import type { SynthParams } from './SubtractiveSynth'
import { DEFAULT_SYNTH_PARAMS } from './SubtractiveSynth'
import type { SamplerConfig } from './SamplerEngine'

export type InstrumentType = 'subtractive-synth' | 'sampler'

export interface InstrumentPreset<T> {
  id:        string
  name:      string
  type:      InstrumentType
  params:    T
  isFactory: boolean
  createdAt: number
}

// ── Factory presets for SubtractiveSynth ───────────────────────────────────────

export const SYNTH_FACTORY_PRESETS: InstrumentPreset<SynthParams>[] = [
  {
    id: 'factory-init', name: 'Init', type: 'subtractive-synth', isFactory: true, createdAt: 0,
    params: { ...DEFAULT_SYNTH_PARAMS },
  },
  {
    id: 'factory-pad', name: 'Slow Pad', type: 'subtractive-synth', isFactory: true, createdAt: 0,
    params: { ...DEFAULT_SYNTH_PARAMS, osc1Wave: 'sine', osc2Wave: 'triangle', osc2Level: 0.5,
      attack: 0.8, decay: 0.3, sustain: 0.9, release: 1.2,
      filterCutoff: 800, filterResonance: 0.8, filterEnvAmount: 0.5, filterAttack: 1.0, filterDecay: 0.5, filterSustain: 0.7, filterRelease: 1.0,
      lfoRate: 0.4, lfoAmount: 0.05, lfoTarget: 'filter' },
  },
  {
    id: 'factory-lead', name: 'Lead Saw', type: 'subtractive-synth', isFactory: true, createdAt: 0,
    params: { ...DEFAULT_SYNTH_PARAMS, osc1Wave: 'sawtooth', osc2Wave: 'sawtooth', osc2Detune: 12, osc2Level: 0.4,
      attack: 0.003, decay: 0.05, sustain: 0.8, release: 0.15,
      filterCutoff: 3500, filterResonance: 2.0, filterEnvAmount: 2.5, filterAttack: 0.005, filterDecay: 0.2, filterSustain: 0.3, filterRelease: 0.3 },
  },
  {
    id: 'factory-bass', name: 'Bass Mono', type: 'subtractive-synth', isFactory: true, createdAt: 0,
    params: { ...DEFAULT_SYNTH_PARAMS, osc1Wave: 'square', osc2Wave: 'sawtooth', osc2Semitones: -12, osc2Level: 0.6,
      attack: 0.001, decay: 0.12, sustain: 0.5, release: 0.1,
      filterCutoff: 600, filterResonance: 3.0, filterEnvAmount: 3.5, filterAttack: 0.001, filterDecay: 0.15, filterSustain: 0.1, filterRelease: 0.2,
      polyphony: 1 },
  },
]

// ── Generic preset manager ────────────────────────────────────────────────────

const STORAGE_KEY = (type: InstrumentType) => `instrument-presets-${type}`

export class InstrumentPresetManager<T> {
  private readonly _type:     InstrumentType
  private readonly _factory:  InstrumentPreset<T>[]
  private _user:              InstrumentPreset<T>[] = []

  constructor(type: InstrumentType, factoryPresets: InstrumentPreset<T>[] = []) {
    this._type    = type
    this._factory = factoryPresets
    this._load()
  }

  list(): InstrumentPreset<T>[] {
    return [...this._factory, ...this._user]
  }

  save(name: string, params: T): InstrumentPreset<T> {
    const preset: InstrumentPreset<T> = {
      id:        Date.now().toString(36) + Math.random().toString(36).slice(2),
      name, type: this._type, params, isFactory: false, createdAt: Date.now(),
    }
    this._user = this._user.filter(p => p.name !== name)  // replace same name
    this._user.push(preset)
    this._persist()
    return preset
  }

  load(id: string): InstrumentPreset<T> | null {
    return this.list().find(p => p.id === id) ?? null
  }

  delete(id: string): void {
    this._user = this._user.filter(p => p.id !== id)
    this._persist()
  }

  rename(id: string, newName: string): void {
    const idx = this._user.findIndex(p => p.id === id)
    if (idx !== -1) {
      this._user[idx] = { ...this._user[idx]!, name: newName }
      this._persist()
    }
  }

  private _load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(this._type))
      if (raw) this._user = JSON.parse(raw) as InstrumentPreset<T>[]
    } catch { /* ignore parse errors */ }
  }

  private _persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY(this._type), JSON.stringify(this._user))
    } catch { /* ignore storage quota errors */ }
  }
}

// ── Singleton accessors ───────────────────────────────────────────────────────

let _synthPresets: InstrumentPresetManager<SynthParams> | null = null
let _samplerPresets: InstrumentPresetManager<SamplerConfig> | null = null

export function getSynthPresetManager(): InstrumentPresetManager<SynthParams> {
  if (!_synthPresets) _synthPresets = new InstrumentPresetManager('subtractive-synth', SYNTH_FACTORY_PRESETS)
  return _synthPresets
}

export function getSamplerPresetManager(): InstrumentPresetManager<SamplerConfig> {
  if (!_samplerPresets) _samplerPresets = new InstrumentPresetManager('sampler', [])
  return _samplerPresets
}
