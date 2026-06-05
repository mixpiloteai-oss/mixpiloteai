// ─── PluginPresetManager ──────────────────────────────────────────────────────
// Full-featured preset management modal for a plugin.
// Extends the basic PresetManager with rename, delete, factory badges,
// and live apply (sends preset data back to the plugin instance).

import { useState, useEffect } from 'react'
import { usePluginStore, type PluginPreset } from '../../store/pluginStore'
import { PluginBridge } from '../../audio/PluginBridge'

interface Props {
  pluginId:   string
  pluginName: string
  /** If provided, loading a preset applies parameters to this instance immediately. */
  instanceId?: string
  onClose:    () => void
}

type SortKey = 'name' | 'date'

export default function PluginPresetManager({ pluginId, pluginName, instanceId, onClose }: Props) {
  const { presets, setPresets } = usePluginStore()
  const pluginPresets = presets[pluginId] ?? []

  const [newName,   setNewName]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [renaming,  setRenaming]  = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [error,     setError]     = useState('')
  const [sortKey,   setSortKey]   = useState<SortKey>('name')
  const [search,    setSearch]    = useState('')

  useEffect(() => {
    PluginBridge.listPresets(pluginId).then(p => setPresets(pluginId, p)).catch(() => {})
  }, [pluginId, setPresets])

  async function handleSave() {
    if (!newName.trim()) return
    setSaving(true); setError('')
    try {
      const saved = await PluginBridge.savePreset(pluginId, newName.trim(), {})
      if (saved) {
        const updated = await PluginBridge.listPresets(pluginId)
        setPresets(pluginId, updated)
        setNewName('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleLoad(preset: PluginPreset) {
    if (!instanceId) return
    const data = await PluginBridge.loadPreset(pluginId, preset.id)
    if (!data) return
    for (const [idStr, val] of Object.entries(data)) {
      await PluginBridge.setParameter(instanceId, parseInt(idStr, 10), val as number)
    }
  }

  async function handleDelete(presetId: string) {
    await PluginBridge.deletePreset(pluginId, presetId)
    const updated = await PluginBridge.listPresets(pluginId)
    setPresets(pluginId, updated)
  }

  async function handleRename(presetId: string) {
    if (!renameVal.trim()) return
    await PluginBridge.renamePreset(pluginId, presetId, renameVal.trim())
    const updated = await PluginBridge.listPresets(pluginId)
    setPresets(pluginId, updated)
    setRenaming(null)
  }

  const sorted = [...pluginPresets]
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sortKey === 'name' ? a.name.localeCompare(b.name) : b.savedAt - a.savedAt,
    )

  const factoryCount = sorted.filter(p => p.isFactory).length
  const userCount    = sorted.filter(p => !p.isFactory).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-[440px] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#0c0c14', border: '1px solid #1c1c2e', maxHeight: '82vh' }}>

        {/* Header */}
        <div className="flex items-center gap-2 px-4 h-10 shrink-0"
          style={{ borderBottom: '1px solid #1c1c2e', background: '#0f0f1a' }}>
          <span className="flex-1 text-xs font-semibold truncate" style={{ color: '#94a3b8' }}>
            Presets — {pluginName}
          </span>
          <span className="text-[9px]" style={{ color: '#334155' }}>
            {factoryCount > 0 && `${factoryCount} factory · `}{userCount} user
          </span>
          <button onClick={onClose} style={{ color: '#475569', fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>

        {/* Search + sort */}
        <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ borderBottom: '1px solid #1c1c2e' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter presets…"
            className="flex-1 text-xs px-2.5 py-1.5 rounded-lg outline-none"
            style={{ background: '#08080f', border: '1px solid #1c1c2e', color: '#e2e8f0', caretColor: '#7c3aed' }}
          />
          <button onClick={() => setSortKey(k => k === 'name' ? 'date' : 'name')}
            className="text-[9px] px-2 py-1.5 rounded-lg shrink-0"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#475569', border: '1px solid #1c1c2e' }}>
            {sortKey === 'name' ? 'A–Z' : 'Date'}
          </button>
        </div>

        {/* Save new */}
        <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid #1c1c2e' }}>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="New preset name…"
              className="flex-1 text-xs px-3 py-2 rounded-xl outline-none"
              style={{ background: '#08080f', border: '1px solid #1c1c2e', color: '#e2e8f0', caretColor: '#7c3aed' }}
            />
            <button
              onClick={handleSave}
              disabled={!newName.trim() || saving}
              className="px-3 py-2 rounded-xl text-xs font-semibold"
              style={{
                background: 'rgba(124,58,237,0.25)',
                border:     '1px solid rgba(124,58,237,0.35)',
                color:      '#a855f7',
                opacity:    (!newName.trim() || saving) ? 0.5 : 1,
              }}>
              {saving ? '…' : '+ Save'}
            </button>
          </div>
          {error && <p className="text-[10px] mt-1" style={{ color: '#ef4444' }}>{error}</p>}
        </div>

        {/* Preset list */}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: '#334155' }}>
              {search ? 'No presets match' : 'No presets saved yet'}
            </p>
          )}
          {sorted.map(p => (
            <div key={p.id} className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid #13131f' }}>
              {p.isFactory && (
                <span className="text-[8px] px-1.5 py-px rounded-full shrink-0"
                  style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)' }}>
                  Factory
                </span>
              )}

              {renaming === p.id ? (
                <input
                  autoFocus
                  value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  handleRename(p.id)
                    if (e.key === 'Escape') setRenaming(null)
                  }}
                  className="flex-1 text-xs px-2 py-1 rounded-lg outline-none"
                  style={{ background: '#0f0f1a', border: '1px solid rgba(124,58,237,0.4)', color: '#e2e8f0', caretColor: '#7c3aed' }}
                />
              ) : (
                <span className="flex-1 text-xs truncate" style={{ color: '#94a3b8' }}>{p.name}</span>
              )}

              <span className="text-[9px] shrink-0" style={{ color: '#334155' }}>
                {new Date(p.savedAt).toLocaleDateString()}
              </span>

              <div className="flex gap-1 shrink-0">
                {instanceId && (
                  <button onClick={() => handleLoad(p)} title="Apply to plugin" className="w-6 h-6 rounded text-[10px] flex items-center justify-center"
                    style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>↓</button>
                )}
                <button onClick={() => { setRenaming(p.id); setRenameVal(p.name) }} title="Rename"
                  className="w-6 h-6 rounded text-[10px] flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#475569' }}>✎</button>
                {!p.isFactory && (
                  <button onClick={() => handleDelete(p.id)} title="Delete"
                    className="w-6 h-6 rounded text-[10px] flex items-center justify-center"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>✕</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-2 text-[10px] shrink-0" style={{ borderTop: '1px solid #1c1c2e', color: '#334155' }}>
          {sorted.length} preset{sorted.length !== 1 ? 's' : ''}
          {search && ` (filtered from ${pluginPresets.length})`}
        </div>
      </div>
    </div>
  )
}
