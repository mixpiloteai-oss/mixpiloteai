// ─── MasteringAssistantView ───────────────────────────────────────────────────
// Target LUFS selector + readiness checklist + mastering chain suggestions.

import { useState } from 'react'
import type { MasteringReport } from '../../audio/mixing/MasteringAssistant'

interface Props {
  report:    MasteringReport | null
  onAnalyze: (targetLUFS: number) => void
  analyzing: boolean
}

const TARGET_LUFS_OPTIONS = [-14, -16, -18, -23]

const MASTERING_TYPE_LABELS: Record<string, string> = {
  limiting:      'Limiter',
  eq:            'EQ',
  saturation:    'Saturation',
  compression:   'Compressor',
  'stereo-width': 'Stereo Width',
}

function CheckItem({
  label,
  pass,
  detail,
}: { label: string; pass: boolean; detail: string }) {
  return (
    <div className={`flex items-start gap-2 p-2 rounded ${pass ? 'bg-emerald-900/20' : 'bg-red-900/20'}`}>
      <span className={`text-base mt-0.5 ${pass ? 'text-emerald-400' : 'text-red-400'}`}>
        {pass ? '✓' : '✗'}
      </span>
      <div>
        <div className={`text-xs font-medium ${pass ? 'text-emerald-300' : 'text-red-300'}`}>
          {label}
        </div>
        <div className="text-[10px] text-slate-400">{detail}</div>
      </div>
    </div>
  )
}

export function MasteringAssistantView({ report, onAnalyze, analyzing }: Props) {
  const [targetLUFS, setTargetLUFS] = useState(-14)

  const checks = report
    ? [
        {
          label: 'Integrated Loudness',
          pass:  Math.abs((report.lufs ?? -70) - targetLUFS) <= 2,
          detail: `Current: ${isFinite(report.lufs) ? report.lufs.toFixed(1) : '–'} LUFS  Target: ${targetLUFS} LUFS (±2)`,
        },
        {
          label: 'True Peak',
          pass:  report.peakDb < -0.3,
          detail: `Current: ${isFinite(report.peakDb) ? report.peakDb.toFixed(2) : '–'} dBFS  Must be < -0.3 dBFS`,
        },
        {
          label: 'Dynamic Range',
          pass:  report.dynamicRange > 6,
          detail: `Current: ${report.dynamicRange.toFixed(1)} dB  Must be > 6 dB`,
        },
        {
          label: 'No Critical Issues',
          pass:  (report.issues ?? []).filter((i) => i.severity === 'critical').length === 0,
          detail: `${(report.issues ?? []).filter((i) => i.severity === 'critical').length} critical issue(s)`,
        },
      ]
    : []

  return (
    <div className="flex flex-col gap-4 p-2 font-sans">
      {/* Target LUFS Selector */}
      <div className="flex flex-col gap-2">
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Target Platform
        </div>
        <div className="flex gap-2 flex-wrap">
          {TARGET_LUFS_OPTIONS.map((lufs) => (
            <button
              key={lufs}
              onClick={() => setTargetLUFS(lufs)}
              className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${
                targetLUFS === lufs
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {lufs} LUFS
              {lufs === -14 && ' (Streaming)'}
              {lufs === -16 && ' (Podcast)'}
              {lufs === -18 && ' (Film)'}
              {lufs === -23 && ' (Broadcast)'}
            </button>
          ))}
        </div>
      </div>

      {/* Analyze Button */}
      <button
        onClick={() => onAnalyze(targetLUFS)}
        disabled={analyzing}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 rounded text-sm font-medium text-white transition-colors"
      >
        {analyzing ? 'Analyzing…' : 'Analyze Master'}
      </button>

      {/* Readiness Checklist */}
      {report && (
        <>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Mastering Readiness
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                report.readyToMaster
                  ? 'bg-emerald-600/30 text-emerald-400'
                  : 'bg-orange-600/30 text-orange-400'
              }`}>
                {report.readyToMaster ? 'READY' : 'NOT READY'}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 mt-1">
              {checks.map((c) => (
                <CheckItem key={c.label} {...c} />
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="bg-slate-800 rounded p-2">
              <div className="text-slate-500">LUFS</div>
              <div className="text-purple-400 font-bold text-sm">
                {isFinite(report.lufs) ? report.lufs.toFixed(1) : '–'}
              </div>
            </div>
            <div className="bg-slate-800 rounded p-2">
              <div className="text-slate-500">TRUE PEAK</div>
              <div className={`font-bold text-sm ${report.peakDb < -0.3 ? 'text-green-400' : 'text-red-400'}`}>
                {isFinite(report.peakDb) ? `${report.peakDb.toFixed(2)} dB` : '–'}
              </div>
            </div>
            <div className="bg-slate-800 rounded p-2">
              <div className="text-slate-500">DYN RANGE</div>
              <div className="text-yellow-400 font-bold text-sm">
                {report.dynamicRange.toFixed(1)} dB
              </div>
            </div>
            <div className="bg-slate-800 rounded p-2">
              <div className="text-slate-500">STEREO WIDTH</div>
              <div className="text-blue-400 font-bold text-sm">
                {(report.stereoWidth * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Mastering Chain Suggestions */}
          {report.suggestions.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Suggested Chain
              </div>
              {report.suggestions.map((s, i) => (
                <div key={i} className="bg-slate-800 rounded p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-purple-400 bg-purple-900/30 px-1.5 py-0.5 rounded">
                      {MASTERING_TYPE_LABELS[s.type] ?? s.type}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">{s.reason}</div>
                  <div className="font-mono text-[10px] text-slate-500">
                    {Object.entries(s.params)
                      .map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(1) : v}`)
                      .join('  |  ')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Issues */}
          {report.issues.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Issues
              </div>
              {report.issues.map((issue, i) => (
                <div
                  key={i}
                  className={`rounded p-2 text-[10px] ${
                    issue.severity === 'critical'
                      ? 'bg-red-900/30 text-red-300'
                      : issue.severity === 'warning'
                      ? 'bg-yellow-900/30 text-yellow-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <span className="font-bold uppercase mr-1">[{issue.severity}]</span>
                  {issue.description}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
