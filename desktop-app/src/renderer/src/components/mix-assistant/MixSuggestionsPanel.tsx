// ─── MixSuggestionsPanel ──────────────────────────────────────────────────────
// Grouped suggestion cards with Apply (non-destructive)/Preview/Revert.

import type { EQSuggestion } from '../../audio/mixing/EQSuggestionEngine'
import type { CompressionSuggestion } from '../../audio/mixing/CompressionSuggestionEngine'

type Priority = 'critical' | 'recommended' | 'optional'

interface Props {
  eqSuggestions:          Map<string, EQSuggestion[]>
  compressionSuggestions: Map<string, CompressionSuggestion>
  trackNames:             Map<string, string>
  onApply:                (trackId: string, type: 'eq' | 'compression', idx: number) => void
  onRevert:               (trackId: string, type: 'eq' | 'compression', idx: number) => void
  appliedIds:             Set<string>
}

const PRIORITY_COLOR: Record<Priority, string> = {
  critical:    'border-red-500/60 bg-red-900/20',
  recommended: 'border-yellow-500/60 bg-yellow-900/20',
  optional:    'border-slate-600 bg-slate-800/40',
}

const PRIORITY_BADGE: Record<Priority, string> = {
  critical:    'bg-red-500/30 text-red-300',
  recommended: 'bg-yellow-500/30 text-yellow-300',
  optional:    'bg-slate-600/30 text-slate-400',
}

function EQCard({
  suggestion,
  suggestionId,
  applied,
  onApply,
  onRevert,
}: {
  suggestion:   EQSuggestion
  suggestionId: string
  applied:      boolean
  onApply:      () => void
  onRevert:     () => void
}) {
  const priority = suggestion.priority as Priority
  return (
    <div className={`rounded-lg border p-3 ${PRIORITY_COLOR[priority]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${PRIORITY_BADGE[priority]}`}>
              {suggestion.priority}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {suggestion.type.toUpperCase()}
            </span>
          </div>
          <div className="font-mono text-xs text-white">
            {suggestion.frequencyHz >= 1000
              ? `${(suggestion.frequencyHz / 1000).toFixed(1)} kHz`
              : `${suggestion.frequencyHz.toFixed(0)} Hz`}
            {suggestion.type !== 'highpass' && suggestion.type !== 'lowpass'
              ? ` ${suggestion.gainDb > 0 ? '+' : ''}${suggestion.gainDb} dB  Q ${suggestion.qFactor}`
              : ''}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">{suggestion.reason}</div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {!applied ? (
            <button
              onClick={onApply}
              className="text-[10px] px-2 py-1 bg-emerald-600/80 hover:bg-emerald-500 rounded text-white font-medium"
            >
              Apply*
            </button>
          ) : (
            <button
              onClick={onRevert}
              className="text-[10px] px-2 py-1 bg-slate-600/80 hover:bg-slate-500 rounded text-slate-300 font-medium"
            >
              Revert
            </button>
          )}
        </div>
      </div>
      {applied && (
        <div className="mt-1 text-[10px] text-emerald-400/70">
          ✓ Marked (non-destructive — apply in your DAW)
        </div>
      )}
    </div>
  )
}

function CompCard({
  suggestion,
  trackName,
  applied,
  onApply,
  onRevert,
}: {
  suggestion: CompressionSuggestion
  trackName:  string
  applied:    boolean
  onApply:    () => void
  onRevert:   () => void
}) {
  const priority = suggestion.priority as Priority
  return (
    <div className={`rounded-lg border p-3 ${PRIORITY_COLOR[priority]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${PRIORITY_BADGE[priority]}`}>
              {suggestion.priority}
            </span>
            <span className="text-[10px] font-mono text-slate-400">COMPRESSOR</span>
          </div>
          <div className="font-mono text-xs text-white grid grid-cols-2 gap-x-4">
            <span>Threshold: {suggestion.threshold.toFixed(1)} dB</span>
            <span>Ratio: {suggestion.ratio}:1</span>
            <span>Attack: {suggestion.attack} ms</span>
            <span>Release: {suggestion.release} ms</span>
            <span>Makeup: +{suggestion.makeupGain.toFixed(1)} dB</span>
            <span>Knee: {suggestion.knee} dB</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">{suggestion.reason}</div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {!applied ? (
            <button
              onClick={onApply}
              className="text-[10px] px-2 py-1 bg-emerald-600/80 hover:bg-emerald-500 rounded text-white font-medium"
            >
              Apply*
            </button>
          ) : (
            <button
              onClick={onRevert}
              className="text-[10px] px-2 py-1 bg-slate-600/80 hover:bg-slate-500 rounded text-slate-300 font-medium"
            >
              Revert
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function MixSuggestionsPanel({
  eqSuggestions,
  compressionSuggestions,
  trackNames,
  onApply,
  onRevert,
  appliedIds,
}: Props) {
  const hasSuggestions =
    eqSuggestions.size > 0 || compressionSuggestions.size > 0

  if (!hasSuggestions) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
        No suggestions yet. Run analysis to generate recommendations.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto">
      <div className="text-xs text-slate-500 italic">
        * Suggestions are non-destructive — they are marked for reference only and must be applied manually in your DAW.
      </div>

      {Array.from(eqSuggestions.entries()).map(([trackId, suggestions]) => (
        <div key={trackId} className="flex flex-col gap-2">
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            EQ — {trackNames.get(trackId) ?? trackId}
          </div>
          {suggestions.map((s, idx) => {
            const id = `eq-${trackId}-${idx}`
            return (
              <EQCard
                key={id}
                suggestion={s}
                suggestionId={id}
                applied={appliedIds.has(id)}
                onApply={() => onApply(trackId, 'eq', idx)}
                onRevert={() => onRevert(trackId, 'eq', idx)}
              />
            )
          })}
        </div>
      ))}

      {Array.from(compressionSuggestions.entries()).map(([trackId, suggestion]) => {
        const id = `comp-${trackId}`
        return (
          <div key={trackId} className="flex flex-col gap-2">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              COMPRESSION — {trackNames.get(trackId) ?? trackId}
            </div>
            <CompCard
              suggestion={suggestion}
              trackName={trackNames.get(trackId) ?? trackId}
              applied={appliedIds.has(id)}
              onApply={() => onApply(trackId, 'compression', 0)}
              onRevert={() => onRevert(trackId, 'compression', 0)}
            />
          </div>
        )
      })}
    </div>
  )
}
