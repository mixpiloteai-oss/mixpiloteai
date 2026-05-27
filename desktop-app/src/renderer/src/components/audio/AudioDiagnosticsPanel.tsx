/**
 * AudioDiagnosticsPanel — real-time diagnostics for the native audio engine.
 *
 * Shows:
 *   • Engine mode (native / web-audio-fallback)
 *   • Process PID, uptime, restart count, crash count
 *   • CPU% and memory (from OS-level watchdog metrics)
 *   • Buffer xrun count with severity colour
 *   • Driver / sample rate / buffer size / latency
 *   • Binary path and all checked paths
 *   • Recent crash entries (last 5)
 *   • Watchdog alerts (live feed)
 *   • Export logs button
 *
 * Usage:
 *   <AudioDiagnosticsPanel onClose={() => setOpen(false)} />
 */

import { useEffect, useRef, useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CrashEntry {
  timestamp:  number
  code:       number | null
  signal:     string | null
  restartNum: number
}

interface EngineStatus {
  mode:           'native' | 'web-audio-fallback'
  binaryFound:    boolean
  binaryPath:     string | null
  checkedPaths:   string[]
  platform:       string
  pid:            number | null
  isRunning:      boolean
  uptimeSeconds:  number | null
  restarts:       number
  crashCount:     number
  lastCrashAt:    number | null
  lastCrashCode:  number | null
  lastCrashSig:   string | null
  recentCrashes:  CrashEntry[]
  cpuPercent:     number | null
  memoryMB:       number | null
  xrunCount:      number
  driver:         string | null
  sampleRate:     number | null
  bufferSize:     number | null
  latencyMs:      number | null
}

interface ProcessMetrics {
  pid:        number
  cpuPercent: number | null
  memoryMB:   number | null
  timestamp:  number
}

interface WatchdogAlert {
  kind:    string
  message: string
  data:    unknown
}

interface Props {
  onClose?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AudioDiagnosticsPanel({ onClose }: Props) {
  const api = (window as any).electronAPI

  const [status,  setStatus]  = useState<EngineStatus | null>(null)
  const [metrics, setMetrics] = useState<ProcessMetrics | null>(null)
  const [alerts,  setAlerts]  = useState<WatchdogAlert[]>([])
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const [expandPaths, setExpandPaths] = useState(false)

  const alertsRef = useRef<WatchdogAlert[]>([])

  // ── Initial load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!api) return

    // Full status including OS metrics
    api.audioEngineDiagnostics?.().then((d: { status: EngineStatus; metrics: ProcessMetrics | null }) => {
      setStatus(d.status)
      if (d.metrics) setMetrics(d.metrics)
    }).catch(() => {
      api.audioEngineStatus?.().then(setStatus).catch(() => {})
    })

    // Subscribe to live events
    api.onAudioEngineStatusUpdate?.((s: EngineStatus) => setStatus(s))
    api.onAudioEngineCrash?.((info: { status: EngineStatus }) => {
      if (info.status) setStatus(info.status)
    })
    api.onAudioEngineMode?.((s: EngineStatus) => setStatus(s))
    api.onAudioEngineMetrics?.((m: ProcessMetrics) => setMetrics(m))
    api.onAudioEngineWatchdogAlert?.((alert: WatchdogAlert) => {
      const updated = [...alertsRef.current.slice(-9), alert]
      alertsRef.current = updated
      setAlerts(updated)
    })
  }, [])

  // ── Export logs ───────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (!api) return
    setExporting(true)
    setExportMsg(null)
    try {
      const result = await api.audioEngineExportLogs?.()
      if (result?.filePath) {
        setExportMsg(`✓ Saved to: ${result.filePath}`)
      } else if (result?.bundle) {
        // Copy to clipboard as fallback
        await navigator.clipboard.writeText(result.bundle)
        setExportMsg('✓ Copied to clipboard')
      }
    } catch (err) {
      setExportMsg(`✗ Export failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setExporting(false)
    }
  }, [])

  // ── Refresh ───────────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    api?.audioEngineDiagnostics?.().then((d: { status: EngineStatus; metrics: ProcessMetrics | null }) => {
      setStatus(d.status)
      if (d.metrics) setMetrics(d.metrics)
    }).catch(() => api?.audioEngineStatus?.().then(setStatus))
  }, [])

  if (!api) return null

  // ─── Helpers ───────────────────────────────────────────────────────────
  const modeNative  = status?.mode === 'native'
  const modeColor   = modeNative ? C.green : C.orange
  const modeLabel   = modeNative ? '● NATIVE ENGINE' : '⚠  WEB AUDIO FALLBACK'

  const xrunSeverity = (n: number) => n === 0 ? C.green : n < 10 ? C.yellow : C.red
  const cpuSeverity  = (n: number | null) => n === null ? C.dim : n < 50 ? C.green : n < 80 ? C.yellow : C.red
  const memSeverity  = (n: number | null) => n === null ? C.dim : n < 256 ? C.green : n < 512 ? C.yellow : C.red

  const fmtUptime = (s: number | null) => {
    if (s === null) return '—'
    if (s < 60)   return `${s}s`
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  }

  const fmtTime = (ms: number | null) => ms ? new Date(ms).toLocaleTimeString() : '—'

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div style={S.overlay}>
      <div style={S.panel}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={S.header}>
          <span style={{ ...S.modeLabel, color: modeColor }}>{modeLabel}</span>
          <div style={S.headerRight}>
            <button style={S.iconBtn} onClick={handleRefresh} title="Refresh">↺</button>
            {onClose && <button style={S.iconBtn} onClick={onClose} title="Close">✕</button>}
          </div>
        </div>

        <div style={S.body}>

          {/* ── Process info ───────────────────────────────────────────── */}
          <Section title="Process">
            <Row label="PID"       value={status?.pid ?? '—'} />
            <Row label="Running"   value={status?.isRunning ? 'Yes' : 'No'}
                 color={status?.isRunning ? C.green : C.red} />
            <Row label="Uptime"    value={fmtUptime(status?.uptimeSeconds ?? null)} />
            <Row label="Restarts"  value={status?.restarts ?? 0}
                 color={status?.restarts ? C.yellow : C.green} />
            <Row label="Crashes"   value={status?.crashCount ?? 0}
                 color={status?.crashCount ? C.orange : C.green} />
            <Row label="Platform"  value={status?.platform ?? process.platform} />
          </Section>

          {/* ── Real-time metrics ──────────────────────────────────────── */}
          <Section title="Metrics">
            <Row label="CPU"
                 value={metrics?.cpuPercent !== null ? `${metrics!.cpuPercent}%` : (status?.cpuPercent !== null ? `${status!.cpuPercent}%` : '—')}
                 color={cpuSeverity(metrics?.cpuPercent ?? status?.cpuPercent ?? null)} />
            <Row label="Memory"
                 value={metrics?.memoryMB !== null ? `${metrics!.memoryMB} MB` : (status?.memoryMB !== null ? `${status!.memoryMB} MB` : '—')}
                 color={memSeverity(metrics?.memoryMB ?? status?.memoryMB ?? null)} />
            <Row label="Xruns"     value={status?.xrunCount ?? 0}
                 color={xrunSeverity(status?.xrunCount ?? 0)} />
            <Row label="Latency"   value={status?.latencyMs !== null ? `${status!.latencyMs} ms` : '—'} />
          </Section>

          {/* ── Audio config ───────────────────────────────────────────── */}
          <Section title="Audio Config">
            <Row label="Driver"      value={status?.driver ?? '—'} />
            <Row label="Sample Rate" value={status?.sampleRate ? `${status.sampleRate} Hz` : '—'} />
            <Row label="Buffer"      value={status?.bufferSize ? `${status.bufferSize} frames` : '—'} />
          </Section>

          {/* ── Binary info ────────────────────────────────────────────── */}
          <Section title="Binary">
            <Row label="Found"  value={status?.binaryFound ? 'Yes' : 'No'}
                 color={status?.binaryFound ? C.green : C.red} />
            {status?.binaryPath && (
              <div style={S.pathRow}>
                <span style={S.label}>Path</span>
                <code style={S.codePath}>{status.binaryPath}</code>
              </div>
            )}
            <div style={S.pathToggle} onClick={() => setExpandPaths(p => !p)}>
              {expandPaths ? '▾' : '▸'} Searched paths ({status?.checkedPaths.length ?? 0})
            </div>
            {expandPaths && status?.checkedPaths.map((p, i) => (
              <div key={i} style={S.pathRow}>
                <span style={{ color: p === status.binaryPath ? C.green : C.dim }}>
                  {p === status.binaryPath ? '✓' : '✗'}
                </span>
                <code style={S.codePath}>{p}</code>
              </div>
            ))}
          </Section>

          {/* ── Recent crashes ─────────────────────────────────────────── */}
          {(status?.recentCrashes?.length ?? 0) > 0 && (
            <Section title={`Recent Crashes (${status!.recentCrashes.length})`}>
              {status!.recentCrashes.slice().reverse().map((c, i) => (
                <div key={i} style={S.crashRow}>
                  <span style={{ color: C.dim }}>{fmtTime(c.timestamp)}</span>
                  <span style={{ color: C.orange }}>
                    code={c.code ?? '—'} sig={c.signal ?? 'none'} restart#{c.restartNum}
                  </span>
                </div>
              ))}
            </Section>
          )}

          {/* ── Watchdog alerts ─────────────────────────────────────────── */}
          {alerts.length > 0 && (
            <Section title={`Watchdog Alerts (${alerts.length})`}>
              {alerts.slice().reverse().slice(0, 5).map((a, i) => (
                <div key={i} style={S.alertRow}>
                  <span style={{ color: C.yellow, fontWeight: 600 }}>[{a.kind}]</span>
                  <span style={{ color: C.text }}> {a.message}</span>
                </div>
              ))}
            </Section>
          )}

          {/* ── Fallback instructions ──────────────────────────────────── */}
          {!modeNative && (
            <Section title="Fix" accentColor={C.orange}>
              <div style={{ color: C.dim, fontSize: 11, lineHeight: 1.5 }}>
                <p>The native audio engine binary was not found.  To restore native mode:</p>
                <ol style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  <li>Open a terminal in the project root</li>
                  <li><code style={S.inlineCode}>cd native/audio-engine</code></li>
                  <li><code style={S.inlineCode}>cargo build --release</code></li>
                  <li>Restart Neurotek Studio</li>
                </ol>
              </div>
            </Section>
          )}

        </div>

        {/* ── Footer / Export ─────────────────────────────────────────── */}
        <div style={S.footer}>
          {exportMsg && <span style={{ color: exportMsg.startsWith('✓') ? C.green : C.red, fontSize: 11 }}>{exportMsg}</span>}
          <div style={S.footerBtns}>
            <button style={S.primaryBtn} onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting…' : '⬇  Export Logs'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children, accentColor }: {
  title: string
  children: React.ReactNode
  accentColor?: string
}) {
  return (
    <div style={S.section}>
      <div style={{ ...S.sectionTitle, color: accentColor ?? C.accent }}>{title}</div>
      {children}
    </div>
  )
}

function Row({ label, value, color }: {
  label: string
  value: string | number
  color?: string
}) {
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <span style={{ ...S.value, color: color ?? C.text }}>{String(value)}</span>
    </div>
  )
}

// ─── Colours ─────────────────────────────────────────────────────────────────

const C = {
  bg:      '#0f0f14',
  panel:   '#17171f',
  border:  '#2a2a38',
  accent:  '#7c3aed',
  green:   '#4ade80',
  yellow:  '#facc15',
  orange:  '#fb923c',
  red:     '#f87171',
  text:    '#e2e8f0',
  dim:     '#6b7280',
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position:        'fixed',
    inset:           0,
    zIndex:          10000,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    background:      'rgba(0,0,0,0.55)',
    backdropFilter:  'blur(4px)',
  },
  panel: {
    width:           520,
    maxHeight:       '85vh',
    display:         'flex',
    flexDirection:   'column',
    background:      C.panel,
    border:          `1px solid ${C.border}`,
    borderRadius:    10,
    overflow:        'hidden',
    fontSize:        12,
    fontFamily:      'system-ui, sans-serif',
    color:           C.text,
    boxShadow:       '0 24px 64px rgba(0,0,0,0.7)',
  },
  header: {
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'space-between',
    padding:         '10px 14px',
    borderBottom:    `1px solid ${C.border}`,
    background:      '#12121a',
    flexShrink:      0,
  },
  headerRight: {
    display:         'flex',
    gap:             6,
  },
  modeLabel: {
    fontWeight:      700,
    fontSize:        13,
    letterSpacing:   '0.03em',
  },
  iconBtn: {
    background:      'transparent',
    border:          `1px solid ${C.border}`,
    borderRadius:    4,
    color:           C.dim,
    fontSize:        14,
    padding:         '2px 8px',
    cursor:          'pointer',
    lineHeight:      1,
  },
  body: {
    flex:            1,
    overflowY:       'auto',
    padding:         12,
    display:         'flex',
    flexDirection:   'column',
    gap:             8,
  },
  section: {
    background:      '#1d1d27',
    border:          `1px solid ${C.border}`,
    borderRadius:    6,
    padding:         '8px 10px',
  },
  sectionTitle: {
    fontSize:        10,
    fontWeight:      700,
    letterSpacing:   '0.08em',
    textTransform:   'uppercase' as const,
    marginBottom:    6,
    opacity:         0.9,
  },
  row: {
    display:         'flex',
    justifyContent:  'space-between',
    padding:         '2px 0',
    borderBottom:    `1px solid #2a2a3810`,
  },
  label: {
    color:           C.dim,
    flexShrink:      0,
    width:           96,
  },
  value: {
    textAlign:       'right' as const,
    fontFamily:      'monospace',
    wordBreak:       'break-all' as const,
  },
  pathRow: {
    display:         'flex',
    gap:             6,
    alignItems:      'flex-start',
    padding:         '1px 0',
  },
  pathToggle: {
    color:           C.dim,
    cursor:          'pointer',
    marginTop:       4,
    fontSize:        11,
    userSelect:      'none' as const,
  },
  codePath: {
    fontFamily:      'monospace',
    fontSize:        10,
    color:           C.dim,
    wordBreak:       'break-all' as const,
    background:      '#0f0f1460',
    borderRadius:    2,
    padding:         '0 3px',
    flex:            1,
  },
  crashRow: {
    display:         'flex',
    gap:             8,
    fontSize:        11,
    padding:         '1px 0',
  },
  alertRow: {
    fontSize:        11,
    padding:         '2px 0',
    lineHeight:      1.4,
  },
  inlineCode: {
    fontFamily:      'monospace',
    fontSize:        11,
    background:      '#0f0f1480',
    borderRadius:    3,
    padding:         '1px 4px',
  },
  footer: {
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'space-between',
    padding:         '8px 14px',
    borderTop:       `1px solid ${C.border}`,
    background:      '#12121a',
    flexShrink:      0,
    gap:             8,
  },
  footerBtns: {
    display:         'flex',
    gap:             6,
    marginLeft:      'auto',
  },
  primaryBtn: {
    background:      C.accent,
    border:          'none',
    borderRadius:    5,
    color:           '#fff',
    fontSize:        12,
    fontWeight:      600,
    padding:         '5px 14px',
    cursor:          'pointer',
  },
}
