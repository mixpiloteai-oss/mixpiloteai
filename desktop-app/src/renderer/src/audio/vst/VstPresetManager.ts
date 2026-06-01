// ── VST User Preset Manager ────────────────────────────────────────────────────
// Manages user presets persisted to localStorage.

export interface UserPreset {
  id: string
  name: string
  pluginId: string
  category: string
  state: string  // JSON.stringify'd number[]
  createdAt: number
}

const STORAGE_KEY = 'vst_user_presets'

export class VstPresetManager {
  private presets: Map<string, UserPreset> = new Map()

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as UserPreset[]
      for (const preset of parsed) {
        this.presets.set(preset.id, preset)
      }
    } catch {
      this.presets = new Map()
    }
  }

  private persist(): void {
    const arr = Array.from(this.presets.values())
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
  }

  savePreset(name: string, pluginId: string, state: number[]): UserPreset {
    const id = `preset_${pluginId}_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const preset: UserPreset = {
      id,
      name,
      pluginId,
      category: 'user',
      state: JSON.stringify(state),
      createdAt: Date.now(),
    }
    this.presets.set(id, preset)
    this.persist()
    return preset
  }

  loadPresetState(presetId: string): number[] {
    const preset = this.presets.get(presetId)
    if (!preset) throw new Error(`Preset not found: ${presetId}`)
    return JSON.parse(preset.state) as number[]
  }

  deletePreset(presetId: string): void {
    this.presets.delete(presetId)
    this.persist()
  }

  getPresetsForPlugin(pluginId: string): UserPreset[] {
    return Array.from(this.presets.values()).filter(p => p.pluginId === pluginId)
  }

  getAllPresets(): UserPreset[] {
    return Array.from(this.presets.values())
  }

  exportPreset(presetId: string): string {
    const preset = this.presets.get(presetId)
    if (!preset) throw new Error(`Preset not found: ${presetId}`)
    return JSON.stringify(preset)
  }

  importPreset(json: string): UserPreset {
    const parsed = JSON.parse(json) as UserPreset
    const newId = `preset_${parsed.pluginId}_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const preset: UserPreset = {
      ...parsed,
      id: newId,
      createdAt: Date.now(),
    }
    this.presets.set(newId, preset)
    this.persist()
    return preset
  }
}

export const vstPresetManager = new VstPresetManager()
