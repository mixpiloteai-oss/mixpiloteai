// ─── LoudnessMeterDisplay ─────────────────────────────────────────────────────
// Visual loudness meter showing RMS, peak, true peak, LUFS, dynamic range,
// and crest factor from a LoudnessMeasurement.

import type { LoudnessMeasurement } from '../../audio/export/LoudnessMeter'

interface Props {
  measurement: LoudnessMeasurement | null
}

// dB scale: maps dB value to 0-100% bar height (range: -60dB to 0dB)
function dbToPercent(db: number): number {
  if (!isFinite(db)) return 0
  const clamped = Math.max(-60, Math.min(0, db))
  return ((clamped + 60) / 60) * 100
}

function fmt(n: number, digits = 1): string {
  return isFinite(n) ? n.toFixed(digits) : '-∞'
}

/** Color based on LUFS: green = healthy, yellow = hot, red = over */
function lufsColor(lufs: number): string {
  if (!isFinite(lufs)) return '#475569'
  if (lufs <= -14) return '#10b981'  // green: streaming-safe
  if (lufs <= -6)  return '#f59e0b'  // yellow: hot
  return '#ef4444'                    // red: over
}

export function LoudnessMeterDisplay({ measurement }: Props) {
  const rmsPercent      = measurement ? dbToPercent(measurement.rmsDb) : 0
  const peakPercent     = measurement ? dbToPercent(measurement.peakDb) : 0
  const truePeakPercent = measurement ? dbToPercent(measurement.truePeakDb) : 0
  const color           = measurement ? lufsColor(measurement.lufsApprox) : '#475569'

  return (
    <div style={{ fontFamily: 'monospace', color: '#e2e8f0', padding: '12px' }}>
      {/* Bar meter row */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', height: '120px', marginBottom: '16px' }}>
        {/* RMS bar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{ position: 'relative', width: '24px', height: '100px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute', bottom: 0, width: '100%',
                height: `${rmsPercent}%`,
                background: `linear-gradient(to top, ${color}, #34d399)`,
                transition: 'height 0.1s ease',
              }}
            />
            {/* Peak indicator */}
            {measurement && isFinite(measurement.peakDb) && (
              <div
                style={{
                  position: 'absolute',
                  bottom: `${peakPercent}%`,
                  width: '100%',
                  height: '2px',
                  background: '#f59e0b',
                }}
              />
            )}
            {/* True peak indicator */}
            {measurement && isFinite(measurement.truePeakDb) && (
              <div
                style={{
                  position: 'absolute',
                  bottom: `${truePeakPercent}%`,
                  width: '100%',
                  height: '1px',
                  background: '#ef4444',
                }}
              />
            )}
          </div>
          <span style={{ fontSize: '9px', color: '#64748b' }}>RMS</span>
        </div>

        {/* dB scale labels */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100px', paddingBottom: '0' }}>
          {[0, -12, -24, -36, -48, -60].map(db => (
            <span key={db} style={{ fontSize: '9px', color: '#475569', lineHeight: 1 }}>
              {db}
            </span>
          ))}
        </div>
      </div>

      {/* Text readouts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
        <Readout label="RMS"           value={`${fmt(measurement?.rmsDb ?? -Infinity)} dB`} />
        <Readout label="Peak"          value={`${fmt(measurement?.peakDb ?? -Infinity)} dB`} />
        <Readout label="True Peak"     value={`${fmt(measurement?.truePeakDb ?? -Infinity)} dB`} color={measurement && measurement.truePeakDb > -1 ? '#ef4444' : undefined} />
        <Readout label="LUFS (approx)" value={`${fmt(measurement?.lufsApprox ?? -Infinity)} LUFS`} color={color} />
        <Readout label="Dynamic Range" value={`${fmt(measurement?.dynamicRange ?? 0)} dB`} />
        <Readout label="Crest Factor"  value={`${fmt(measurement?.crestFactor ?? 0)} dB`} />
      </div>

      {!measurement && (
        <p style={{ color: '#475569', fontSize: '11px', marginTop: '8px', textAlign: 'center' }}>
          No measurement yet — run an export to see loudness data.
        </p>
      )}
    </div>
  )
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#0f172a', borderRadius: '6px', padding: '6px 8px' }}>
      <div style={{ fontSize: '9px', color: '#475569', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontWeight: 600, color: color ?? '#e2e8f0' }}>{value}</div>
    </div>
  )
}
