import { useLocalAIStore }   from '../../store/localAIStore'
import { useLocalAI }         from '../../hooks/useLocalAI'
import type { BandEnergy }    from '../../audio/analysis/MixAnalyzer'
import type { StructureSection } from '../../audio/analysis/StructureAnalyzer'

// ── Colour helpers ────────────────────────────────────────────────────────────

const SECTION_COLORS: Record<string, string> = {
  intro:   '#475569', buildup: '#f59e0b', drop:    '#ef4444',
  break:   '#06b6d4', verse:   '#7c3aed', bridge:  '#10b981', outro:   '#334155',
}

function scoreColor(score: number): string {
  if (score >= 75) return '#10b981'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionBlock({ s }: { s: StructureSection }) {
  const color  = SECTION_COLORS[s.label] ?? '#475569'
  const width  = `${s.endPct - s.startPct}%`
  return (
    <div
      title={`${s.label} · ${s.startPct.toFixed(0)}–${s.endPct.toFixed(0)}% · energy ${(s.energy * 100).toFixed(0)}%`}
      style={{ width, background: color, height: 20, borderRadius: 3, opacity: 0.85, flexShrink: 0 }}
    />
  )
}

function BandBar({ b }: { b: BandEnergy }) {
  const pct = Math.min(100, b.rms * 100)
  const color = pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#7c3aed'
  return (
    <div className="flex items-center gap-2 text-[10px]" style={{ color: '#64748b' }}>
      <span style={{ width: 60, flexShrink: 0 }}>{b.label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#1c1c2e' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', transition: 'width 0.4s' }} />
      </div>
      <span style={{ width: 36, textAlign: 'right', color: '#475569' }}>{b.dB.toFixed(0)} dB</span>
    </div>
  )
}

function IssueList({ items, color }: { items: string[]; color: string }) {
  if (!items.length) return <p className="text-[10px]" style={{ color: '#10b981' }}>No issues detected.</p>
  return (
    <ul className="space-y-1">
      {items.map((s, i) => (
        <li key={i} className="text-[10px] leading-relaxed" style={{ color }}>• {s}</li>
      ))}
    </ul>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3 space-y-2" style={{ background: '#0c0c14', border: '1px solid #1c1c2e' }}>
      <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: '#334155' }}>{title}</p>
      {children}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function LocalAIPanel() {
  useLocalAI()
  const { result, analyzing } = useLocalAIStore()

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#08080f' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-9 shrink-0" style={{ borderBottom: '1px solid #1c1c2e', background: '#0c0c14' }}>
        <span style={{ color: '#06b6d4', fontSize: 12 }}>⊙</span>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#334155' }}>Local AI</span>
        <div className="ml-auto flex items-center gap-1.5">
          {analyzing && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
          <span className="text-[10px]" style={{ color: '#334155' }}>Offline · CPU only</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* ── Overview ── */}
        <Section title="Overview">
          {result ? (
            <div className="grid grid-cols-2 gap-2">
              {/* Arrangement score */}
              <div className="rounded-lg p-2.5 text-center" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
                <p className="text-lg font-bold font-mono" style={{ color: scoreColor(result.arrangement?.score ?? 50) }}>
                  {result.arrangement?.score ?? '—'}
                </p>
                <p className="text-[9px] mt-0.5" style={{ color: '#475569' }}>Arrangement</p>
              </div>
              {/* Clipping status */}
              <div className="rounded-lg p-2.5 text-center" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
                <p className="text-lg font-bold font-mono" style={{ color: result.clipping.isClipping ? '#ef4444' : result.clipping.isNearClipping ? '#f59e0b' : '#10b981' }}>
                  {result.clipping.isClipping ? 'CLIP' : result.clipping.isNearClipping ? 'WARN' : 'OK'}
                </p>
                <p className="text-[9px] mt-0.5" style={{ color: '#475569' }}>Master Level</p>
              </div>
              {/* Peak */}
              <div className="rounded-lg p-2.5 text-center" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
                <p className="text-base font-bold font-mono" style={{ color: '#94a3b8' }}>
                  {isFinite(result.clipping.peakdBFS) ? `${result.clipping.peakdBFS.toFixed(1)} dB` : '—'}
                </p>
                <p className="text-[9px] mt-0.5" style={{ color: '#475569' }}>Peak</p>
              </div>
              {/* Drops */}
              <div className="rounded-lg p-2.5 text-center" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
                <p className="text-base font-bold font-mono" style={{ color: '#a78bfa' }}>
                  {result.structure?.dropCount ?? '—'}
                </p>
                <p className="text-[9px] mt-0.5" style={{ color: '#475569' }}>Drops</p>
              </div>
            </div>
          ) : (
            <p className="text-[10px]" style={{ color: '#475569' }}>Analyzing…</p>
          )}
        </Section>

        {/* ── Clipping ── */}
        <Section title="Clipping Monitor">
          {result ? (
            <div className="space-y-2">
              <div className="flex justify-between text-[10px]">
                <span style={{ color: '#64748b' }}>Hard clips (3s)</span>
                <span style={{ color: result.clipping.hardClipCount > 0 ? '#ef4444' : '#475569' }}>
                  {result.clipping.hardClipCount}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span style={{ color: '#64748b' }}>Near clips (3s)</span>
                <span style={{ color: result.clipping.nearClipCount > 0 ? '#f59e0b' : '#475569' }}>
                  {result.clipping.nearClipCount}
                </span>
              </div>
              {result.clipping.isClipping && (
                <p className="text-[10px] rounded p-1.5" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                  Master output is clipping — reduce master gain or limiter ceiling.
                </p>
              )}
              {!result.clipping.isClipping && result.clipping.isNearClipping && (
                <p className="text-[10px] rounded p-1.5" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                  Near clipping detected — leave at least −1 dBFS headroom.
                </p>
              )}
            </div>
          ) : (
            <p className="text-[10px]" style={{ color: '#475569' }}>Waiting for audio…</p>
          )}
        </Section>

        {/* ── Mix ── */}
        <Section title="Frequency Bands">
          {result?.mix ? (
            <div className="space-y-1.5">
              {result.mix.bands.map(b => <BandBar key={b.label} b={b} />)}
              {result.mix.issues.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-[9px] uppercase tracking-widest" style={{ color: '#334155' }}>Issues</p>
                  <IssueList items={result.mix.issues} color="#f59e0b" />
                </div>
              )}
              {result.mix.suggestions.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-[9px] uppercase tracking-widest" style={{ color: '#334155' }}>Suggestions</p>
                  <IssueList items={result.mix.suggestions} color="#94a3b8" />
                </div>
              )}
            </div>
          ) : (
            <p className="text-[10px]" style={{ color: '#475569' }}>Play audio to analyze frequency balance.</p>
          )}
        </Section>

        {/* ── Structure ── */}
        <Section title="Song Structure">
          {result?.structure && result.structure.sections.length > 0 ? (
            <div className="space-y-2">
              {/* Timeline bar */}
              <div className="flex gap-0.5 w-full overflow-hidden rounded" style={{ height: 20 }}>
                {result.structure.sections.map((s, i) => <SectionBlock key={i} s={s} />)}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {result.structure.sections.map((s, i) => (
                  <span key={i} className="flex items-center gap-1 text-[9px]">
                    <span className="w-2 h-2 rounded-sm" style={{ background: SECTION_COLORS[s.label] ?? '#475569' }} />
                    <span style={{ color: '#64748b' }}>{s.label}</span>
                  </span>
                ))}
              </div>
              {result.structure.suggestion && (
                <p className="text-[10px] leading-relaxed" style={{ color: '#94a3b8' }}>
                  {result.structure.suggestion}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[10px]" style={{ color: '#475569' }}>Add clips to analyze song structure.</p>
          )}
        </Section>

        {/* ── Arrangement ── */}
        <Section title="Arrangement">
          {result?.arrangement ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px]" style={{ color: '#64748b' }}>Score</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#1c1c2e' }}>
                  <div style={{ width: `${result.arrangement.score}%`, background: scoreColor(result.arrangement.score), height: '100%', transition: 'width 0.5s' }} />
                </div>
                <span className="text-[10px] font-mono" style={{ color: scoreColor(result.arrangement.score) }}>
                  {result.arrangement.score}/100
                </span>
              </div>
              {result.arrangement.issues.length > 0 && (
                <>
                  <p className="text-[9px] uppercase tracking-widest" style={{ color: '#334155' }}>Issues</p>
                  <IssueList items={result.arrangement.issues} color="#f59e0b" />
                </>
              )}
              {result.arrangement.suggestions.length > 0 && (
                <>
                  <p className="text-[9px] uppercase tracking-widest mt-1" style={{ color: '#334155' }}>Suggestions</p>
                  <IssueList items={result.arrangement.suggestions} color="#94a3b8" />
                </>
              )}
              {result.arrangement.issues.length === 0 && result.arrangement.suggestions.length === 0 && (
                <p className="text-[10px]" style={{ color: '#10b981' }}>Arrangement looks solid.</p>
              )}
            </div>
          ) : (
            <p className="text-[10px]" style={{ color: '#475569' }}>Analyzing arrangement…</p>
          )}
        </Section>

        {/* ── Organization ── */}
        {result?.organization && result.organization.tips.length > 0 && (
          <Section title="Project Organization">
            <IssueList items={result.organization.tips} color="#94a3b8" />
          </Section>
        )}

        {/* Footer */}
        <p className="text-[9px] text-center pb-2" style={{ color: '#1c1c2e' }}>
          Analysis runs locally · no data leaves your machine
        </p>
      </div>
    </div>
  )
}
