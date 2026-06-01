// ─── MixAssistantPanel ────────────────────────────────────────────────────────
// Main tabbed panel: Analysis | EQ | Compression | Mastering | Metering

import { useState, useCallback } from 'react'
import { useMixAssistantStore } from '../../store/mixAssistantStore'
import type { AppliedSuggestion } from '../../store/mixAssistantStore'
import { SpectrumAnalyzerView } from './SpectrumAnalyzerView'
import { StereoImageView } from './StereoImageView'
import { LoudnessMeterView } from './LoudnessMeterView'
import { MixSuggestionsPanel } from './MixSuggestionsPanel'
import { MasteringAssistantView } from './MasteringAssistantView'
import { StereoAnalyzer } from '../../audio/analysis/StereoAnalyzer'
import { LoudnessMeter } from '../../audio/meters/LoudnessMeter'

type Tab = 'analysis' | 'eq' | 'compression' | 'mastering' | 'metering'

const TABS: { id: Tab; label: string }[] = [
  { id: 'analysis',    label: 'Analysis' },
  { id: 'eq',          label: 'EQ' },
  { id: 'compression', label: 'Compression' },
  { id: 'mastering',   label: 'Mastering' },
  { id: 'metering',    label: 'Metering' },
]

const stereoAnalyzerInst = new StereoAnalyzer()
const loudnessMeterInst  = new LoudnessMeter()

export function MixAssistantPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('analysis')
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())

  const {
    currentAnalysis,
    masterBuffer,
    sampleRate,
    masteringReport,
    eqSuggestions,
    compressionSuggestions,
    tracks,
    isAnalyzing,
    abCompareEnabled,
    abCompareLabel,
    pendingSuggestions,
    runFullAnalysis,
    analyzeMaster,
    applySuggestion,
    revertSuggestion,
    toggleABCompare,
    clearAnalysis,
  } = useMixAssistantStore()

  // Derived values
  const goniometerData = currentAnalysis && masterBuffer
    ? stereoAnalyzerInst.computeGoniometer(masterBuffer, masterBuffer)
    : null

  const loudnessMeasurement = currentAnalysis && masterBuffer
    ? loudnessMeterInst.measure(masterBuffer, sampleRate)
    : null

  const trackNames = new Map(tracks.map((t) => [t.id, t.name]))

  const handleApply = useCallback(
    (trackId: string, type: 'eq' | 'compression', idx: number) => {
      const id = type === 'eq' ? `eq-${trackId}-${idx}` : `comp-${trackId}`
      const suggestion: AppliedSuggestion = {
        id,
        type,
        trackId,
        suggestion: type === 'eq'
          ? (eqSuggestions.get(trackId)?.[idx] ?? '')
          : (compressionSuggestions.get(trackId) ?? ''),
        appliedAt: Date.now(),
        reverted:  false,
      }
      applySuggestion(suggestion)
      setAppliedIds((prev) => new Set([...prev, id]))
    },
    [eqSuggestions, compressionSuggestions, applySuggestion],
  )

  const handleRevert = useCallback(
    (trackId: string, type: 'eq' | 'compression', idx: number) => {
      const id = type === 'eq' ? `eq-${trackId}-${idx}` : `comp-${trackId}`
      revertSuggestion(id)
      setAppliedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    },
    [revertSuggestion],
  )

  const handleMasteringAnalyze = useCallback(
    (_targetLUFS: number) => {
      void analyzeMaster()
    },
    [analyzeMaster],
  )

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-purple-400 font-bold text-sm">MIX ASSISTANT</span>
          {isAnalyzing && (
            <span className="text-xs text-yellow-400 animate-pulse">Analyzing…</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* A/B Compare */}
          <button
            onClick={toggleABCompare}
            className={`text-xs px-2 py-1 rounded font-mono font-bold ${
              abCompareEnabled
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-slate-400'
            }`}
          >
            {abCompareEnabled ? `A/B: ${abCompareLabel}` : 'A/B'}
          </button>
          <button
            onClick={() => void runFullAnalysis()}
            disabled={isAnalyzing || !masterBuffer}
            className="text-xs px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 rounded text-white font-medium"
          >
            Analyze
          </button>
          <button
            onClick={clearAnalysis}
            className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-purple-400 border-b-2 border-purple-500'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
            {tab.id === 'eq' && eqSuggestions.size > 0 && (
              <span className="ml-1 text-[9px] bg-yellow-500/30 text-yellow-300 px-1 rounded">
                {Array.from(eqSuggestions.values()).reduce((s, v) => s + v.length, 0)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'analysis' && (
          <div className="flex flex-col gap-4">
            <SpectrumAnalyzerView
              spectrum={currentAnalysis?.spectrum ?? null}
              sampleRate={sampleRate}
              width={580}
              height={180}
            />
            <div className="flex gap-3">
              <StereoImageView
                goniometer={goniometerData}
                correlation={currentAnalysis?.stereo.correlation ?? 0}
                width={180}
                height={180}
              />
              <div className="flex flex-col gap-2 text-xs font-mono flex-1">
                {currentAnalysis && (
                  <>
                    <div className="bg-slate-800 rounded p-2">
                      <div className="text-slate-500">PEAK</div>
                      <div className={`font-bold ${currentAnalysis.dynamics.peakDb > -1 ? 'text-red-400' : 'text-green-400'}`}>
                        {isFinite(currentAnalysis.dynamics.peakDb)
                          ? `${currentAnalysis.dynamics.peakDb.toFixed(2)} dBFS`
                          : '–'}
                      </div>
                    </div>
                    <div className="bg-slate-800 rounded p-2">
                      <div className="text-slate-500">RMS</div>
                      <div className="text-blue-400 font-bold">
                        {isFinite(currentAnalysis.dynamics.rmsDb)
                          ? `${currentAnalysis.dynamics.rmsDb.toFixed(1)} dB`
                          : '–'}
                      </div>
                    </div>
                    <div className="bg-slate-800 rounded p-2">
                      <div className="text-slate-500">CREST</div>
                      <div className="text-yellow-400 font-bold">
                        {currentAnalysis.dynamics.crestFactor.toFixed(1)} dB
                      </div>
                    </div>
                    <div className="bg-slate-800 rounded p-2">
                      <div className="text-slate-500">WIDTH</div>
                      <div className="text-purple-400 font-bold">
                        {(currentAnalysis.stereo.stereoWidth * 100).toFixed(0)}%
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            {!currentAnalysis && (
              <div className="text-center text-slate-500 text-sm py-8">
                Load audio and click Analyze to see spectrum analysis.
              </div>
            )}
          </div>
        )}

        {activeTab === 'eq' && (
          <MixSuggestionsPanel
            eqSuggestions={eqSuggestions}
            compressionSuggestions={new Map()}
            trackNames={trackNames}
            onApply={handleApply}
            onRevert={handleRevert}
            appliedIds={appliedIds}
          />
        )}

        {activeTab === 'compression' && (
          <MixSuggestionsPanel
            eqSuggestions={new Map()}
            compressionSuggestions={compressionSuggestions}
            trackNames={trackNames}
            onApply={handleApply}
            onRevert={handleRevert}
            appliedIds={appliedIds}
          />
        )}

        {activeTab === 'mastering' && (
          <MasteringAssistantView
            report={masteringReport}
            onAnalyze={handleMasteringAnalyze}
            analyzing={isAnalyzing}
          />
        )}

        {activeTab === 'metering' && (
          <div className="flex flex-wrap gap-4">
            <LoudnessMeterView
              loudness={loudnessMeasurement}
              vu={null}
              width={280}
              height={140}
            />
            <div className="flex flex-col gap-2 text-xs font-mono">
              <div className="text-slate-400 uppercase font-bold text-[10px]">
                Pending Suggestions ({pendingSuggestions.filter((s) => !s.reverted).length})
              </div>
              {pendingSuggestions
                .filter((s) => !s.reverted)
                .map((s) => (
                  <div key={s.id} className="bg-slate-800 rounded px-2 py-1 text-[10px] text-slate-400">
                    {s.type.toUpperCase()} on {s.trackId ?? 'master'} — marked for reference
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
