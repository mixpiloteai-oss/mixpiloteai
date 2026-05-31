// ─── DeepAnalysisPanel.tsx ────────────────────────────────────────────────────
// Tabbed panel showing deep AI analysis: Overview, Arrangement, Groove, Mix, Style.

import { useState, useRef, useEffect } from 'react'
import { useDeepAIStore } from '../../store/deepAIStore'
import type { MusicContext } from '../../audio/ai/MusicContextEngine'

type Tab = 'overview' | 'arrangement' | 'groove' | 'mix' | 'style'

const STYLE_COLORS: Record<string, string> = {
  house:        '#06b6d4',
  techno:       '#7c3aed',
  dnb:          '#ef4444',
  trap:         '#f59e0b',
  hiphop:       '#8b5cf6',
  ambient:      '#10b981',
  jazz:         '#ec4899',
  latin:        '#f97316',
  tribal:       '#84cc16',
  experimental: '#64748b',
  unknown:      '#374151',
}

const SECTION_COLORS: Record<string, string> = {
  intro:     '#6366f1',
  verse:     '#06b6d4',
  buildup:   '#f59e0b',
  drop:      '#ef4444',
  breakdown: '#8b5cf6',
  bridge:    '#10b981',
  outro:     '#64748b',
  silence:   '#1f2937',
}

function EnergySparkline({ energyCurve }: { energyCurve: Float32Array }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const n = Math.min(20, energyCurve.length)

    ctx.clearRect(0, 0, w, h)
    if (n === 0) return

    const barW = w / n
    for (let i = 0; i < n; i++) {
      const val = energyCurve[i] ?? 0
      const barH = val * h
      const ratio = val
      // Color gradient: low=#1e1b4b mid=#7c3aed high=#ec4899
      let r: number, g: number, b: number
      if (ratio < 0.5) {
        const t = ratio * 2
        r = Math.round(30 + t * (124 - 30))
        g = Math.round(27 + t * (58 - 27))
        b = Math.round(75 + t * (237 - 75))
      } else {
        const t = (ratio - 0.5) * 2
        r = Math.round(124 + t * (236 - 124))
        g = Math.round(58 + t * (72 - 58))
        b = Math.round(237 + t * (153 - 237))
      }
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(i * barW, h - barH, barW - 1, barH)
    }
  }, [energyCurve])

  return <canvas ref={canvasRef} width={200} height={40} className="rounded" />
}

function OverviewTab({ context }: { context: MusicContext }) {
  const { style, project, groove, mix, arrangement } = context
  const color = STYLE_COLORS[style.primaryStyle] ?? '#374151'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span
          className="px-3 py-1 rounded-full text-xs font-bold uppercase text-white"
          style={{ background: color }}
        >
          {style.primaryStyle}
        </span>
        <span className="text-white font-mono text-lg">{project.bpm} BPM</span>
        {project.key && <span className="text-gray-400 text-sm">{project.key}</span>}
      </div>

      <div>
        <div className="text-gray-400 text-xs mb-1">Energy (first 20 bars)</div>
        <EnergySparkline energyCurve={arrangement.energyCurve} />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-xs">Groove:</span>
        <span className="px-2 py-0.5 bg-indigo-900 text-indigo-300 rounded text-xs">
          {groove.grooveTemplate}
        </span>
      </div>

      {mix.suggestions.length > 0 && (
        <div className="space-y-1">
          <div className="text-gray-400 text-xs">Mix suggestions:</div>
          {mix.suggestions.slice(0, 3).map((s, i) => (
            <div key={i} className="text-yellow-300 text-xs bg-yellow-900/20 rounded px-2 py-1">
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ArrangementTab({ context }: { context: MusicContext }) {
  const { arrangement } = context
  const totalBars = context.project.totalBars

  return (
    <div className="space-y-3">
      <div className="text-gray-400 text-xs">
        {arrangement.sections.length} sections · Dynamic range: {(arrangement.dynamicRange * 100).toFixed(0)}%
      </div>
      <div className="space-y-2">
        {arrangement.sections.map((section, i) => {
          const widthPct = totalBars > 0
            ? ((section.endBar - section.startBar) / totalBars * 100).toFixed(1)
            : '0'
          const color = SECTION_COLORS[section.label] ?? '#374151'
          return (
            <div key={i} className="flex items-center gap-2">
              <div
                className="rounded h-5 flex items-center px-2"
                style={{ width: `${widthPct}%`, minWidth: 40, background: color + '33', borderLeft: `3px solid ${color}` }}
              >
                <span className="text-white text-xs font-medium">{section.label}</span>
              </div>
              <span className="text-gray-500 text-xs">
                {section.startBar}–{section.endBar} · E:{(section.energy * 100).toFixed(0)}%
              </span>
            </div>
          )
        })}
      </div>
      <div className="text-gray-500 text-xs">
        Peak bar: {arrangement.peakBar} · Avg energy: {(arrangement.averageEnergy * 100).toFixed(0)}%
      </div>
    </div>
  )
}

function GrooveTab({ context }: { context: MusicContext }) {
  const { groove } = context
  const swingPct = (groove.swingAmount * 100).toFixed(0)
  const variancePct = (groove.velocityVariance * 100).toFixed(0)

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Swing amount</span>
          <span>{swingPct}%</span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${swingPct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-gray-400">Subdivision</span>
          <div className="text-white font-mono mt-0.5">{groove.dominantSubdivision}</div>
        </div>
        <div>
          <span className="text-gray-400">Style hint</span>
          <div className="text-indigo-300 font-medium mt-0.5">{groove.styleHint}</div>
        </div>
        <div>
          <span className="text-gray-400">Groove template</span>
          <div className="text-white mt-0.5">{groove.grooveTemplate}</div>
        </div>
        <div>
          <span className="text-gray-400">Timing deviation</span>
          <div className="text-white font-mono mt-0.5">{(groove.timingDeviation * 1000).toFixed(1)}ms</div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Velocity variance</span>
          <span>{variancePct}%</span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 rounded-full transition-all"
            style={{ width: `${variancePct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function MixTab({ context }: { context: MusicContext }) {
  const { mix } = context
  const { frequencyDistribution: fd } = mix

  const bands: Array<{ label: string; value: number; color: string }> = [
    { label: 'Sub',  value: fd.sub,  color: '#6366f1' },
    { label: 'Low',  value: fd.low,  color: '#06b6d4' },
    { label: 'Mid',  value: fd.mid,  color: '#10b981' },
    { label: 'High', value: fd.high, color: '#f59e0b' },
  ]

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-gray-400 text-xs">Frequency distribution</div>
        {bands.map(band => (
          <div key={band.label} className="flex items-center gap-2">
            <span className="text-gray-400 text-xs w-8">{band.label}</span>
            <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(band.value * 100).toFixed(0)}%`, background: band.color }}
              />
            </div>
            <span className="text-gray-500 text-xs w-8 text-right">{(band.value * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-gray-400">Headroom</span>
          <div
            className={`font-mono mt-0.5 ${mix.headroomScore < 0.1 ? 'text-red-400' : 'text-green-400'}`}
          >
            {(mix.headroomScore * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          <span className="text-gray-400">Percussion ratio</span>
          <div className="text-white font-mono mt-0.5">{(mix.percussionRatio * 100).toFixed(0)}%</div>
        </div>
      </div>
    </div>
  )
}

function StyleTab({ context }: { context: MusicContext }) {
  const { style } = context
  const color = STYLE_COLORS[style.primaryStyle] ?? '#374151'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span
          className="px-4 py-2 rounded-lg text-base font-bold uppercase text-white"
          style={{ background: color }}
        >
          {style.primaryStyle}
        </span>
        <div>
          <div className="text-gray-400 text-xs">Confidence</div>
          <div className="text-white font-mono">{(style.confidence * 100).toFixed(0)}%</div>
        </div>
      </div>

      <div className="text-gray-400 text-sm">{style.subStyle}</div>

      {style.characteristicElements.length > 0 && (
        <div>
          <div className="text-gray-500 text-xs mb-1">Characteristic elements</div>
          <ul className="space-y-1">
            {style.characteristicElements.map((el, i) => (
              <li key={i} className="text-gray-300 text-xs flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-indigo-400 inline-block" />
                {el}
              </li>
            ))}
          </ul>
        </div>
      )}

      {style.referenceArtists.length > 0 && (
        <div>
          <div className="text-gray-500 text-xs mb-1">Reference artists</div>
          <div className="flex flex-wrap gap-2">
            {style.referenceArtists.map((artist, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full text-xs text-white"
                style={{ background: color + '66' }}
              >
                {artist}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface DeepAnalysisPanelProps {
  snapshot?: {
    bpm: number
    tracks: import('../../audio/ai/deep/AnalysisTypes').AnalysisTrack[]
    totalBars: number
    sampleRate: number
    key?: string
  }
}

export default function DeepAnalysisPanel({ snapshot }: DeepAnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const store = useDeepAIStore()
  const { context, isAnalyzing, analyzeProject } = store

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview',     label: 'Overview' },
    { id: 'arrangement',  label: 'Arrangement' },
    { id: 'groove',       label: 'Groove' },
    { id: 'mix',          label: 'Mix' },
    { id: 'style',        label: 'Style' },
  ]

  const handleReanalyze = () => {
    if (snapshot) {
      analyzeProject(snapshot).catch(console.error)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm">Deep Analysis</h2>
        <button
          onClick={handleReanalyze}
          disabled={isAnalyzing}
          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
        >
          {isAnalyzing ? 'Analyzing...' : 'Re-analyze'}
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-700 pb-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1 text-xs rounded-t transition-colors ${
              activeTab === tab.id
                ? 'text-white bg-indigo-600'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-32">
        {!context ? (
          <div className="text-gray-500 text-sm text-center py-8">
            {isAnalyzing ? 'Analyzing project...' : 'Run analysis to see insights'}
          </div>
        ) : (
          <>
            {activeTab === 'overview' && <OverviewTab context={context} />}
            {activeTab === 'arrangement' && <ArrangementTab context={context} />}
            {activeTab === 'groove' && <GrooveTab context={context} />}
            {activeTab === 'mix' && <MixTab context={context} />}
            {activeTab === 'style' && <StyleTab context={context} />}
          </>
        )}
      </div>
    </div>
  )
}
