// ─── PluginInstancePanel ──────────────────────────────────────────────────────
// Shows all plugin instances loaded on a given track.
// Per-instance: name, PID, bypass toggle, remove button, preset strip, latency.
// Parameters are listed when available (populated via IPC on mount).
//
// NOTE: Real parameter names require the native VST3 SDK. Until then, generic
// "Param N" labels are shown for each parameter slot.

import { useState, useEffect, useCallback } from 'react'
import { usePluginStore, type PluginInstance, type PluginPreset } from '../../store/pluginStore'
import { PluginBridge } from '../../audio/PluginBridge'

// ── Param state (local to this panel) ────────────────────────────────────────

interface ParamState {
  id:    number
  name:  string
  value: number
  min:   number
  max:   number
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ParamSlider({ param, onChange }: {
  param:    ParamState
  onChange: (id: number, value: number) => void
}) {
  const pct = (param.value - param.min) / Math.max(0.001, param.max - param.min)
  return (
    <div className="flex items-center gap-2 py-1" style={{ borderBottom: '1px solid #0f0f1a' }}>
      <span className="text-[9px] truncate shrink-0" style={{ width: 80, color: '#475569' }}>{param.name}</span>
      <div className="flex-1 relative h-1 rounded-full" style={{ background: '#1c1c2e' }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full pointer-events-none"
          style={{ width: `${pct * 100}%`, background: 'rgba(124,58,237,0.6)' }}
        />
        <input
          type="range" min={0} max={1} step={0.001}
          value={pct}
          onChange={e => onChange(param.id, param.min + parseFloat(e.target.value) * (param.max - param.min))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          style={{ height: '100%' }}
        />
      </div>
      <span className="text-[9px] font-mono shrink-0 text-right" style={{ width: 36, color: '#334155' }}>
        {param.value.toFixed(2)}
      </span>
    </div>
  )
}

function PresetStrip({ instance, onClose }: { instance: PluginInstance; onClose: () => void }) {
  const { presets, setPresets } = usePluginStore()
  const pluginPresets = presets[instance.pluginId] ?? []
  const [newName, setNewName] = useState('')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    PluginBridge.listPresets(instance.pluginId).then(p => setPresets(instance.pluginId, p)).catch(() => {})
  }, [instance.pluginId, setPresets])

  async function handleSave() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const saved = await PluginBridge.savePreset(instance.pluginId, newName.trim(), {})
      if (saved) {
        const updated = await PluginBridge.listPresets(instance.pluginId)
        setPresets(instance.pluginId, updated)
        setNewName('')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleLoad(preset: PluginPreset) {
    const data = await PluginBridge.loadPreset(instance.pluginId, preset.id)
    if (!data) return
    for (const [idStr, val] of Object.entries(data)) {
      await PluginBridge.setParameter(instance.instanceId, parseInt(idStr, 10), val as number)
    }
  }

  return (
    <div className="px-2 pb-2 pt-1 shrink-0" style={{ borderBottom: '1px solid #1c1c2e', background: 'rgba(6,182,212,0.03)' }}>
      <div className="flex items-center gap-1 mb-1.5">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="Preset name…"
          className="flex-1 text-[9px] px-2 py-1 rounded outline-none"
          style={{ background: '#08080f', border: '1px solid #1c1c2e', color: '#e2e8f0', caretColor: '#7c3aed' }}
        />
        <button onClick={handleSave} disabled={!newName.trim() || saving}
          className="text-[9px] px-2 py-1 rounded shrink-0"
          style={{ background: 'rgba(124,58,237,0.15)', color: '#a855f7', border: '1px solid rgba(124,58,237,0.3)', opacity: (!newName.trim() || saving) ? 0.5 : 1 }}>
          Save
        </button>
        <button onClick={onClose} className="text-[9px] ml-1 shrink-0" style={{ color: '#334155' }}>✕</button>
      </div>
      <div className="flex flex-wrap gap-1">
        {pluginPresets.length === 0
          ? <span className="text-[9px]" style={{ color: '#334155' }}>No presets yet</span>
          : pluginPresets.map(p => (
              <button key={p.id} onClick={() => handleLoad(p)}
                className="text-[9px] px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid #1c1c2e' }}>
                {p.name}
              </button>
            ))
        }
      </div>
    </div>
  )
}

function InstanceCard({ instance, onUnload }: {
  instance: PluginInstance
  onUnload: (id: string) => Promise<void>
}) {
  const [bypassed,     setBypassed]    = useState(false)
  const [showPresets,  setShowPresets] = useState(false)
  const [params,       setParams]      = useState<ParamState[]>([])
  const [removing,     setRemoving]    = useState(false)

  // Seed synthetic params so the UI shows sliders immediately.
  // Real descriptors (names/ranges) require native VST3 SDK — marked below.
  useEffect(() => {
    if (instance.paramCount <= 0) return
    const count = Math.min(instance.paramCount, 16)
    const seed: ParamState[] = Array.from({ length: count }, (_, i) => ({
      id:    i,
      name:  `Param ${i + 1}`, // ← real names come from native SDK
      value: 0,
      min:   0,
      max:   1,
    }))
    setParams(seed)
    // Fetch current values for each param
    for (const p of seed) {
      PluginBridge.getParameter(instance.instanceId, p.id)
        .then(val => {
          if (val !== null) {
            setParams(prev => prev.map(x => x.id === p.id ? { ...x, value: val } : x))
          }
        })
        .catch(() => {})
    }
  }, [instance.instanceId, instance.paramCount])

  const handleParamChange = useCallback(async (paramId: number, value: number) => {
    setParams(prev => prev.map(p => p.id === paramId ? { ...p, value } : p))
    await PluginBridge.setParameter(instance.instanceId, paramId, value)
  }, [instance.instanceId])

  const handleRemove = useCallback(async () => {
    setRemoving(true)
    try {
      await onUnload(instance.instanceId)
    } finally {
      setRemoving(false)
    }
  }, [instance.instanceId, onUnload])

  const lat = instance.latencySamples ?? 0

  return (
    <div className="rounded-xl overflow-hidden mb-2"
      style={{ background: '#0c0c14', border: '1px solid #1c1c2e', opacity: bypassed ? 0.65 : 1 }}>

      {/* Header */}
      <div className="flex items-center gap-1.5 px-2 h-8 shrink-0"
        style={{ background: '#0f0f1a', borderBottom: '1px solid #1c1c2e' }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: bypassed ? '#f59e0b' : '#10b981' }} />
        <span className="flex-1 text-xs font-medium truncate" style={{ color: '#94a3b8' }}>{instance.name}</span>
        <span className="text-[9px] font-mono shrink-0" style={{ color: '#334155' }}>PID {instance.pid}</span>

        {/* Bypass */}
        <button onClick={() => setBypassed(b => !b)}
          className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
          style={{
            background: bypassed ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
            color:      bypassed ? '#f59e0b' : '#475569',
            border:     `1px solid ${bypassed ? 'rgba(245,158,11,0.35)' : '#1c1c2e'}`,
          }}>
          {bypassed ? 'BYP' : 'ON'}
        </button>

        {/* Presets toggle */}
        <button onClick={() => setShowPresets(s => !s)}
          className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
          style={{
            background: showPresets ? 'rgba(6,182,212,0.15)' : 'rgba(6,182,212,0.06)',
            color:      '#06b6d4',
            border:     '1px solid rgba(6,182,212,0.2)',
          }}>
          Presets
        </button>

        {/* Remove */}
        <button onClick={handleRemove} disabled={removing}
          className="w-5 h-5 flex items-center justify-center rounded text-[10px]"
          style={{ background: 'rgba(239,68,68,0.08)', color: removing ? '#334155' : '#ef4444' }}>
          {removing ? '…' : '✕'}
        </button>
      </div>

      {/* Preset strip */}
      {showPresets && <PresetStrip instance={instance} onClose={() => setShowPresets(false)} />}

      {/* Params */}
      <div className="px-2 py-1">
        {params.length === 0 ? (
          <p className="text-[9px] py-2 text-center" style={{ color: '#334155' }}>
            {instance.paramCount > 0
              ? `${instance.paramCount} parameters — native names require VST3 SDK`
              : 'No parameters'}
          </p>
        ) : (
          <>
            {params.map(p => (
              <ParamSlider key={p.id} param={p} onChange={handleParamChange} />
            ))}
            {instance.paramCount > 16 && (
              <p className="text-[9px] pt-1 text-center" style={{ color: '#334155' }}>
                +{instance.paramCount - 16} more
              </p>
            )}
          </>
        )}
      </div>

      {/* Latency footer */}
      <div className="px-2 pb-1.5">
        <span className="text-[9px]" style={{ color: '#1e293b' }}>
          Latency {lat} samples{lat > 0 ? ` (${(lat / 48).toFixed(1)} ms @ 48 kHz)` : ''}
        </span>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface Props {
  /** Filter instances to a specific track. Pass undefined to show all. */
  trackId?: string
}

export default function PluginInstancePanel({ trackId }: Props) {
  const { instances, removeInstance } = usePluginStore()

  const visible = trackId
    ? instances.filter(i => i.trackId === trackId)
    : instances

  const handleUnload = useCallback(async (instanceId: string) => {
    await PluginBridge.unload(instanceId)
    if (trackId) await PluginBridge.removeFromChain(instanceId, trackId)
    removeInstance(instanceId)
  }, [removeInstance, trackId])

  if (visible.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: 56, color: '#334155', fontSize: 11 }}>
        No plugins — load one from the Plugin Browser
      </div>
    )
  }

  return (
    <div className="p-2">
      {visible.map(inst => (
        <InstanceCard key={inst.instanceId} instance={inst} onUnload={handleUnload} />
      ))}
    </div>
  )
}
