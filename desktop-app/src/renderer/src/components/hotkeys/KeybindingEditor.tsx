/**
 * KeybindingEditor — full keybinding editor panel.
 * Action list by category, search, click-to-rebind, conflict highlighting,
 * preset switcher, import/export JSON.
 */

import React, { useState, useRef, useCallback } from 'react'
import { HotkeyManager } from '../../hotkeys/HotkeyManager.ts'
import { type PresetName, PRESETS } from '../../hotkeys/HotkeyPresets.ts'
import { type ActionDef } from '../../hotkeys/ActionRegistry.ts'
import { type KeyCombo, parseKeyCombo, serializeKeyCombo } from '../../hotkeys/KeybindingEngine.ts'
import { KeyChordDisplay } from './KeyChordDisplay.tsx'

const PRESET_LABELS: Record<PresetName, string> = {
  default: 'Default',
  ableton: 'Ableton Live',
  fl:      'FL Studio',
  logic:   'Logic Pro',
}

interface RebindState {
  actionId: string
  listening: boolean
}

export function KeybindingEditor(): React.ReactElement {
  const manager = HotkeyManager.getInstance()
  const [, forceRender] = useState(0)
  const [search, setSearch]       = useState('')
  const [preset, setPreset]       = useState<PresetName>('default')
  const [rebind, setRebind]       = useState<RebindState | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(() => forceRender(n => n + 1), [])

  const conflicts = new Set(
    manager.getConflicts().flatMap(c => c.actionIds),
  )

  const actions = manager.registry
    .getAll()
    .filter(a =>
      !search ||
      a.label.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase()),
    )

  // Group by category
  const grouped = new Map<string, ActionDef[]>()
  for (const a of actions) {
    const list = grouped.get(a.category) ?? []
    list.push(a)
    grouped.set(a.category, list)
  }

  function handlePresetChange(name: PresetName): void {
    setPreset(name)
    manager.resetToPreset(name)
    refresh()
  }

  function startRebind(actionId: string): void {
    setRebind({ actionId, listening: true })
  }

  function cancelRebind(): void {
    setRebind(null)
  }

  function handleRebindKey(e: React.KeyboardEvent, actionId: string): void {
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') { cancelRebind(); return }

    const combo: KeyCombo = {
      key:   e.key.toLowerCase(),
      ctrl:  e.ctrlKey,
      shift: e.shiftKey,
      alt:   e.altKey,
      meta:  e.metaKey,
    }
    manager.map.unbindAction(actionId)
    manager.map.bind(actionId, combo)
    setRebind(null)
    refresh()
  }

  function resetAction(actionId: string): void {
    // Restore to the current preset default
    const presetBindings = PRESETS[preset]
    const combos = presetBindings[actionId] ?? []
    manager.map.unbindAction(actionId)
    for (const str of combos) {
      const combo = parseKeyCombo(str)
      if (combo) manager.map.bind(actionId, combo)
    }
    refresh()
  }

  function exportJSON(): void {
    const data = JSON.stringify(manager.map.serialize(), null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'hotkeys.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function importJSON(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as Record<string, string[]>
        manager.map.deserialize(data)
        refresh()
      } catch {
        // Invalid JSON — ignore
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full bg-neutral-900 text-neutral-100 text-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-700">
        <span className="font-semibold text-base">Keyboard Shortcuts</span>

        {/* Preset selector */}
        <select
          className="ml-auto bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-xs"
          value={preset}
          onChange={e => handlePresetChange(e.target.value as PresetName)}
        >
          {(Object.keys(PRESET_LABELS) as PresetName[]).map(p => (
            <option key={p} value={p}>{PRESET_LABELS[p]}</option>
          ))}
        </select>

        <button
          onClick={exportJSON}
          className="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded"
        >
          Export
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded"
        >
          Import
        </button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={importJSON} />
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-neutral-700">
        <input
          type="text"
          placeholder="Search actions…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-600 rounded px-3 py-1.5 text-xs placeholder-neutral-500 focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* Action list */}
      <div className="flex-1 overflow-y-auto">
        {[...grouped.entries()].map(([category, acts]) => (
          <div key={category}>
            <div className="sticky top-0 px-4 py-1.5 bg-neutral-800 text-neutral-400 text-xs uppercase tracking-wider font-semibold">
              {category}
            </div>
            {acts.map(action => {
              const bindings = manager.map.getBindingsFor(action.id)
              const isRebinding = rebind?.actionId === action.id
              const hasConflict = conflicts.has(action.id)

              return (
                <div
                  key={action.id}
                  className={`flex items-center px-4 py-2 border-b border-neutral-800 hover:bg-neutral-800/50 ${hasConflict ? 'border-l-2 border-l-red-500' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{action.label}</div>
                    <div className="text-neutral-500 text-xs truncate">{action.description}</div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {isRebinding ? (
                      <span
                        className="px-3 py-1 bg-purple-900/60 border border-purple-500 rounded text-purple-300 text-xs cursor-pointer animate-pulse"
                        tabIndex={0}
                        onKeyDown={e => handleRebindKey(e, action.id)}
                        onBlur={cancelRebind}
                        autoFocus
                      >
                        Press key…
                      </span>
                    ) : (
                      <>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {bindings.length > 0
                            ? bindings.map((b, i) => (
                                <KeyChordDisplay key={i} combo={b} />
                              ))
                            : <span className="text-neutral-600 text-xs italic">unbound</span>
                          }
                        </div>
                        <button
                          onClick={() => startRebind(action.id)}
                          className="px-1.5 py-0.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 rounded"
                          title="Rebind"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => resetAction(action.id)}
                          className="px-1.5 py-0.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 rounded"
                          title="Reset to preset default"
                        >
                          ↺
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {grouped.size === 0 && (
          <div className="px-4 py-8 text-center text-neutral-500 text-sm">
            No actions match "{search}"
          </div>
        )}
      </div>
    </div>
  )
}
