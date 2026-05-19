// ─── Export Panel ─────────────────────────────────────────────────────────────
// Full studio export UI: quality presets, format picker, metadata, stems, history

import { useState } from 'react'
import { useExport } from '../../hooks/useExport'
import { QUALITY_PRESETS, type ExportQualityPreset, type ExportFormat, type QualityConfig } from '../../audio/export/ExportPipeline'
import type { StemDefinition } from '../../audio/export/StemsExporter'
import type { NormMode } from '../../audio/export/Normalizer'
import type { DitherType } from '../../audio/export/Dithering'
import type { ExportHistoryEntry } from '../../store/exportStore'

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, d = 1) { return isFinite(n) ? n.toFixed(d) : '—' }
function msToSec(ms: number)   { return (ms / 1000).toFixed(2) + 's' }

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#0c0c14', border: '1px solid #1c1c2e', ...style }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: '#475569' }}>
      {children}
    </p>
  )
}

// ── Preset Picker ─────────────────────────────────────────────────────────────

const PRESET_META: Record<ExportQualityPreset, { icon: string; color: string; desc: string }> = {
  'master-ready': { icon: '♛', color: '#a855f7', desc: '32-bit float WAV · full dynamic range · no limiting' },
  'streaming':    { icon: '⏵', color: '#06b6d4', desc: '16-bit WAV · LUFS −14 · noise-shaped dither · limiter' },
  'cd':           { icon: '◉', color: '#10b981', desc: '16-bit 44.1 kHz WAV · LUFS −14 · TPDF dither · RedBook' },
  'archive':      { icon: '⌁', color: '#f59e0b', desc: '24-bit FLAC · lossless · LUFS normalised' },
  'custom':       { icon: '⊛', color: '#ec4899', desc: 'Fully configurable format and processing chain' },
}

interface PresetPickerProps {
  value: ExportQualityPreset
  onChange: (p: ExportQualityPreset) => void
}

function PresetPicker({ value, onChange }: PresetPickerProps) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {(Object.keys(QUALITY_PRESETS) as ExportQualityPreset[]).map(preset => {
        const cfg  = QUALITY_PRESETS[preset]
        const meta = PRESET_META[preset]
        const active = value === preset
        return (
          <button
            key={preset}
            onClick={() => onChange(preset)}
            className="flex items-center gap-3 w-full text-left rounded-xl px-3 py-2.5 transition-all"
            style={{
              background: active ? `${meta.color}14` : 'transparent',
              border: `1px solid ${active ? meta.color + '50' : '#1c1c2e'}`,
            }}
          >
            <span className="text-base w-5 text-center" style={{ color: meta.color }}>{meta.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: active ? meta.color : '#e2e8f0' }}>
                  {cfg.label}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: '#1c1c2e', color: '#475569' }}>
                  {cfg.format.toUpperCase()}
                </span>
              </div>
              <span className="text-[10px]" style={{ color: '#475569' }}>{meta.desc}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Custom Config ─────────────────────────────────────────────────────────────

interface CustomConfigProps {
  config: QualityConfig
  onChange: (c: Partial<QualityConfig>) => void
}

function CustomConfig({ config, onChange }: CustomConfigProps) {
  return (
    <div className="space-y-3">
      {/* Format + Bit Depth */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] mb-1" style={{ color: '#475569' }}>Format</label>
          <select
            value={config.format}
            onChange={e => onChange({ format: e.target.value as ExportFormat })}
            className="w-full text-xs px-2 py-1.5 rounded-lg outline-none"
            style={{ background: '#0f0f1a', border: '1px solid #1c1c2e', color: '#e2e8f0' }}
          >
            <option value="wav">WAV</option>
            <option value="mp3">MP3</option>
            <option value="flac">FLAC</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] mb-1" style={{ color: '#475569' }}>Bit Depth</label>
          <select
            value={config.bitDepth}
            onChange={e => onChange({ bitDepth: Number(e.target.value) as 16 | 24 | 32 })}
            className="w-full text-xs px-2 py-1.5 rounded-lg outline-none"
            style={{ background: '#0f0f1a', border: '1px solid #1c1c2e', color: '#e2e8f0' }}
          >
            <option value={16}>16-bit</option>
            <option value={24}>24-bit</option>
            <option value={32}>32-bit float</option>
          </select>
        </div>
      </div>

      {/* Sample Rate + MP3 Bitrate */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] mb-1" style={{ color: '#475569' }}>Sample Rate</label>
          <select
            value={config.sampleRate}
            onChange={e => onChange({ sampleRate: Number(e.target.value) })}
            className="w-full text-xs px-2 py-1.5 rounded-lg outline-none"
            style={{ background: '#0f0f1a', border: '1px solid #1c1c2e', color: '#e2e8f0' }}
          >
            <option value={44100}>44,100 Hz</option>
            <option value={48000}>48,000 Hz</option>
            <option value={88200}>88,200 Hz</option>
            <option value={96000}>96,000 Hz</option>
          </select>
        </div>
        {config.format === 'mp3' && (
          <div>
            <label className="block text-[10px] mb-1" style={{ color: '#475569' }}>MP3 Bitrate</label>
            <select
              value={config.mp3Bitrate ?? 320}
              onChange={e => onChange({ mp3Bitrate: Number(e.target.value) as 128 | 192 | 256 | 320 })}
              className="w-full text-xs px-2 py-1.5 rounded-lg outline-none"
              style={{ background: '#0f0f1a', border: '1px solid #1c1c2e', color: '#e2e8f0' }}
            >
              <option value={128}>128 kbps</option>
              <option value={192}>192 kbps</option>
              <option value={256}>256 kbps</option>
              <option value={320}>320 kbps</option>
            </select>
          </div>
        )}
      </div>

      {/* Normalization */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] mb-1" style={{ color: '#475569' }}>Normalize</label>
          <select
            value={config.normMode}
            onChange={e => onChange({ normMode: e.target.value as NormMode })}
            className="w-full text-xs px-2 py-1.5 rounded-lg outline-none"
            style={{ background: '#0f0f1a', border: '1px solid #1c1c2e', color: '#e2e8f0' }}
          >
            <option value="none">None</option>
            <option value="peak">Peak</option>
            <option value="lufs">LUFS (BS.1770-4)</option>
            <option value="truepeak">True Peak</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] mb-1" style={{ color: '#475569' }}>Target (dB / LUFS)</label>
          <input
            type="number"
            value={config.normTargetDB}
            step={0.1} min={-36} max={0}
            onChange={e => onChange({ normTargetDB: Number(e.target.value) })}
            className="w-full text-xs px-2 py-1.5 rounded-lg outline-none"
            style={{ background: '#0f0f1a', border: '1px solid #1c1c2e', color: '#e2e8f0' }}
          />
        </div>
      </div>

      {/* Dither */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] mb-1" style={{ color: '#475569' }}>Dither</label>
          <select
            value={config.dither}
            onChange={e => onChange({ dither: e.target.value as DitherType })}
            className="w-full text-xs px-2 py-1.5 rounded-lg outline-none"
            style={{ background: '#0f0f1a', border: '1px solid #1c1c2e', color: '#e2e8f0' }}
          >
            <option value="none">None</option>
            <option value="tpdf">TPDF</option>
            <option value="ns">Noise-Shaped (Wannamaker)</option>
            <option value="flat">Flat</option>
          </select>
        </div>
        <div className="flex items-end pb-1.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.gpuLimiter}
              onChange={e => onChange({ gpuLimiter: e.target.checked })}
              className="w-3.5 h-3.5 rounded"
            />
            <span className="text-[10px]" style={{ color: '#94a3b8' }}>GPU True-Peak Limiter</span>
          </label>
        </div>
      </div>
    </div>
  )
}

// ── Metadata Form ─────────────────────────────────────────────────────────────

interface MetadataFormProps {
  title: string; artist: string; album: string; comment: string
  onChange: (field: string, val: string) => void
}

function MetadataForm({ title, artist, album, comment, onChange }: MetadataFormProps) {
  const fields = [
    { key: 'title',   label: 'Title',   value: title   },
    { key: 'artist',  label: 'Artist',  value: artist  },
    { key: 'album',   label: 'Album',   value: album   },
    { key: 'comment', label: 'Comment', value: comment },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {fields.map(f => (
        <div key={f.key}>
          <label className="block text-[10px] mb-1" style={{ color: '#475569' }}>{f.label}</label>
          <input
            type="text"
            value={f.value}
            onChange={e => onChange(f.key, e.target.value)}
            placeholder={f.label}
            className="w-full text-xs px-2 py-1.5 rounded-lg outline-none"
            style={{ background: '#0f0f1a', border: '1px solid #1c1c2e', color: '#e2e8f0' }}
          />
        </div>
      ))}
    </div>
  )
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

const PHASE_LABEL: Record<string, string> = {
  rendering:   'Offline Render',
  gpu:         'GPU Processing',
  normalizing: 'Normalizing',
  encoding:    'Encoding',
}

function ProgressBar({ pct, phase, label }: { pct: number; phase: string; label?: string }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[10px]" style={{ color: '#94a3b8' }}>{label ?? PHASE_LABEL[phase] ?? phase}</span>
        <span className="text-[10px] font-mono" style={{ color: '#475569' }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1c1c2e' }}>
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #7c3aed, #06b6d4)' }}
        />
      </div>
    </div>
  )
}

// ── Stems Builder ─────────────────────────────────────────────────────────────

const DEFAULT_STEMS: StemDefinition[] = [
  { trackId: 'kick',   trackName: 'Kick',    color: '#7c3aed' },
  { trackId: 'snare',  trackName: 'Snare',   color: '#06b6d4' },
  { trackId: 'bass',   trackName: 'Bass',    color: '#10b981' },
  { trackId: 'synth1', trackName: 'Synth 1', color: '#f59e0b' },
  { trackId: 'fx',     trackName: 'FX',      color: '#ec4899' },
]

interface StemBuilderProps {
  stems: StemDefinition[]
  onToggle: (id: string) => void
  selected: Set<string>
}

function StemBuilder({ stems, onToggle, selected }: StemBuilderProps) {
  return (
    <div className="space-y-1.5">
      {stems.map(s => (
        <label key={s.trackId} className="flex items-center gap-2.5 cursor-pointer group">
          <div
            onClick={() => onToggle(s.trackId)}
            className="w-4 h-4 rounded flex items-center justify-center cursor-pointer text-[9px] font-bold transition-all"
            style={{
              background: selected.has(s.trackId) ? s.color : 'transparent',
              border: `1px solid ${selected.has(s.trackId) ? s.color : '#2e2e42'}`,
              color: '#fff',
            }}
          >
            {selected.has(s.trackId) ? '✓' : ''}
          </div>
          <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
          <span className="text-xs" style={{ color: selected.has(s.trackId) ? '#e2e8f0' : '#475569' }}>
            {s.trackName}
          </span>
        </label>
      ))}
    </div>
  )
}

// ── History List ──────────────────────────────────────────────────────────────

function HistoryList({ entries, onRemove, onRedownload }: {
  entries: ExportHistoryEntry[]
  onRemove: (id: string) => void
  onRedownload: (entry: ExportHistoryEntry) => void
}) {
  if (entries.length === 0) {
    return <p className="text-[11px] text-center py-4" style={{ color: '#334155' }}>No exports yet</p>
  }
  return (
    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
      {entries.map(e => (
        <div key={e.id} className="rounded-xl px-3 py-2.5 flex items-center gap-3"
          style={{ background: '#08080f', border: '1px solid #1c1c2e' }}>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: '#e2e8f0' }}>{e.filename}</p>
            <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>
              {e.format.toUpperCase()} · {e.sizeMB} MB · LUFS {fmt(e.lufs)} · TP {fmt(e.truePeakDB)} dBTP
              {e.gpuUsed && ' · GPU'} · {msToSec(e.renderMs)}
            </p>
          </div>
          <button
            onClick={() => onRedownload(e)}
            className="text-[10px] px-2 py-1 rounded-lg transition-colors"
            style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)' }}
          >
            ↓
          </button>
          <button
            onClick={() => onRemove(e.id)}
            className="text-[10px] px-2 py-1 rounded-lg transition-colors"
            style={{ background: 'transparent', color: '#475569', border: '1px solid #1c1c2e' }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

type Tab = 'master' | 'stems' | 'history'

export default function ExportPanel() {
  const {
    status, phase, progress, error, lastResult,
    stemsDone, stemsTotal, stemsCurrent,
    history, runExport, runStemsExport, reset, removeHistory,
  } = useExport()

  const [tab, setTab]                   = useState<Tab>('master')
  const [preset, setPreset]             = useState<ExportQualityPreset>('streaming')
  const [customConfig, setCustomConfig] = useState(QUALITY_PRESETS['custom'])
  const [metaTitle, setMetaTitle]       = useState('')
  const [metaArtist, setMetaArtist]     = useState('')
  const [metaAlbum, setMetaAlbum]       = useState('')
  const [metaComment, setMetaComment]   = useState('')
  const [selectedStems, setSelectedStems] = useState<Set<string>>(
    new Set(DEFAULT_STEMS.map(s => s.trackId))
  )

  const running = status === 'running'

  function handleMetaChange(field: string, val: string) {
    if (field === 'title')   setMetaTitle(val)
    if (field === 'artist')  setMetaArtist(val)
    if (field === 'album')   setMetaAlbum(val)
    if (field === 'comment') setMetaComment(val)
  }

  function toggleStem(id: string) {
    setSelectedStems(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleRedownload(entry: ExportHistoryEntry) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(entry.blob)
    a.download = entry.filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000)
  }

  async function handleExport() {
    if (running) return
    reset()
    const effectivePreset = preset
    const config = preset === 'custom' ? customConfig : undefined
    await runExport({
      projectName: 'Dark Hardtek Session',
      durationSec: 128,   // TODO: wire from projectStore
      preset: effectivePreset,
      config,
      metadata: {
        title:   metaTitle   || undefined,
        artist:  metaArtist  || undefined,
        album:   metaAlbum   || undefined,
        comment: metaComment || undefined,
      },
    })
  }

  async function handleStemsExport() {
    if (running) return
    reset()
    const stems = DEFAULT_STEMS.filter(s => selectedStems.has(s.trackId))
    if (stems.length === 0) return
    const cfg = QUALITY_PRESETS[preset]
    await runStemsExport({
      projectName: 'Dark Hardtek Session',
      stems,
      options: {
        format:       cfg.format,
        quality:      preset,
        normMode:     cfg.normMode,
        normTargetDB: cfg.normTargetDB,
        dither:       cfg.dither,
        bitDepth:     cfg.bitDepth,
        sampleRate:   cfg.sampleRate,
        durationSec:  128,
      },
    })
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'master',  label: 'Master' },
    { id: 'stems',   label: 'Stems' },
    { id: 'history', label: 'History' },
  ]

  return (
    <div className="h-full overflow-auto p-4 space-y-4" style={{ background: '#08080f' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold" style={{ color: '#e2e8f0' }}>Export Studio</h2>
          <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>
            Mastering-grade audio export
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 rounded-xl p-1" style={{ background: '#0c0c14', border: '1px solid #1c1c2e' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
              style={{
                background: tab === t.id ? 'rgba(124,58,237,0.2)' : 'transparent',
                color:      tab === t.id ? '#a855f7' : '#475569',
                border:     tab === t.id ? '1px solid rgba(124,58,237,0.35)' : '1px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── MASTER TAB ─────────────────────────────────────────────────────── */}
      {tab === 'master' && (
        <>
          <Card>
            <SectionTitle>Quality Preset</SectionTitle>
            <PresetPicker value={preset} onChange={setPreset} />
          </Card>

          {preset === 'custom' && (
            <Card>
              <SectionTitle>Custom Settings</SectionTitle>
              <CustomConfig
                config={customConfig}
                onChange={patch => setCustomConfig(c => ({ ...c, ...patch }))}
              />
            </Card>
          )}

          <Card>
            <SectionTitle>Metadata (BWF + ID3)</SectionTitle>
            <MetadataForm
              title={metaTitle} artist={metaArtist}
              album={metaAlbum} comment={metaComment}
              onChange={handleMetaChange}
            />
          </Card>

          {/* Progress */}
          {(running || status === 'done' || status === 'error') && (
            <Card>
              <SectionTitle>Export Progress</SectionTitle>
              <div className="space-y-3">
                <ProgressBar pct={progress} phase={phase} />

                {status === 'error' && (
                  <p className="text-[11px] px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {error}
                  </p>
                )}

                {status === 'done' && lastResult && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[
                      { label: 'LUFS',        value: fmt(lastResult.lufs)        },
                      { label: 'True Peak',   value: fmt(lastResult.truePeakDB) + ' dBTP' },
                      { label: 'Peak',        value: fmt(lastResult.peakdBFS) + ' dBFS' },
                      { label: 'Size',        value: lastResult.sizeMB + ' MB'   },
                      { label: 'Render Time', value: msToSec(lastResult.renderMs) },
                      { label: 'GPU',         value: lastResult.gpuUsed ? 'Yes' : 'No' },
                    ].map(m => (
                      <div key={m.label} className="rounded-lg p-2 text-center" style={{ background: '#08080f', border: '1px solid #1c1c2e' }}>
                        <p className="text-[11px] font-semibold font-mono" style={{ color: '#e2e8f0' }}>{m.value}</p>
                        <p className="text-[9px] mt-0.5" style={{ color: '#475569' }}>{m.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={running}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: running
                ? 'rgba(124,58,237,0.15)'
                : 'linear-gradient(135deg, #7c3aed, #06b6d4)',
              color: running ? '#475569' : '#fff',
              border: running ? '1px solid #2e2e42' : 'none',
              cursor: running ? 'not-allowed' : 'pointer',
            }}
          >
            {running ? `Exporting… ${progress}%` : '⬇ Export Master'}
          </button>
        </>
      )}

      {/* ── STEMS TAB ──────────────────────────────────────────────────────── */}
      {tab === 'stems' && (
        <>
          <Card>
            <SectionTitle>Select Stems</SectionTitle>
            <StemBuilder
              stems={DEFAULT_STEMS}
              selected={selectedStems}
              onToggle={toggleStem}
            />
            <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid #1c1c2e' }}>
              <span className="text-[10px]" style={{ color: '#475569' }}>
                {selectedStems.size} of {DEFAULT_STEMS.length} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedStems(new Set(DEFAULT_STEMS.map(s => s.trackId)))}
                  className="text-[10px] px-2 py-1 rounded-lg" style={{ color: '#475569' }}
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedStems(new Set())}
                  className="text-[10px] px-2 py-1 rounded-lg" style={{ color: '#475569' }}
                >
                  None
                </button>
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle>Stems Format</SectionTitle>
            <div className="flex gap-2">
              {(['wav', 'mp3', 'flac'] as const).map(f => {
                const active = QUALITY_PRESETS[preset].format === f
                return (
                  <button key={f}
                    onClick={() => {}}
                    className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: active ? 'rgba(124,58,237,0.15)' : '#0f0f1a',
                      color: active ? '#a855f7' : '#475569',
                      border: `1px solid ${active ? 'rgba(124,58,237,0.3)' : '#1c1c2e'}`,
                    }}
                  >
                    {f.toUpperCase()}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] mt-2" style={{ color: '#475569' }}>
              Using quality preset: <span style={{ color: '#94a3b8' }}>{QUALITY_PRESETS[preset].label}</span>
            </p>
          </Card>

          {/* Stems progress */}
          {running && (
            <Card>
              <SectionTitle>Stems Export</SectionTitle>
              <div className="space-y-2">
                <ProgressBar
                  pct={stemsTotal > 0 ? Math.round((stemsDone / stemsTotal) * 100) : 0}
                  phase="rendering"
                  label={`${stemsCurrent} (${stemsDone}/${stemsTotal})`}
                />
              </div>
            </Card>
          )}

          <button
            onClick={handleStemsExport}
            disabled={running || selectedStems.size === 0}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: running || selectedStems.size === 0
                ? 'rgba(124,58,237,0.15)'
                : 'linear-gradient(135deg, #7c3aed, #06b6d4)',
              color: running || selectedStems.size === 0 ? '#475569' : '#fff',
              border: running || selectedStems.size === 0 ? '1px solid #2e2e42' : 'none',
              cursor: running || selectedStems.size === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {running ? `Rendering stems… ${stemsDone}/${stemsTotal}` : `⬇ Export ${selectedStems.size} Stems`}
          </button>
        </>
      )}

      {/* ── HISTORY TAB ────────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Export History</SectionTitle>
            {history.length > 0 && (
              <button className="text-[10px]" style={{ color: '#334155' }}
                onClick={() => history.forEach(e => removeHistory(e.id))}>
                Clear all
              </button>
            )}
          </div>
          <HistoryList
            entries={history}
            onRemove={removeHistory}
            onRedownload={handleRedownload}
          />
        </Card>
      )}
    </div>
  )
}
