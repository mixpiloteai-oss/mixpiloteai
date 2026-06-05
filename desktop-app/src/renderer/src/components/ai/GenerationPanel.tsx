// ─── GenerationPanel.tsx ──────────────────────────────────────────────────────
// Full UI panel for AI MIDI/Automation generation.

import { useState, useEffect } from 'react'
import { useGenerationStore } from '../../store/generationStore'
import { useAIAssistantStore } from '../../store/aiAssistantStore'
import MiniPianoRoll from './MiniPianoRoll'
import type { GenerationTarget, GenerationRequest } from '../../audio/ai/MidiGenerationEngine'
import type { DrumStyle } from '../../audio/ai/DrumPatternLibrary'
import type { BasslineStyle } from '../../audio/ai/BasslineGenerator'
import type { MelodyContour } from '../../audio/ai/MelodyGenerator'
import type { AutomationType, AutomationCurve } from '../../audio/ai/AutomationGenerator'

const TARGETS: { id: GenerationTarget; label: string }[] = [
  { id: 'drums',              label: 'Drums' },
  { id: 'bassline',           label: 'Bassline' },
  { id: 'melody',             label: 'Melody' },
  { id: 'chords',             label: 'Chords' },
  { id: 'transition_buildup', label: 'Buildup' },
  { id: 'automation',         label: 'Automation' },
]

const DRUM_STYLES: DrumStyle[] = [
  'four-on-the-floor', 'breakbeat', 'trap', 'dnb',
  'reggaeton', 'afrobeat', 'boom-bap', 'house', 'techno', 'tribe',
]

const BASS_STYLES: BasslineStyle[] = [
  'root_only', 'walking', 'syncopated', 'groove', 'arpeggio',
]

const CONTOURS: MelodyContour[] = [
  'arch', 'ascending', 'descending', 'neighbor', 'random_walk',
]

const AUTOMATION_TYPES: AutomationType[] = [
  'filter_sweep_up', 'filter_sweep_down',
  'volume_swell_in', 'volume_swell_out',
  'vibrato', 'tremolo', 'pan_lfo',
  'reverb_buildup', 'pitch_riser',
]

function AutomationPreview({ curve }: { curve: AutomationCurve }) {
  if (curve.points.length === 0) return null
  const W = 400
  const H = 80
  const pad = 4

  const xs = curve.points.map(p => pad + (p.beat / (curve.bars * 4)) * (W - pad * 2))
  const ys = curve.points.map(p => H - pad - p.value * (H - pad * 2))

  const d = xs
    .map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i]!.toFixed(1)}`)
    .join(' ')

  return (
    <svg width={W} height={H} style={{ background: '#1a1a2e', borderRadius: 6, display: 'block' }}>
      <path d={d} fill="none" stroke="#10b981" strokeWidth={2} />
    </svg>
  )
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export default function GenerationPanel() {
  const store    = useGenerationStore()
  const aiStore  = useAIAssistantStore()

  const [target,         setTarget]         = useState<GenerationTarget>('drums')
  const [bars,           setBars]           = useState(2)
  const [drumStyle,      setDrumStyle]      = useState<DrumStyle>('four-on-the-floor')
  const [bassStyle,      setBassStyle]      = useState<BasslineStyle>('root_only')
  const [contour,        setContour]        = useState<MelodyContour>('random_walk')
  const [automationType, setAutomationType] = useState<AutomationType>('filter_sweep_up')
  const [lastSeed,       setLastSeed]       = useState<number | null>(null)

  useEffect(() => {
    store.loadSuggestions()
  }, [aiStore.lastAnalysis])

  const analysis = aiStore.lastAnalysis

  function buildRequest(): GenerationRequest {
    const key = analysis?.detectedKey
      ? { root: analysis.detectedKey.root, mode: analysis.detectedKey.mode }
      : { root: 0, mode: 'major' as const }

    return {
      target,
      bars,
      style:           analysis?.style ?? 'unknown',
      key,
      bpm:             analysis?.bpm ?? 120,
      drumStyle:       target === 'drums' || target === 'transition_buildup' || target === 'transition_drop' ? drumStyle : undefined,
      bassStyle:       target === 'bassline' ? bassStyle : undefined,
      melodyContour:   target === 'melody'   ? contour   : undefined,
      automationType:  target === 'automation' ? automationType : undefined,
      automationShape: target === 'automation' ? 'linear' : undefined,
    }
  }

  async function handleGenerate() {
    const req = buildRequest()
    const seed = Date.now() & 0xffffffff
    setLastSeed(seed)
    await store.generate({ ...req, seed })
  }

  async function handleRegenerate() {
    const seed = Date.now() & 0xffffffff
    setLastSeed(seed)
    await store.regenerate()
  }

  const recentHistory = store.history.slice(0, 5)

  return (
    <div style={{
      background: '#0f0f1a',
      color: '#e2e8f0',
      padding: 16,
      borderRadius: 8,
      fontFamily: 'system-ui, sans-serif',
      width: 440,
      maxHeight: '90vh',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>AI Generation</h2>
        {lastSeed !== null && (
          <span style={{ fontSize: 11, color: '#64748b' }}>seed: {lastSeed}</span>
        )}
      </div>

      {/* Context bar */}
      {analysis && (
        <div style={{
          background: '#1e1e3f',
          borderRadius: 6,
          padding: '8px 12px',
          marginBottom: 12,
          fontSize: 12,
          color: '#94a3b8',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <span><strong style={{ color: '#e2e8f0' }}>BPM</strong> {analysis.bpm}</span>
          <span><strong style={{ color: '#e2e8f0' }}>Key</strong> {analysis.detectedKey?.name ?? '—'}</span>
          <span><strong style={{ color: '#e2e8f0' }}>Style</strong> {analysis.style}</span>
          <span><strong style={{ color: '#e2e8f0' }}>Energy</strong> {(analysis.energy * 100).toFixed(0)}%</span>
        </div>
      )}

      {/* Smart suggestions */}
      {store.suggestions.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Smart suggestions</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {store.suggestions.map((sug, i) => (
              <button
                key={i}
                onClick={() => store.generate(sug)}
                disabled={store.generating}
                style={{
                  background: '#1e3a5f',
                  color: '#7dd3fc',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                  opacity: store.generating ? 0.5 : 1,
                }}
              >
                {sug.target}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Target selector */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Target</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TARGETS.map(t => (
            <button
              key={t.id}
              onClick={() => setTarget(t.id)}
              style={{
                background: target === t.id ? '#7c3aed' : '#1e1e3f',
                color: target === t.id ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: 4,
                padding: '5px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Style controls */}
      {(target === 'drums' || target === 'transition_buildup' || target === 'transition_drop') && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#94a3b8' }}>Drum Style</label>
          <select
            value={drumStyle}
            onChange={e => setDrumStyle(e.target.value as DrumStyle)}
            style={{ display: 'block', marginTop: 4, width: '100%', background: '#1e1e3f', color: '#e2e8f0', border: 'none', borderRadius: 4, padding: 6, fontSize: 12 }}
          >
            {DRUM_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {target === 'bassline' && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#94a3b8' }}>Bass Style</label>
          <select
            value={bassStyle}
            onChange={e => setBassStyle(e.target.value as BasslineStyle)}
            style={{ display: 'block', marginTop: 4, width: '100%', background: '#1e1e3f', color: '#e2e8f0', border: 'none', borderRadius: 4, padding: 6, fontSize: 12 }}
          >
            {BASS_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {target === 'melody' && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#94a3b8' }}>Contour</label>
          <select
            value={contour}
            onChange={e => setContour(e.target.value as MelodyContour)}
            style={{ display: 'block', marginTop: 4, width: '100%', background: '#1e1e3f', color: '#e2e8f0', border: 'none', borderRadius: 4, padding: 6, fontSize: 12 }}
          >
            {CONTOURS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {target === 'automation' && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#94a3b8' }}>Automation Type</label>
          <select
            value={automationType}
            onChange={e => setAutomationType(e.target.value as AutomationType)}
            style={{ display: 'block', marginTop: 4, width: '100%', background: '#1e1e3f', color: '#e2e8f0', border: 'none', borderRadius: 4, padding: 6, fontSize: 12 }}
          >
            {AUTOMATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}

      {/* Bars slider */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: '#94a3b8' }}>
          Bars: <strong style={{ color: '#e2e8f0' }}>{bars}</strong>
        </label>
        <input
          type="range"
          min={1}
          max={8}
          value={bars}
          onChange={e => setBars(parseInt(e.target.value, 10))}
          style={{ display: 'block', width: '100%', marginTop: 4 }}
        />
      </div>

      {/* Generate / Regenerate buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={handleGenerate}
          disabled={store.generating}
          style={{
            flex: 1,
            background: '#7c3aed',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 16px',
            fontWeight: 700,
            cursor: store.generating ? 'not-allowed' : 'pointer',
            opacity: store.generating ? 0.6 : 1,
          }}
        >
          {store.generating ? 'Generating…' : 'Generate'}
        </button>
        {store.lastRequest !== null && (
          <button
            onClick={handleRegenerate}
            disabled={store.generating}
            style={{
              background: '#1e3a5f',
              color: '#7dd3fc',
              border: 'none',
              borderRadius: 6,
              padding: '8px 12px',
              cursor: store.generating ? 'not-allowed' : 'pointer',
              opacity: store.generating ? 0.6 : 1,
              fontSize: 12,
            }}
          >
            Regen
          </button>
        )}
      </div>

      {/* Error */}
      {store.error && (
        <div style={{ background: '#3b1111', color: '#f87171', borderRadius: 6, padding: 8, marginBottom: 12, fontSize: 12 }}>
          {store.error}
        </div>
      )}

      {/* Preview area */}
      {(store.previewPattern || store.previewAutomation) && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Preview</div>
          {store.previewPattern && (
            <MiniPianoRoll pattern={store.previewPattern} width={408} height={100} />
          )}
          {store.previewAutomation && (
            <AutomationPreview curve={store.previewAutomation} />
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={store.acceptPreview}
              style={{
                flex: 1,
                background: '#065f46',
                color: '#6ee7b7',
                border: 'none',
                borderRadius: 6,
                padding: '6px 12px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              ✓ Accept
            </button>
            <button
              onClick={store.rejectPreview}
              style={{
                flex: 1,
                background: '#3b1111',
                color: '#f87171',
                border: 'none',
                borderRadius: 6,
                padding: '6px 12px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              ✗ Reject
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {recentHistory.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Recent generations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recentHistory.map(entry => (
              <div
                key={entry.id}
                style={{
                  background: '#1e1e3f',
                  borderRadius: 6,
                  padding: '6px 10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 11,
                }}
              >
                <div>
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{entry.label}</span>
                  <span style={{ color: '#475569', marginLeft: 8 }}>{formatTime(entry.timestamp)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {entry.accepted ? (
                    <span style={{ background: '#065f46', color: '#6ee7b7', borderRadius: 3, padding: '1px 6px' }}>accepted</span>
                  ) : (
                    <span style={{ background: '#1e3a5f', color: '#7dd3fc', borderRadius: 3, padding: '1px 6px' }}>pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
