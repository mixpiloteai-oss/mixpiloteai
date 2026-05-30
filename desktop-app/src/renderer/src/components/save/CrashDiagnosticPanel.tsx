/**
 * CrashDiagnosticPanel — shows diagnostic report, log viewer, system info.
 */

import React, { useState, useEffect, useCallback } from 'react'
import type { LogLevel } from '../../../../main/DiagnosticLogger'

interface LogEntry {
  ts:        number
  level:     string
  category:  string
  msg:       string
  data?:     unknown
  sessionId: string
  pid:       number
}

interface CrashReport {
  generatedAt:     number
  sessionId:       string
  appVersion:      string
  platform:        string
  nodeVersion:     string
  electronVersion: string
  uptime:          number
  entries:         LogEntry[]
  summary: {
    errors:   number
    warnings: number
    fatals:   number
  }
}

type LevelFilter = 'all' | 'error' | 'warn' | 'fatal'

const LEVEL_COLORS: Record<string, string> = {
  debug: 'text-neutral-500',
  info:  'text-blue-400',
  warn:  'text-yellow-400',
  error: 'text-red-400',
  fatal: 'text-red-300 bg-red-950/30',
}

function formatTs(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return new Date(ts).toLocaleTimeString()
}

export function CrashDiagnosticPanel(): React.ReactElement {
  const [report,  setReport]  = useState<CrashReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter,  setFilter]  = useState<LevelFilter>('all')
  const [copied,  setCopied]  = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const raw = await window.electronAPI?.diagnosticGenerateReport?.()
      if (raw) setReport(raw as CrashReport)
    } catch { /* Electron API not available */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchReport() }, [fetchReport])

  async function handleClearLogs(): Promise<void> {
    try {
      await window.electronAPI?.diagnosticClear?.()
      await fetchReport()
    } catch { /* ignore */ }
  }

  function handleCopyReport(): void {
    if (!report) return
    navigator.clipboard.writeText(JSON.stringify(report, null, 2))
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  const visibleEntries = report?.entries.filter(e =>
    filter === 'all' ? true : e.level === filter,
  ) ?? []

  return (
    <div className="flex flex-col h-full bg-neutral-900 text-neutral-100 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
        <span className="font-semibold text-base">Diagnostic Logs</span>
        <div className="flex gap-2">
          <button
            onClick={() => void handleClearLogs()}
            className="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded"
          >
            Clear
          </button>
          <button
            onClick={handleCopyReport}
            disabled={!report}
            className="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 disabled:opacity-40 rounded"
          >
            {copied ? 'Copied!' : 'Copy Report'}
          </button>
          <button
            onClick={() => void fetchReport()}
            className="px-2 py-1 text-xs bg-purple-700 hover:bg-purple-600 rounded"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-neutral-500 text-xs">
          Loading…
        </div>
      )}

      {!loading && report && (
        <>
          {/* System info */}
          <div className="px-4 py-3 border-b border-neutral-700 bg-neutral-800/30 grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
            <div><span className="text-neutral-400">Session: </span><span className="font-mono">{report.sessionId.slice(0, 16)}…</span></div>
            <div><span className="text-neutral-400">Platform: </span>{report.platform}</div>
            <div><span className="text-neutral-400">App: </span>{report.appVersion}</div>
            <div><span className="text-neutral-400">Electron: </span>{report.electronVersion}</div>
            <div><span className="text-neutral-400">Node: </span>{report.nodeVersion}</div>
            <div><span className="text-neutral-400">Uptime: </span>{Math.floor(report.uptime)}s</div>
          </div>

          {/* Summary badges */}
          <div className="flex gap-3 px-4 py-2 border-b border-neutral-700 text-xs">
            <span className="text-red-400">{report.summary.errors} errors</span>
            <span className="text-yellow-400">{report.summary.warnings} warnings</span>
            <span className="text-red-300">{report.summary.fatals} fatals</span>
            <span className="text-neutral-500">{report.entries.length} total entries</span>
          </div>

          {/* Level filter */}
          <div className="flex gap-2 px-4 py-2 border-b border-neutral-700">
            {(['all', 'error', 'warn', 'fatal'] as LevelFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 text-xs rounded ${filter === f ? 'bg-purple-700 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Log entries */}
          <div className="flex-1 overflow-y-auto font-mono text-xs">
            {visibleEntries.length === 0 && (
              <div className="flex items-center justify-center py-8 text-neutral-500">
                No log entries{filter !== 'all' ? ` at level "${filter}"` : ''}
              </div>
            )}
            {visibleEntries.map((entry, i) => (
              <div
                key={i}
                className={`flex gap-3 px-4 py-1.5 border-b border-neutral-800/50 ${LEVEL_COLORS[entry.level] ?? ''}`}
              >
                <span className="text-neutral-600 shrink-0">{formatTs(entry.ts)}</span>
                <span className="shrink-0 w-10 uppercase font-bold">{entry.level.slice(0, 5)}</span>
                <span className="text-neutral-500 shrink-0">[{entry.category}]</span>
                <span className="truncate">{entry.msg}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && !report && (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-neutral-500 text-xs">
          <span>Diagnostic logging not available</span>
          <span>(Electron API required)</span>
        </div>
      )}
    </div>
  )
}
