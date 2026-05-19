// ─── Plugin Preset Manager ────────────────────────────────────────────────────
// Stores presets per plugin in {userData}/presets/{pluginId}/{name}.json

import { app } from 'electron'
import {
  existsSync, mkdirSync, writeFileSync, readFileSync,
  readdirSync, unlinkSync,
} from 'fs'
import { join, basename, extname } from 'path'

export interface Preset {
  id:       string
  pluginId: string
  name:     string
  data:     Record<string, number | string | boolean>
  savedAt:  number
  isFactory: boolean
}

function presetsDir(pluginId: string): string {
  return join(app.getPath('userData'), 'presets', pluginId)
}

function presetPath(pluginId: string, id: string): string {
  return join(presetsDir(pluginId), `${id}.json`)
}

function ensureDir(pluginId: string): void {
  mkdirSync(presetsDir(pluginId), { recursive: true })
}

export function listPresets(pluginId: string): Preset[] {
  const dir = presetsDir(pluginId)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .flatMap(f => {
      try {
        return [JSON.parse(readFileSync(join(dir, f), 'utf8')) as Preset]
      } catch { return [] }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function savePreset(
  pluginId: string,
  name:     string,
  data:     Record<string, number | string | boolean>,
): Preset {
  ensureDir(pluginId)
  const id     = `preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const preset: Preset = { id, pluginId, name, data, savedAt: Date.now(), isFactory: false }
  writeFileSync(presetPath(pluginId, id), JSON.stringify(preset, null, 2), 'utf8')
  return preset
}

export function loadPreset(pluginId: string, id: string): Preset | null {
  const fp = presetPath(pluginId, id)
  if (!existsSync(fp)) return null
  try { return JSON.parse(readFileSync(fp, 'utf8')) as Preset } catch { return null }
}

export function deletePreset(pluginId: string, id: string): void {
  const fp = presetPath(pluginId, id)
  if (existsSync(fp)) unlinkSync(fp)
}

export function renamePreset(pluginId: string, id: string, newName: string): Preset | null {
  const preset = loadPreset(pluginId, id)
  if (!preset) return null
  preset.name = newName
  writeFileSync(presetPath(pluginId, id), JSON.stringify(preset, null, 2), 'utf8')
  return preset
}

export function importPreset(pluginId: string, filePath: string): Preset | null {
  try {
    const raw     = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<Preset>
    const name    = raw.name ?? basename(filePath, extname(filePath))
    return savePreset(pluginId, name, raw.data ?? {})
  } catch { return null }
}
