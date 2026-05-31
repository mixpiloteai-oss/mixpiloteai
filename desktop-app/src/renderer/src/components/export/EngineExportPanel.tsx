// ─── EngineExportPanel ────────────────────────────────────────────────────────
// Professional export dialog using the new ExportEngine / ExportQueue architecture.
// Tabs: Settings | Queue | Loudness

import { useState } from 'react'
import { useEngineExportStore } from '../../store/engineExportStore'
import type { ExportOptions } from '../../audio/export/ExportQueue'
import type { ExportFormat } from '../../audio/export/FlacEncoderPcm'
import type { DitherType } from '../../audio/export/DitherEngine'
import { ExportQueuePanel } from './ExportQueuePanel'
import { LoudnessMeterDisplay } from './LoudnessMeterDisplay'
import type { LoudnessMeasurement } from '../../audio/export/LoudnessMeter'

// ── Tab definitions ───────────────────────────────────────────────────────────

type Tab = 'settings' | 'queue' | 'loudness'

// ── Chip selector ─────────────────────────────────────────────────────────────

function ChipGroup<T extends string>({
  options, value, onChange, label,
}: {
  options: Array<{ value: T; label: string }>
  value:   T
  onChange: (v: T) => void
  label:   string
}) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <Label>{label}</Label>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              border: `1px solid ${value === opt.value ? '#6366f1' : '#1e293b'}`,
              background: value === opt.value ? '#6366f122' : 'transparent',
              color: value === opt.value ? '#818cf8' : '#64748b',
              fontSize: '12px', cursor: 'pointer', fontWeight: 600,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569', marginBottom: '6px', fontWeight: 600 }}>
      {children}
    </p>
  )
}

function Select<T extends string | number>({ label, value, options, onChange }: {
  label:   string
  value:   T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <Label>{label}</Label>
      <select
        value={String(value)}
        onChange={e => onChange(options.find(o => String(o.value) === e.target.value)!.value)}
        style={{
          background: '#0f172a', color: '#e2e8f0', border: '1px solid #1e293b',
          borderRadius: '6px', padding: '6px 8px', fontSize: '12px', width: '100%',
        }}
      >
        {options.map(opt => (
          <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
      <span style={{ fontSize: '12px', color: '#94a3b8' }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: '36px', height: '20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
          background: value ? '#6366f1' : '#1e293b',
          position: 'relative', transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: '2px', left: value ? '18px' : '2px',
          width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  )
}

// ── Settings tab ──────────────────────────────────────────────────────────────

type ExportType = 'master' | 'stems' | 'selection' | 'loop'

function SettingsTab({ options, onChange }: {
  options:  ExportOptions
  onChange: (opts: Partial<ExportOptions>) => void
}) {
  const [exportType, setExportType] = useState<ExportType>('master')

  const formats: Array<{ value: ExportFormat; label: string }> = [
    { value: 'wav',  label: 'WAV' },
    { value: 'flac', label: 'FLAC' },
    { value: 'mp3',  label: 'MP3' },
  ]

  const sampleRates: Array<{ value: ExportOptions['sampleRate']; label: string }> = [
    { value: 44100, label: '44100 Hz' },
    { value: 48000, label: '48000 Hz' },
    { value: 88200, label: '88200 Hz' },
    { value: 96000, label: '96000 Hz' },
  ]

  const bitDepths: Array<{ value: ExportOptions['bitDepth']; label: string }> = [
    { value: 16, label: '16-bit' },
    { value: 24, label: '24-bit' },
    { value: 32, label: '32-bit Float' },
  ]

  const mp3Bitrates: Array<{ value: 128 | 192 | 256 | 320; label: string }> = [
    { value: 128, label: '128 kbps' },
    { value: 192, label: '192 kbps' },
    { value: 256, label: '256 kbps' },
    { value: 320, label: '320 kbps' },
  ]

  const ditherTypes: Array<{ value: DitherType; label: string }> = [
    { value: 'none',        label: 'None' },
    { value: 'tpdf',        label: 'TPDF' },
    { value: 'rectangular', label: 'Rectangular' },
  ]

  const exportTypes: Array<{ value: ExportType; label: string }> = [
    { value: 'master',    label: 'Master Mix' },
    { value: 'stems',     label: 'Stems' },
    { value: 'selection', label: 'Selection' },
    { value: 'loop',      label: 'Loop' },
  ]

  return (
    <div>
      <ChipGroup
        label="Format"
        options={formats}
        value={options.format}
        onChange={(v) => onChange({ format: v })}
      />

      <Select
        label="Sample Rate"
        value={options.sampleRate}
        options={sampleRates}
        onChange={(v) => onChange({ sampleRate: v })}
      />

      <Select
        label="Bit Depth"
        value={options.bitDepth}
        options={bitDepths}
        onChange={(v) => onChange({ bitDepth: v })}
      />

      {options.format === 'mp3' && (
        <Select
          label="MP3 Bitrate"
          value={options.bitrate ?? 320}
          options={mp3Bitrates}
          onChange={(v) => onChange({ bitrate: v })}
        />
      )}

      {options.bitDepth < 32 && (
        <Select
          label="Dither"
          value={options.ditherType}
          options={ditherTypes}
          onChange={(v) => onChange({ ditherType: v })}
        />
      )}

      <Toggle
        label="Normalization"
        value={options.normalization}
        onChange={(v) => onChange({ normalization: v })}
      />

      <Toggle
        label="Master Chain (Limiter + Clipper)"
        value={options.applyMasterChain}
        onChange={(v) => onChange({ applyMasterChain: v })}
      />

      <ChipGroup
        label="Export Type"
        options={exportTypes}
        value={exportType}
        onChange={setExportType}
      />

      <div style={{ marginBottom: '12px' }}>
        <Label>Output Directory</Label>
        <input
          value={options.outputDirectory}
          onChange={e => onChange({ outputDirectory: e.target.value })}
          placeholder="/path/to/output"
          style={{
            background: '#0f172a', color: '#e2e8f0', border: '1px solid #1e293b',
            borderRadius: '6px', padding: '6px 8px', fontSize: '12px', width: '100%', boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Label>File Name Template</Label>
        <input
          value={options.fileNameTemplate}
          onChange={e => onChange({ fileNameTemplate: e.target.value })}
          placeholder="{projectName}_{format}_{sampleRate}Hz"
          style={{
            background: '#0f172a', color: '#e2e8f0', border: '1px solid #1e293b',
            borderRadius: '6px', padding: '6px 8px', fontSize: '12px', width: '100%', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Export buttons */}
      <ExportButtons exportType={exportType} />
    </div>
  )
}

function ExportButtons({ exportType }: { exportType: ExportType }) {
  const { exportMaster, exportStems, isRunning } = useEngineExportStore()

  const handleExport = () => {
    const fakeTracks: import('../../audio/export/OfflineRenderer').RenderTrack[] = []
    const sampleRate = 44100
    const totalSamples = 44100 * 4  // 4 seconds default

    if (exportType === 'stems') {
      void exportStems(fakeTracks, sampleRate, totalSamples, 120)
    } else {
      void exportMaster(fakeTracks, sampleRate, totalSamples, 120)
    }
  }

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        onClick={handleExport}
        disabled={isRunning}
        style={{
          flex: 1, padding: '10px', borderRadius: '8px',
          background: isRunning ? '#1e293b' : '#6366f1',
          color: isRunning ? '#475569' : '#fff',
          border: 'none', fontSize: '13px', fontWeight: 700, cursor: isRunning ? 'default' : 'pointer',
        }}
      >
        {isRunning ? 'Exporting…' : exportType === 'stems' ? 'Export Stems' : 'Export'}
      </button>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function EngineExportPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('settings')
  const [loudness, setLoudness]   = useState<LoudnessMeasurement | null>(null)
  const { defaultOptions, updateDefaultOptions } = useEngineExportStore()

  void setLoudness  // Updated when a render completes (connected externally)

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'settings', label: 'Settings' },
    { id: 'queue',    label: 'Queue' },
    { id: 'loudness', label: 'Loudness' },
  ]

  return (
    <div style={{
      background: '#080810',
      color: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif',
      minWidth: '360px',
      maxWidth: '480px',
      borderRadius: '12px',
      border: '1px solid #1c1c2e',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid #1c1c2e' }}>
        <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>
          Export Audio
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#475569' }}>
          Neurotek Studio — Professional Export Engine
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1c1c2e' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
              background: 'transparent',
              color: activeTab === tab.id ? '#818cf8' : '#475569',
              borderBottom: `2px solid ${activeTab === tab.id ? '#6366f1' : 'transparent'}`,
              fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: '16px', maxHeight: '600px', overflowY: 'auto' }}>
        {activeTab === 'settings' && (
          <SettingsTab
            options={defaultOptions}
            onChange={updateDefaultOptions}
          />
        )}
        {activeTab === 'queue' && <ExportQueuePanel />}
        {activeTab === 'loudness' && <LoudnessMeterDisplay measurement={loudness} />}
      </div>
    </div>
  )
}
