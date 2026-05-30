import { useState, useEffect } from 'react'
import { usePluginStore, type PluginInfo, type PluginPreset } from '../../store/pluginStore'

interface Props {
  plugin: PluginInfo
  onClose: () => void
}

export default function PresetManager({ plugin, onClose }: Props) {
  const { presets, setPresets } = usePluginStore()
  const pluginPresets = presets[plugin.id] ?? []
  const [newName,  setNewName]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal,setRenameVal]= useState('')
  const [error,    setError]    = useState('')

  useEffect(() => {
    window.electronAPI?.pluginListPresets(plugin.id).then(p => {
      setPresets(plugin.id, p as PluginPreset[])
    }).catch(() => {})
  }, [plugin.id, setPresets])

  async function handleSave() {
    if (!newName.trim()) return
    setSaving(true); setError('')
    try {
      const saved = await window.electronAPI?.pluginSavePreset(plugin.id, newName.trim(), {})
      if (saved) {
        const updated = await window.electronAPI?.pluginListPresets(plugin.id) as PluginPreset[]
        setPresets(plugin.id, updated)
        setNewName('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(presetId: string) {
    await window.electronAPI?.pluginDeletePreset(plugin.id, presetId)
    const updated = await window.electronAPI?.pluginListPresets(plugin.id) as PluginPreset[]
    setPresets(plugin.id, updated)
  }

  async function handleRename(presetId: string) {
    if (!renameVal.trim()) return
    await window.electronAPI?.pluginRenamePreset(plugin.id, presetId, renameVal.trim())
    const updated = await window.electronAPI?.pluginListPresets(plugin.id) as PluginPreset[]
    setPresets(plugin.id, updated)
    setRenaming(null)
  }

  async function handleLoad(presetId: string) {
    const result = await window.electronAPI?.pluginLoadPreset(plugin.id, presetId)
    if (result) {
      // In a real integration, send preset data to the plugin instance
      console.info('[Preset] loaded', result.data)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)' }}>
      <div className="w-[420px] rounded-2xl overflow-hidden flex flex-col" style={{ background: '#0c0c14', border: '1px solid #1c1c2e', maxHeight: '80vh' }}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 h-10 shrink-0" style={{ borderBottom: '1px solid #1c1c2e', background: '#0f0f1a' }}>
          <span className="text-xs font-semibold flex-1" style={{ color: '#94a3b8' }}>Presets — {plugin.name}</span>
          <button onClick={onClose} style={{ color: '#475569', fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>

        {/* Save new preset */}
        <div className="p-3 shrink-0" style={{ borderBottom: '1px solid #1c1c2e' }}>
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
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-opacity"
              style={{ background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.35)', color: '#a855f7', opacity: (!newName.trim() || saving) ? 0.5 : 1 }}
            >
              {saving ? '…' : '+ Save'}
            </button>
          </div>
          {error && <p className="text-[10px] mt-1" style={{ color: '#ef4444' }}>{error}</p>}
        </div>

        {/* Preset list */}
        <div className="flex-1 overflow-y-auto">
          {pluginPresets.length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: '#334155' }}>No presets saved yet.</p>
          )}
          {pluginPresets.map(p => (
            <div key={p.id} className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid #13131f' }}>
              {/* Factory badge */}
              {p.isFactory && (
                <span className="text-[8px] px-1.5 py-px rounded-full" style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)' }}>
                  Factory
                </span>
              )}

              {/* Name / rename */}
              {renaming === p.id ? (
                <input
                  autoFocus
                  value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(p.id); if (e.key === 'Escape') setRenaming(null) }}
                  className="flex-1 text-xs px-2 py-1 rounded-lg outline-none"
                  style={{ background: '#0f0f1a', border: '1px solid rgba(124,58,237,0.4)', color: '#e2e8f0', caretColor: '#7c3aed' }}
                />
              ) : (
                <span className="flex-1 text-xs truncate" style={{ color: '#94a3b8' }}>{p.name}</span>
              )}

              <span className="text-[9px]" style={{ color: '#334155' }}>
                {new Date(p.savedAt).toLocaleDateString()}
              </span>

              {/* Actions */}
              <div className="flex gap-1">
                <button onClick={() => handleLoad(p.id)} title="Load" className="w-6 h-6 rounded text-[10px] flex items-center justify-center"
                  style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>↓</button>
                <button onClick={() => { setRenaming(p.id); setRenameVal(p.name) }} title="Rename" className="w-6 h-6 rounded text-[10px] flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#475569' }}>✎</button>
                {!p.isFactory && (
                  <button onClick={() => handleDelete(p.id)} title="Delete" className="w-6 h-6 rounded text-[10px] flex items-center justify-center"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>✕</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-2 text-[10px] shrink-0" style={{ borderTop: '1px solid #1c1c2e', color: '#334155' }}>
          {pluginPresets.length} preset{pluginPresets.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}
