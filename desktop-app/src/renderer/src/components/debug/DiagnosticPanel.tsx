import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MemoryMonitor, type MemoryMetrics } from '../../perf/MemoryMonitor'
import { CpuMonitor,    type CpuSample }     from '../../perf/CpuMonitor'
import { PerformanceProfiler }               from '../../perf/PerformanceProfiler'
import { logger, type LogEntry, type LogLevel } from '../../debug/AdvancedLogger'
import { VirtualList }                       from '../perf/VirtualList'

type Tab = 'memory' | 'cpu' | 'profiler' | 'logs'

const memMonitor    = new MemoryMonitor({ intervalMs: 2000 })
const cpuMonitor    = new CpuMonitor({ intervalMs: 1000 })
const profiler      = new PerformanceProfiler()

export function DiagnosticPanel(): React.ReactElement {
  const [open,     setOpen]     = useState(false)
  const [tab,      setTab]      = useState<Tab>('memory')
  const [memData,  setMemData]  = useState<MemoryMetrics[]>([])
  const [cpuData,  setCpuData]  = useState<CpuSample[]>([])
  const [logs,     setLogs]     = useState<LogEntry[]>([])
  const [logLevel, setLogLevel] = useState<LogLevel | 'all'>('all')
  const [search,   setSearch]   = useState('')
  const canvasRef  = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); setOpen(o => !o) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    memMonitor.start()
    cpuMonitor.start()
    const unsubMem = memMonitor.subscribe(m => setMemData(prev => [...prev.slice(-59), m]))
    const unsubCpu = cpuMonitor.subscribe(s => setCpuData(prev => [...prev.slice(-59), s]))
    const unsubLog = logger.log.bind(logger)
    void unsubLog
    const unsubLogger = (() => {
      const refresh = () => setLogs(logger.getEntries())
      const origLog = logger.log.bind(logger)
      void origLog
      logger['onEntry'] = refresh
      return () => { logger['onEntry'] = undefined }
    })()
    return () => { memMonitor.stop(); cpuMonitor.stop(); unsubMem(); unsubCpu(); unsubLogger() }
  }, [open])

  const drawSparkline = useCallback((canvas: HTMLCanvasElement, data: number[], color: string) => {
    const ctx = canvas.getContext('2d')
    if (!ctx || data.length < 2) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const max = Math.max(...data, 1)
    ctx.strokeStyle = color
    ctx.lineWidth   = 1.5
    ctx.beginPath()
    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * canvas.width
      const y = canvas.height - (v / max) * canvas.height
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()
  }, [])

  useEffect(() => {
    if (!canvasRef.current) return
    if (tab === 'memory') drawSparkline(canvasRef.current, memData.map(m => m.heapUsedMB), '#10b981')
    if (tab === 'cpu')    drawSparkline(canvasRef.current, cpuData.map(c => c.userDeltaMs), '#f59e0b')
  }, [tab, memData, cpuData, drawSparkline])

  const filteredLogs = logs.filter(e =>
    (logLevel === 'all' || e.level === logLevel) &&
    (!search || e.message.toLowerCase().includes(search.toLowerCase()))
  )

  const copyLogs = () => navigator.clipboard.writeText(logger.export()).catch(() => undefined)

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      style={{ position: 'fixed', bottom: 8, right: 8, zIndex: 9999, padding: '4px 8px', fontSize: 11, background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 4, cursor: 'pointer' }}
      title="Open Diagnostics (Ctrl+Shift+D)"
    >
      ⚙ Diag
    </button>
  )

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '4px 12px', fontSize: 12, cursor: 'pointer', background: tab === t ? '#334155' : 'transparent',
    color: tab === t ? '#fff' : '#94a3b8', border: 'none', borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
  })

  const latest = memMonitor.getLatest()
  const latestCpu = cpuMonitor.getLatest()

  return (
    <div style={{ position: 'fixed', bottom: 48, right: 8, width: 480, maxHeight: '70vh', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, zIndex: 9999, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'monospace', fontSize: 12, color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', background: '#1e293b', borderBottom: '1px solid #334155' }}>
        <span style={{ fontWeight: 600, flex: 1 }}>Diagnostics</span>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #334155' }}>
        {(['memory', 'cpu', 'profiler', 'logs'] as Tab[]).map(t => (
          <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
        {(tab === 'memory' || tab === 'cpu') && (
          <>
            <canvas ref={canvasRef} width={440} height={80} style={{ width: '100%', height: 80, display: 'block', background: '#1e293b', borderRadius: 4, marginBottom: 8 }} />
            {tab === 'memory' && latest && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <tbody>
                  {[['Heap Used', `${latest.heapUsedMB.toFixed(1)} MB`], ['Heap Total', `${latest.heapTotalMB.toFixed(1)} MB`], ['RSS', `${latest.rssMB.toFixed(1)} MB`]].map(([k, v]) => (
                    <tr key={k}><td style={{ color: '#94a3b8', padding: '2px 0' }}>{k}</td><td style={{ color: '#10b981' }}>{v}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'cpu' && latestCpu && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <tbody>
                  {[['User (total)', `${latestCpu.userMs.toFixed(1)} ms`], ['User (delta)', `${latestCpu.userDeltaMs.toFixed(1)} ms`], ['System', `${latestCpu.systemMs.toFixed(1)} ms`]].map(([k, v]) => (
                    <tr key={k}><td style={{ color: '#94a3b8', padding: '2px 0' }}>{k}</td><td style={{ color: '#f59e0b' }}>{v}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {tab === 'profiler' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead><tr>{['Label','Marks'].map(h => <th key={h} style={{ textAlign: 'left', color: '#64748b', padding: '2px 4px', borderBottom: '1px solid #334155' }}>{h}</th>)}</tr></thead>
            <tbody>
              {profiler.getMarks().slice(-20).map((m, i) => (
                <tr key={i}><td style={{ padding: '2px 4px', color: '#94a3b8' }}>{m.label}</td><td style={{ padding: '2px 4px', color: '#6366f1' }}>{m.ts.toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'logs' && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <select value={logLevel} onChange={e => setLogLevel(e.target.value as LogLevel | 'all')} style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 4, padding: '2px 6px', fontSize: 11 }}>
                {['all','debug','info','warn','error'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ flex: 1, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 4, padding: '2px 6px', fontSize: 11 }} />
              <button onClick={copyLogs} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>Copy</button>
            </div>
            <VirtualList
              items={filteredLogs}
              itemHeight={22}
              containerHeight={260}
              renderItem={(entry) => (
                <div style={{ display: 'flex', gap: 6, padding: '2px 0', overflow: 'hidden' }}>
                  <span style={{ color: { debug:'#64748b',info:'#10b981',warn:'#f59e0b',error:'#ef4444' }[entry.level], minWidth: 40 }}>{entry.level}</span>
                  <span style={{ color: '#94a3b8', minWidth: 60 }}>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.message}</span>
                </div>
              )}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default DiagnosticPanel
