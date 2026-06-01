// ─── ExportPresets ─────────────────────────────────────────────────────────────
// Built-in and user-defined export presets.

import type { ExportFormat } from './FlacEncoderPcm'
import type { DitherType } from './DitherEngine'
import type { ExportOptions } from './ExportQueue'

export interface ExportPreset {
  id:               string
  name:             string
  description:      string
  format:           ExportFormat
  sampleRate:       44100 | 48000 | 88200 | 96000
  bitDepth:         16 | 24 | 32
  bitrate?:         64 | 96 | 128 | 192 | 256 | 320
  ditherType:       DitherType
  normalization:    boolean
  applyMasterChain: boolean
  targetLufs?:      number
  isBuiltIn:        boolean
}

// ─── Built-in presets ─────────────────────────────────────────────────────────

const BUILT_IN_PRESETS: ExportPreset[] = [
  {
    id:               'streaming',
    name:             'Streaming (MP3 320)',
    description:      'High-quality streaming',
    format:           'mp3',
    sampleRate:       44100,
    bitDepth:         16,
    bitrate:          320,
    ditherType:       'tpdf',
    normalization:    true,
    applyMasterChain: true,
    targetLufs:       -14,
    isBuiltIn:        true,
  },
  {
    id:               'cd-quality',
    name:             'CD Quality (WAV 16-bit)',
    description:      'Standard CD audio',
    format:           'wav',
    sampleRate:       44100,
    bitDepth:         16,
    ditherType:       'tpdf',
    normalization:    false,
    applyMasterChain: true,
    isBuiltIn:        true,
  },
  {
    id:               'studio-24',
    name:             'Studio (WAV 24-bit)',
    description:      'Studio master quality',
    format:           'wav',
    sampleRate:       48000,
    bitDepth:         24,
    ditherType:       'none',
    normalization:    false,
    applyMasterChain: false,
    isBuiltIn:        true,
  },
  {
    id:               'mastered',
    name:             'Mastered (FLAC 24-bit)',
    description:      'Mastered lossless',
    format:           'flac',
    sampleRate:       44100,
    bitDepth:         24,
    ditherType:       'tpdf',
    normalization:    true,
    applyMasterChain: true,
    targetLufs:       -14,
    isBuiltIn:        true,
  },
  {
    id:               'stems',
    name:             'Stems (WAV 24-bit)',
    description:      'Separate track stems',
    format:           'wav',
    sampleRate:       48000,
    bitDepth:         24,
    ditherType:       'none',
    normalization:    false,
    applyMasterChain: false,
    isBuiltIn:        true,
  },
]

const STORAGE_KEY = 'export_presets'

// ─── ExportPresets class ──────────────────────────────────────────────────────

export class ExportPresets {
  private _userPresets: ExportPreset[]

  constructor() {
    this._userPresets = this._loadFromStorage()
  }

  getAllPresets(): ExportPreset[] {
    return [...BUILT_IN_PRESETS, ...this._userPresets]
  }

  getBuiltInPresets(): ExportPreset[] {
    return [...BUILT_IN_PRESETS]
  }

  getUserPresets(): ExportPreset[] {
    return [...this._userPresets]
  }

  getPreset(id: string): ExportPreset | undefined {
    return this.getAllPresets().find(p => p.id === id)
  }

  saveUserPreset(preset: Omit<ExportPreset, 'id' | 'isBuiltIn'>): ExportPreset {
    const newPreset: ExportPreset = {
      ...preset,
      id:        `user_${Date.now()}`,
      isBuiltIn: false,
    }
    this._userPresets.push(newPreset)
    this._persist()
    return newPreset
  }

  deleteUserPreset(id: string): void {
    this._userPresets = this._userPresets.filter(p => p.id !== id)
    this._persist()
  }

  /**
   * Map a preset to a partial ExportOptions object.
   */
  applyPreset(preset: ExportPreset): Partial<ExportOptions> {
    const opts: Partial<ExportOptions> = {
      format:           preset.format,
      sampleRate:       preset.sampleRate,
      bitDepth:         preset.bitDepth,
      ditherType:       preset.ditherType,
      normalization:    preset.normalization,
      applyMasterChain: preset.applyMasterChain,
    }
    if (preset.bitrate !== undefined)   opts.bitrate    = preset.bitrate
    if (preset.targetLufs !== undefined) opts.targetLufs = preset.targetLufs
    return opts
  }

  private _loadFromStorage(): ExportPreset[] {
    try {
      // In renderer (browser/Electron), use localStorage
      const stored = typeof localStorage !== 'undefined'
        ? localStorage.getItem(STORAGE_KEY)
        : null
      if (!stored) return []
      const parsed = JSON.parse(stored) as unknown
      if (!Array.isArray(parsed)) return []
      return (parsed as ExportPreset[]).filter(p => p && typeof p.id === 'string')
    } catch {
      return []
    }
  }

  private _persist(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._userPresets))
      }
    } catch {
      // localStorage may not be available in all environments
    }
  }
}

/** Singleton export presets manager. */
export const exportPresets = new ExportPresets()
