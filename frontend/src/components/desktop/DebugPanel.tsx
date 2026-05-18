// ============================================================
// NEUROTEK AI — Debug Panel (Desktop Only)
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Info, AlertTriangle, RefreshCw, Clipboard, Terminal,
  Trash2, ChevronDown, ChevronRight, Bug,
} from 'lucide-react';

// ─── Data Interfaces ─────────────────────────────────────────

interface BuildInfo {
  version: string;
  buildDate: string;
  platform: string;
  arch: string;
  electron: string;
  node: string;
  chrome: string;
  isDev: boolean;
  channel: string;
}

interface PerfStats {
  cpuPercent: number;
  memUsedMB: number;
  memTotalMB: number;
  memPercent: number;
  processMemMB: number;
  uptimeSec: number;
  pid: number;
  cpuCount: number;
  cpuModel: string;
}

interface CrashLog {
  timestamp: string;
  type: string;
  message: string;
  stack: string;
  system: string;
}

interface AppPaths {
  userData: string;
  logs: string;
  temp: string;
  downloads: string;
  appPath: string;
  crashDir: string;
}

// ─── Helpers ─────────────────────────────────────────────────

const isElectron =
  typeof window !== 'undefined' && !!window.electronAPI;

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

function cpuBarColor(pct: number): string {
  if (pct >= 80) return '#ef4444';
  if (pct >= 50) return '#f59e0b';
  return '#22c55e';
}

function ramBarColor(pct: number): string {
  if (pct >= 80) return '#ef4444';
  if (pct >= 60) return '#f59e0b';
  return '#22c55e';
}

// ─── Sub-components ──────────────────────────────────────────

interface StatBarProps {
  label: string;
  value: string;
  percent: number;
  color: string;
}

function StatBar({ label, value, percent, color }: StatBarProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span style={{ color: '#9ca3af' }}>{label}</span>
        <span className="font-mono" style={{ color: '#e5e7eb' }}>{value}</span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

interface CopyButtonProps {
  text: string;
}

function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {/* ignore */});
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors"
      style={{
        background: copied ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.05)',
        color: copied ? '#a78bfa' : '#6b7280',
        border: `1px solid ${copied ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      <Clipboard size={10} />
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ─── Tab: Performance ────────────────────────────────────────

function PerformanceTab() {
  const [perf, setPerf] = useState<PerfStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(() => {
    if (!isElectron) return;
    setLoading(true);
    window.electronAPI!.debugGetPerfStats()
      .then((data) => {
        setPerf(data);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStats();

    // Real-time listener
    if (isElectron) {
      window.electronAPI!.onPerfStats((data: PerfStats) => {
        setPerf(data);
      });
    }

    // Fallback polling every 3s
    const interval = setInterval(fetchStats, 3000);

    return () => {
      clearInterval(interval);
      if (isElectron) {
        window.electronAPI!.removeAllListeners?.('perf-stats');
      }
    };
  }, [fetchStats]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: '#a78bfa' }}>Performance Monitor</h3>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{
            background: 'rgba(167,139,250,0.1)',
            border: '1px solid rgba(167,139,250,0.2)',
            color: '#a78bfa',
          }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {perf ? (
        <div className="space-y-4">
          <StatBar
            label="CPU Usage"
            value={`${perf.cpuPercent.toFixed(1)}%`}
            percent={perf.cpuPercent}
            color={cpuBarColor(perf.cpuPercent)}
          />
          <StatBar
            label="RAM Usage"
            value={`${perf.memUsedMB.toFixed(0)} / ${perf.memTotalMB.toFixed(0)} MB`}
            percent={perf.memPercent}
            color={ramBarColor(perf.memPercent)}
          />

          <div
            className="rounded-xl p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div style={{ color: '#6b7280' }}>Process Memory</div>
                <div className="font-mono mt-0.5" style={{ color: '#e5e7eb' }}>{perf.processMemMB.toFixed(1)} MB</div>
              </div>
              <div>
                <div style={{ color: '#6b7280' }}>App Uptime</div>
                <div className="font-mono mt-0.5" style={{ color: '#e5e7eb' }}>{formatUptime(perf.uptimeSec)}</div>
              </div>
              <div>
                <div style={{ color: '#6b7280' }}>PID</div>
                <div className="font-mono mt-0.5" style={{ color: '#e5e7eb' }}>{perf.pid}</div>
              </div>
              <div>
                <div style={{ color: '#6b7280' }}>CPU Cores</div>
                <div className="font-mono mt-0.5" style={{ color: '#e5e7eb' }}>{perf.cpuCount}</div>
              </div>
            </div>
            <div>
              <div className="text-xs mb-0.5" style={{ color: '#6b7280' }}>CPU Model</div>
              <div
                className="text-xs font-mono truncate"
                style={{ color: '#e5e7eb' }}
                title={perf.cpuModel}
              >
                {perf.cpuModel}
              </div>
            </div>
          </div>
        </div>
      ) : !loading && (
        <div className="text-xs text-center py-8" style={{ color: '#4b5563' }}>
          No performance data available
        </div>
      )}
    </div>
  );
}

// ─── Tab: Build Info ─────────────────────────────────────────

function BuildInfoTab() {
  const [info, setInfo] = useState<BuildInfo | null>(null);
  const [paths, setPaths] = useState<AppPaths | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [devToolsMsg, setDevToolsMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isElectron) return;
    Promise.all([
      window.electronAPI!.debugGetBuildInfo(),
      window.electronAPI!.debugGetAppPaths(),
    ])
      .then(([buildData, pathData]) => {
        setInfo(buildData);
        setPaths(pathData);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function handleOpenDevTools() {
    if (!isElectron) return;
    window.electronAPI!.debugOpenDevTools()
      .then(() => {
        setDevToolsMsg('DevTools opened');
        setTimeout(() => setDevToolsMsg(null), 2000);
      })
      .catch((err: Error) => setDevToolsMsg(`Error: ${err.message}`));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: '#a78bfa' }}>Build Information</h3>
        <button
          onClick={handleOpenDevTools}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{
            background: 'rgba(167,139,250,0.1)',
            border: '1px solid rgba(167,139,250,0.2)',
            color: '#a78bfa',
          }}
        >
          <Terminal size={12} />
          Open DevTools
        </button>
      </div>

      {devToolsMsg && (
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}>
          {devToolsMsg}
        </div>
      )}

      {info && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div style={{ color: '#6b7280' }}>Version</div>
              <div className="font-mono mt-0.5" style={{ color: '#e5e7eb' }}>{info.version}</div>
            </div>
            <div>
              <div style={{ color: '#6b7280' }}>Channel</div>
              <div className="font-mono mt-0.5">
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                  style={{
                    background: info.channel === 'stable'
                      ? 'rgba(34,197,94,0.15)'
                      : info.channel === 'beta'
                        ? 'rgba(245,158,11,0.15)'
                        : 'rgba(167,139,250,0.15)',
                    color: info.channel === 'stable'
                      ? '#4ade80'
                      : info.channel === 'beta'
                        ? '#fbbf24'
                        : '#a78bfa',
                  }}
                >
                  {info.channel}
                </span>
              </div>
            </div>
            <div>
              <div style={{ color: '#6b7280' }}>Build Date</div>
              <div className="font-mono mt-0.5" style={{ color: '#e5e7eb' }}>{info.buildDate}</div>
            </div>
            <div>
              <div style={{ color: '#6b7280' }}>Platform</div>
              <div className="font-mono mt-0.5" style={{ color: '#e5e7eb' }}>{info.platform} / {info.arch}</div>
            </div>
            <div>
              <div style={{ color: '#6b7280' }}>Electron</div>
              <div className="font-mono mt-0.5" style={{ color: '#e5e7eb' }}>v{info.electron}</div>
            </div>
            <div>
              <div style={{ color: '#6b7280' }}>Node.js</div>
              <div className="font-mono mt-0.5" style={{ color: '#e5e7eb' }}>v{info.node}</div>
            </div>
            <div className="col-span-2">
              <div style={{ color: '#6b7280' }}>Chrome</div>
              <div className="font-mono mt-0.5" style={{ color: '#e5e7eb' }}>v{info.chrome}</div>
            </div>
          </div>
        </div>
      )}

      {paths && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>App Paths</h4>
          {(
            [
              { label: 'User Data',   value: paths.userData },
              { label: 'Logs',        value: paths.logs },
              { label: 'Crash Dir',   value: paths.crashDir },
            ] as Array<{ label: string; value: string }>
          ).map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg p-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium" style={{ color: '#9ca3af' }}>{label}</span>
                <CopyButton text={value} />
              </div>
              <div
                className="text-xs font-mono break-all"
                style={{ color: '#6b7280' }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Crash Logs ─────────────────────────────────────────

interface CrashLogItemProps {
  log: CrashLog;
}

function CrashLogItem({ log }: CrashLogItemProps) {
  const [expanded, setExpanded] = useState(false);

  const typeColor: Record<string, string> = {
    error:   '#f87171',
    warning: '#fbbf24',
    crash:   '#ef4444',
    info:    '#60a5fa',
  };
  const color = typeColor[log.type.toLowerCase()] ?? '#9ca3af';

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <button
        className="w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-white/5"
        onClick={() => setExpanded((v) => !v)}
      >
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0"
          style={{ background: `${color}20`, color }}
        >
          {log.type}
        </span>
        <span className="flex-1 text-xs truncate" style={{ color: '#d1d5db' }}>{log.message}</span>
        <span className="text-[10px] font-mono shrink-0" style={{ color: '#4b5563' }}>
          {new Date(log.timestamp).toLocaleString()}
        </span>
        {expanded
          ? <ChevronDown size={12} style={{ color: '#6b7280', flexShrink: 0 }} />
          : <ChevronRight size={12} style={{ color: '#6b7280', flexShrink: 0 }} />
        }
      </button>

      {expanded && (
        <div
          className="px-3 pb-3 space-y-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          {log.stack && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#6b7280' }}>Stack Trace</div>
              <pre
                className="text-[10px] font-mono whitespace-pre-wrap break-all overflow-x-auto p-2 rounded"
                style={{ background: 'rgba(0,0,0,0.3)', color: '#9ca3af', maxHeight: 160 }}
              >
                {log.stack}
              </pre>
            </div>
          )}
          {log.system && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#6b7280' }}>System</div>
              <pre
                className="text-[10px] font-mono whitespace-pre-wrap break-all overflow-x-auto p-2 rounded"
                style={{ background: 'rgba(0,0,0,0.3)', color: '#9ca3af', maxHeight: 120 }}
              >
                {log.system}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CrashLogsTab() {
  const [logs, setLogs] = useState<CrashLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearMsg, setClearMsg] = useState<string | null>(null);

  const fetchLogs = useCallback(() => {
    if (!isElectron) return;
    setLoading(true);
    window.electronAPI!.debugListCrashLogs()
      .then((data) => {
        setLogs(data);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function handleClearLogs() {
    if (!isElectron) return;
    setClearing(true);
    window.electronAPI!.debugClearCrashLogs()
      .then((count) => {
        setLogs([]);
        setClearMsg(`Cleared ${count} log${count !== 1 ? 's' : ''}`);
        setTimeout(() => setClearMsg(null), 2500);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setClearing(false));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: '#a78bfa' }}>
          Crash Logs
          {logs.length > 0 && (
            <span
              className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
            >
              {logs.length}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{
              background: 'rgba(167,139,250,0.1)',
              border: '1px solid rgba(167,139,250,0.2)',
              color: '#a78bfa',
            }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          {logs.length > 0 && (
            <button
              onClick={handleClearLogs}
              disabled={clearing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171',
              }}
            >
              <Trash2 size={12} />
              {clearing ? 'Clearing…' : 'Clear Logs'}
            </button>
          )}
        </div>
      </div>

      {clearMsg && (
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}>
          {clearMsg}
        </div>
      )}

      {error && (
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
        >
          <AlertTriangle size={32} style={{ color: '#374151' }} className="mb-3" />
          <div className="text-sm font-medium" style={{ color: '#4b5563' }}>No crash logs</div>
          <div className="text-xs mt-1" style={{ color: '#374151' }}>The application is running clean</div>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '480px' }}>
          {logs.map((log, idx) => (
            <CrashLogItem key={`${log.timestamp}-${idx}`} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

type TabId = 'performance' | 'build' | 'crashes';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { id: 'performance', label: 'Performance', icon: <Activity size={14} /> },
  { id: 'build',       label: 'Build Info',  icon: <Info size={14} /> },
  { id: 'crashes',     label: 'Crash Logs',  icon: <AlertTriangle size={14} /> },
];

export default function DebugPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('performance');

  if (!isElectron) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full"
        style={{ background: '#0a0a0f' }}
      >
        <Bug size={48} style={{ color: '#374151' }} className="mb-4" />
        <div className="text-lg font-semibold mb-2" style={{ color: '#6b7280' }}>
          Debug Panel
        </div>
        <div className="text-sm text-center max-w-sm" style={{ color: '#4b5563' }}>
          This panel is only available in the desktop app (Electron).
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: '#0a0a0f', fontFamily: 'inherit' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <Bug size={20} style={{ color: '#10b981' }} />
        <div>
          <h2 className="text-base font-bold" style={{ color: '#f9fafb' }}>Debug Panel</h2>
          <p className="text-xs" style={{ color: '#6b7280' }}>Diagnostics &amp; system information</p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-1 px-6 pt-4 pb-0 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors relative"
              style={{
                color: isActive ? '#a78bfa' : '#6b7280',
                background: isActive ? 'rgba(167,139,250,0.08)' : 'transparent',
                borderBottom: isActive ? '2px solid #a78bfa' : '2px solid transparent',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {activeTab === 'performance' && <PerformanceTab />}
        {activeTab === 'build'       && <BuildInfoTab />}
        {activeTab === 'crashes'     && <CrashLogsTab />}
      </div>
    </div>
  );
}
