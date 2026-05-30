// ============================================================
// NEUROTEK AI — Admin Dashboard (Production SaaS Control Center)
// ============================================================
// Real-time analytics: MRR, users, AI, marketplace, monitoring.
// Comparable to Stripe Dashboard / Vercel Analytics / Supabase Admin.
// ============================================================
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart2, TrendingUp, TrendingDown, Users, DollarSign, Zap,
  ShoppingBag, Server, RefreshCw, Download, AlertTriangle, CheckCircle,
  Activity, Cpu, Database, Clock, ChevronUp, ChevronDown, X, LogOut,
  Shield, Settings, Eye,
} from 'lucide-react';
import {
  adminAnalytics, adminAuth, adminApi,
  setAdminToken, clearAdminToken, getAdminToken,
  type DashboardSummary, type RevenueTimeSeries, type SystemMetrics,
} from '../services/adminApi';

// ── Formatters ───────────────────────────────────────────────

const fmtCents = (cents: number): string => {
  const usd = cents / 100;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}k`;
  return `$${usd.toFixed(2)}`;
};

const fmtPct = (v: number, decimals = 1): string =>
  `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}%`;

const fmtNum = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
};

const fmtUptime = (secs: number): string => {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

// ── Mini sparkline (pure SVG, no lib) ────────────────────────

function Sparkline({ data, color = '#7c3aed', height = 40 }: {
  data: number[]; color?: string; height?: number;
}) {
  if (data.length < 2) return <div className="h-10" />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 120;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={height} className="opacity-80">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Bar chart (24-hour distribution) ────────────────────────

function HourlyBar({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-16 w-full">
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
          <div
            className="w-full rounded-sm transition-all duration-300"
            style={{
              height: `${Math.max(2, (v / max) * 52)}px`,
              background: i === new Date().getHours()
                ? '#7c3aed' : 'rgba(124,58,237,0.35)',
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ── Monthly bar chart ──────────────────────────────────────

function MonthlyBar({ data }: { data: Array<{ date: string; value: number }> }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1 h-32 w-full">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t transition-all duration-500"
            style={{
              height: `${Math.max(2, (d.value / max) * 112)}px`,
              background: i === data.length - 1 ? '#7c3aed' : 'rgba(124,58,237,0.5)',
            }}
            title={`${d.date}: ${fmtCents(d.value)}`}
          />
          {data.length <= 12 && (
            <span className="text-[9px] text-gray-500 truncate w-full text-center">
              {d.date.slice(5)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── KPI card ────────────────────────────────────────────────

function KpiCard({
  label, value, subValue, trend, trendPositive, sparkData, color = '#7c3aed',
  isMock = false, icon: Icon,
}: {
  label: string; value: string; subValue?: string;
  trend?: number; trendPositive?: boolean;
  sparkData?: number[]; color?: string; isMock?: boolean;
  icon: React.ElementType;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5 relative overflow-hidden"
    >
      {isMock && (
        <span className="absolute top-2 right-2 text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-mono">
          DEMO
        </span>
      )}
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg" style={{ background: `${color}20` }}>
          <Icon size={16} style={{ color }} />
        </div>
        {sparkData && sparkData.length > 1 && <Sparkline data={sparkData} color={color} />}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-sm text-gray-400">{label}</span>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trendPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {trendPositive ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      {subValue && <div className="text-xs text-gray-500 mt-1">{subValue}</div>}
    </motion.div>
  );
}

// ── Live metric bar ───────────────────────────────────────────

function LiveBar({ label, value, max, unit, color }: {
  label: string; value: number; max: number; unit: string; color: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const danger = pct > 85;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className={danger ? 'text-red-400' : 'text-gray-300'}>
          {value.toFixed(1)}{unit}
        </span>
      </div>
      <div className="h-1.5 bg-gray-700/60 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: danger ? '#ef4444' : color }}
        />
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────

function SectionHeader({ title, icon: Icon, badge }: {
  title: string; icon: React.ElementType; badge?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={16} className="text-purple-400" />
      <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">{title}</h2>
      {badge && (
        <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-mono">
          {badge}
        </span>
      )}
    </div>
  );
}

// ── Login form ────────────────────────────────────────────────

function AdminLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { accessToken } = await adminAuth.login(email, password);
      setAdminToken(accessToken);
      onLogin(accessToken);
    } catch {
      setError('Invalid credentials or insufficient permissions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-gray-900 border border-gray-700/50 rounded-2xl p-8"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Admin Console</h1>
            <p className="text-xs text-gray-400">NeuroTek AI Control Center</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              placeholder="admin@neurotek.ai" required autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              placeholder="••••••••" required
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}
          <button
            type="submit" disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? 'Signing in…' : 'Sign in to Admin'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────

type Tab = 'overview' | 'revenue' | 'users' | 'ai' | 'marketplace' | 'monitoring';

interface LiveMetrics { cpu: number; ram: { used: number; total: number }; }

export default function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(!!getAdminToken());
  const [tab, setTab] = useState<Tab>('overview');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [revSeries, setRevSeries] = useState<RevenueTimeSeries | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics | null>(null);
  const [sysMetrics, setSysMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const sseRef = useRef<EventSource | null>(null);

  const loadData = useCallback(async () => {
    if (!getAdminToken()) return;
    setLoading(true);
    setError(null);
    try {
      const [dash, series, sys] = await Promise.all([
        adminAnalytics.dashboard(),
        adminAnalytics.revenueSeries('12m'),
        adminAnalytics.system(),
      ]);
      setSummary(dash);
      setRevSeries(series);
      setSysMetrics(sys);
      setLastRefresh(new Date());
    } catch (err) {
      setError('Failed to load analytics. Check admin credentials.');
    } finally {
      setLoading(false);
    }
  }, []);

  // SSE for live server metrics
  useEffect(() => {
    if (!authenticated) return;

    const token = getAdminToken();
    const url = `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/admin/analytics/system/live?token=${encodeURIComponent(token ?? '')}`;
    const sse = new EventSource(url);
    sseRef.current = sse;

    sse.addEventListener('metrics', (e) => {
      try {
        const data = JSON.parse(e.data) as { cpu: number; ram: { used: number; total: number } };
        setLiveMetrics(data);
      } catch { /* ignore */ }
    });
    sse.onerror = () => { sse.close(); };

    return () => { sse.close(); };
  }, [authenticated]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!authenticated || !autoRefresh) return;
    loadData();
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [authenticated, autoRefresh, loadData]);

  const handleLogout = async () => {
    try { await adminAuth.logout(); } catch { /* ignore */ }
    clearAdminToken();
    setAuthenticated(false);
  };

  const downloadCsv = (type: 'revenue' | 'users' | 'ai' | 'marketplace') => {
    const url = `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/admin/analytics/export/csv?type=${type}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (!authenticated) {
    return <AdminLogin onLogin={() => { setAuthenticated(true); loadData(); }} />;
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'ai', label: 'AI Usage', icon: Zap },
    { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
    { id: 'monitoring', label: 'Monitoring', icon: Server },
  ];

  const r = summary?.revenue;
  const u = summary?.users;
  const ai = summary?.ai;
  const mp = summary?.marketplace;
  const sys = sysMetrics ?? summary?.system;
  const live = liveMetrics;

  const memPct = live
    ? Math.round((live.ram.used / live.ram.total) * 100)
    : sys ? Math.round((sys.memUsedMb / sys.memTotalMb) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Top bar */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center">
                <Shield size={14} className="text-white" />
              </div>
              <span className="font-semibold text-sm">Admin Console</span>
            </div>
            <div className="h-4 w-px bg-gray-700" />
            <div className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
              <span className="text-xs text-gray-400">
                {live ? 'Live' : 'Last: ' + lastRefresh.toLocaleTimeString()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(v => !v)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                autoRefresh ? 'border-purple-500/50 text-purple-400 bg-purple-500/10' : 'border-gray-700 text-gray-400'
              }`}
            >
              <RefreshCw size={11} className="inline mr-1" />
              {autoRefresh ? 'Auto' : 'Paused'}
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="text-xs px-2.5 py-1 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={11} className={`inline mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="text-xs px-2.5 py-1 rounded-lg border border-gray-700 text-gray-400 hover:text-red-400 transition-colors"
            >
              <LogOut size={11} className="inline mr-1" />
              Logout
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-screen-2xl mx-auto px-6 flex gap-1 pb-0.5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
                tab === t.id
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">
            <AlertTriangle size={14} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {loading && !summary && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[0,1,2,3].map(i => (
              <div key={i} className="bg-gray-800/40 rounded-xl h-32 animate-pulse" />
            ))}
          </div>
        )}

        {/* ── OVERVIEW ───────────────────────────────────────────── */}
        {tab === 'overview' && (
          <AnimatePresence mode="wait">
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* KPI Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard
                  label="MRR" value={r ? fmtCents(r.mrr) : '—'}
                  subValue={r ? `ARR ${fmtCents(r.arr)}` : undefined}
                  trend={r?.mrrGrowthPct} trendPositive={(r?.mrrGrowthPct ?? 0) > 0}
                  sparkData={revSeries?.monthly.map(p => p.value)}
                  isMock={r?.isMock} icon={DollarSign} color="#10b981"
                />
                <KpiCard
                  label="Total Users" value={u ? fmtNum(u.totalUsers) : '—'}
                  subValue={u ? `${fmtNum(u.newUsersThisMonth)} new this month` : undefined}
                  trend={u?.userGrowthPct} trendPositive={(u?.userGrowthPct ?? 0) > 0}
                  isMock={u?.isMock} icon={Users} color="#6366f1"
                />
                <KpiCard
                  label="AI Requests" value={ai ? fmtNum(ai.requestsThisMonth) : '—'}
                  subValue={ai ? `Cache hit ${ai.cacheHitRate.toFixed(0)}%` : undefined}
                  sparkData={ai?.hourlyDistribution}
                  isMock={ai?.isMock} icon={Zap} color="#f59e0b"
                />
                <KpiCard
                  label="Conversion" value={u ? `${u.conversionRate.toFixed(1)}%` : '—'}
                  subValue={u ? `Churn ${r?.churnRate.toFixed(1)}%` : undefined}
                  trendPositive={true}
                  isMock={u?.isMock} icon={TrendingUp} color="#7c3aed"
                />
              </div>

              {/* Revenue chart + System status */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <SectionHeader title="Revenue (12 months)" icon={DollarSign} />
                    <button
                      onClick={() => downloadCsv('revenue')}
                      className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1"
                    >
                      <Download size={11} /> CSV
                    </button>
                  </div>
                  {revSeries?.monthly && <MonthlyBar data={revSeries.monthly} />}
                </div>

                <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
                  <SectionHeader title="System" icon={Server} badge={live ? 'LIVE' : undefined} />
                  <div className="space-y-4">
                    <LiveBar
                      label="CPU" value={live?.cpu ?? sys?.cpuUsagePct ?? 0}
                      max={100} unit="%" color="#7c3aed"
                    />
                    <LiveBar
                      label="Memory" value={memPct}
                      max={100} unit="%" color="#6366f1"
                    />
                    <LiveBar
                      label="Error Rate" value={sys?.errorRate ?? 0}
                      max={10} unit="%" color="#ef4444"
                    />
                    <div className="pt-2 border-t border-gray-700/50 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Uptime</span>
                        <span className="text-gray-200">{sys ? fmtUptime(sys.uptimeSeconds) : '—'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">P95 Latency</span>
                        <span className="text-gray-200">{sys ? `${sys.p95LatencyMs}ms` : '—'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Node</span>
                        <span className="text-gray-200">{sys?.nodeVersion ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Plan breakdown + AI costs */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
                  <SectionHeader title="Users by Plan" icon={Users} />
                  {u && (
                    <div className="space-y-2">
                      {(Object.entries(u.byPlan) as Array<[string, number]>).map(([plan, count]) => {
                        const total = u.totalUsers || 1;
                        const pct = Math.round((count / total) * 100);
                        const colors: Record<string, string> = {
                          free: '#6b7280', pro: '#6366f1', studio: '#7c3aed', label: '#a855f7',
                        };
                        return (
                          <div key={plan}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="capitalize text-gray-300">{plan}</span>
                              <span className="text-gray-400">{count} ({pct}%)</span>
                            </div>
                            <div className="h-1.5 bg-gray-700/50 rounded-full">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colors[plan] }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
                  <SectionHeader title="AI Cost Breakdown" icon={Zap} />
                  {ai && (
                    <div className="space-y-3">
                      <div className="text-2xl font-bold text-amber-400">
                        {fmtCents(ai.estimatedCostCents)}
                      </div>
                      <div className="text-xs text-gray-400">estimated this month</div>
                      <div className="space-y-2">
                        {ai.topModels.slice(0, 3).map(m => (
                          <div key={m.model} className="flex justify-between text-xs">
                            <span className="text-gray-300 truncate">{m.model}</span>
                            <span className="text-gray-400">{fmtNum(m.requests)} req</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
                  <SectionHeader title="Marketplace" icon={ShoppingBag} />
                  {mp && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-lg font-bold text-white">{mp.totalSales}</div>
                          <div className="text-xs text-gray-400">total sales</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-emerald-400">{fmtCents(mp.totalRevenueCents)}</div>
                          <div className="text-xs text-gray-400">revenue</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        Commission: {fmtCents(mp.platformCommissionCents)}
                      </div>
                      <div className="text-xs">
                        <span className="text-amber-400">{mp.pendingProducts}</span>
                        <span className="text-gray-400"> pending review</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── REVENUE ──────────────────────────────────────────────── */}
        {tab === 'revenue' && (
          <motion.div key="revenue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Revenue Analytics</h2>
              <div className="flex gap-2">
                <button onClick={() => downloadCsv('revenue')} className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 text-gray-300 flex items-center gap-1">
                  <Download size={11} /> Export CSV
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <KpiCard label="MRR" value={r ? fmtCents(r.mrr) : '—'} icon={DollarSign} color="#10b981" isMock={r?.isMock} />
              <KpiCard label="ARR" value={r ? fmtCents(r.arr) : '—'} subValue="annualized run rate" icon={TrendingUp} color="#6366f1" isMock={r?.isMock} />
              <KpiCard label="This Month" value={r ? fmtCents(r.revenueThisMonth) : '—'} trend={r?.mrrGrowthPct} trendPositive={(r?.mrrGrowthPct ?? 0) > 0} icon={DollarSign} color="#7c3aed" isMock={r?.isMock} />
              <KpiCard label="Churn Rate" value={r ? `${r.churnRate.toFixed(1)}%` : '—'} subValue={r ? `${r.cancelledSubscriptions} cancelled` : undefined} icon={TrendingDown} color="#ef4444" isMock={r?.isMock} />
            </div>
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
              <SectionHeader title="Monthly Revenue" icon={BarChart2} />
              {revSeries?.monthly && <MonthlyBar data={revSeries.monthly} />}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
                <SectionHeader title="Subscription Metrics" icon={Users} />
                <div className="space-y-3">
                  {[
                    ['New subscriptions', r?.newSubscriptions ?? 0, 'text-emerald-400'],
                    ['Cancellations', r?.cancelledSubscriptions ?? 0, 'text-red-400'],
                    ['ARPU', r ? fmtCents(r.averageRevenuePerUser) : '—', 'text-purple-400'],
                  ].map(([label, value, cls]) => (
                    <div key={label as string} className="flex justify-between text-sm">
                      <span className="text-gray-400">{label as string}</span>
                      <span className={cls as string}>{value as string}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
                <SectionHeader title="Daily Revenue (30d)" icon={BarChart2} />
                {revSeries?.daily && (
                  <MonthlyBar data={revSeries.daily.slice(-30).map(d => ({
                    date: d.date.slice(5), value: d.value,
                  }))} />
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── USERS ────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">User Analytics</h2>
              <button onClick={() => downloadCsv('users')} className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 text-gray-300 flex items-center gap-1">
                <Download size={11} /> Export CSV
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <KpiCard label="Total Users" value={u ? fmtNum(u.totalUsers) : '—'} icon={Users} color="#6366f1" isMock={u?.isMock} />
              <KpiCard label="Active (30d)" value={u ? fmtNum(u.activeUsers) : '—'} icon={Activity} color="#10b981" isMock={u?.isMock} />
              <KpiCard label="New This Month" value={u ? fmtNum(u.newUsersThisMonth) : '—'} trend={u?.userGrowthPct} trendPositive={(u?.userGrowthPct ?? 0) > 0} icon={TrendingUp} color="#7c3aed" isMock={u?.isMock} />
              <KpiCard label="Conversion" value={u ? `${u.conversionRate.toFixed(1)}%` : '—'} subValue="free → paid" icon={ChevronUp} color="#f59e0b" isMock={u?.isMock} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
                <SectionHeader title="Plan Distribution" icon={Users} />
                {u && (
                  <div className="space-y-3">
                    {(Object.entries(u.byPlan) as Array<[string, number]>).map(([plan, count]) => {
                      const pct = Math.round((count / u.totalUsers) * 100);
                      const colors: Record<string, string> = { free: '#6b7280', pro: '#6366f1', studio: '#7c3aed', label: '#a855f7' };
                      return (
                        <div key={plan}>
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="capitalize text-gray-300 font-medium">{plan}</span>
                            <span className="text-gray-400">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-gray-700/50 rounded-full">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colors[plan] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
                <SectionHeader title="Retention Metrics" icon={Eye} />
                <div className="space-y-4">
                  {[
                    { label: 'Retention Rate', value: u ? `${u.retentionRate.toFixed(1)}%` : '—', color: '#10b981' },
                    { label: 'Churn Rate', value: r ? `${r.churnRate.toFixed(1)}%` : '—', color: '#ef4444' },
                    { label: 'New Last Month', value: u ? fmtNum(u.newUsersLastMonth) : '—', color: '#6366f1' },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">{item.label}</span>
                      <span className="text-sm font-semibold" style={{ color: item.color }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── AI USAGE ─────────────────────────────────────────────── */}
        {tab === 'ai' && (
          <motion.div key="ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">AI Usage & Costs</h2>
              <button onClick={() => downloadCsv('ai')} className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 text-gray-300 flex items-center gap-1">
                <Download size={11} /> Export CSV
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <KpiCard label="Requests Today" value={ai ? fmtNum(ai.requestsToday) : '—'} icon={Zap} color="#f59e0b" isMock={ai?.isMock} />
              <KpiCard label="This Month" value={ai ? fmtNum(ai.requestsThisMonth) : '—'} icon={Activity} color="#6366f1" isMock={ai?.isMock} />
              <KpiCard label="Cache Hit Rate" value={ai ? `${ai.cacheHitRate.toFixed(1)}%` : '—'} subValue="dedup cache" icon={Database} color="#10b981" isMock={ai?.isMock} />
              <KpiCard label="Est. Cost" value={ai ? fmtCents(ai.estimatedCostCents) : '—'} subValue="this month" icon={DollarSign} color="#ef4444" isMock={ai?.isMock} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
                <SectionHeader title="Requests by Hour (today)" icon={Clock} />
                {ai?.hourlyDistribution && <HourlyBar data={ai.hourlyDistribution} />}
                <div className="mt-2 text-xs text-gray-500">Current hour highlighted in purple</div>
              </div>
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
                <SectionHeader title="Performance" icon={Activity} />
                <div className="space-y-3">
                  {[
                    { label: 'Avg Latency', value: ai ? `${ai.avgLatencyMs}ms` : '—' },
                    { label: 'Error Rate', value: ai ? `${ai.errorRate.toFixed(1)}%` : '—' },
                    { label: 'Total All-Time', value: ai ? fmtNum(ai.totalRequestsAllTime) : '—' },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between text-sm">
                      <span className="text-gray-400">{item.label}</span>
                      <span className="text-gray-200 font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
              <SectionHeader title="Usage by Plan" icon={Users} />
              {ai && (
                <div className="grid grid-cols-3 gap-6">
                  {(Object.entries(ai.byPlan) as Array<[string, number]>).map(([plan, count]) => (
                    <div key={plan} className="text-center">
                      <div className="text-2xl font-bold text-white">{fmtNum(count)}</div>
                      <div className="text-xs text-gray-400 capitalize mt-1">{plan} plan</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── MARKETPLACE ──────────────────────────────────────────── */}
        {tab === 'marketplace' && (
          <motion.div key="marketplace" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Marketplace Analytics</h2>
              <button onClick={() => downloadCsv('marketplace')} className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 text-gray-300 flex items-center gap-1">
                <Download size={11} /> Export CSV
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <KpiCard label="Total Products" value={mp ? fmtNum(mp.totalProducts) : '—'} icon={ShoppingBag} color="#6366f1" isMock={mp?.isMock} />
              <KpiCard label="Total Sales" value={mp ? fmtNum(mp.totalSales) : '—'} icon={TrendingUp} color="#10b981" isMock={mp?.isMock} />
              <KpiCard label="Revenue" value={mp ? fmtCents(mp.totalRevenueCents) : '—'} icon={DollarSign} color="#f59e0b" isMock={mp?.isMock} />
              <KpiCard label="Pending Review" value={mp ? String(mp.pendingProducts) : '—'} icon={AlertTriangle} color="#ef4444" isMock={mp?.isMock} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
                <SectionHeader title="Top Categories" icon={ShoppingBag} />
                {mp?.topCategories.map(c => (
                  <div key={c.category} className="flex justify-between text-sm py-1.5 border-b border-gray-700/30">
                    <span className="text-gray-300">{c.category}</span>
                    <span className="text-gray-400">{c.count}</span>
                  </div>
                ))}
              </div>
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
                <SectionHeader title="Commission" icon={DollarSign} />
                <div className="space-y-3">
                  <div className="text-2xl font-bold text-emerald-400">{mp ? fmtCents(mp.platformCommissionCents) : '—'}</div>
                  <div className="text-xs text-gray-400">platform commission earned</div>
                  {mp && (
                    <div className="text-xs text-gray-400">
                      {mp.approvedProducts} approved / {mp.pendingProducts} pending
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── MONITORING ───────────────────────────────────────────── */}
        {tab === 'monitoring' && (
          <motion.div key="monitoring" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">System Monitoring</h2>
              {live && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">LIVE</span>}
            </div>
            <div className="grid grid-cols-4 gap-4">
              <KpiCard label="CPU Usage" value={`${(live?.cpu ?? sys?.cpuUsagePct ?? 0).toFixed(1)}%`} icon={Cpu} color="#7c3aed" />
              <KpiCard label="Memory" value={`${memPct}%`} subValue={sys ? `${Math.round(sys.memUsedMb / 1024)}GB / ${Math.round(sys.memTotalMb / 1024)}GB` : undefined} icon={Database} color="#6366f1" />
              <KpiCard label="Uptime" value={sys ? fmtUptime(sys.uptimeSeconds) : '—'} icon={Clock} color="#10b981" />
              <KpiCard label="Error Rate" value={sys ? `${sys.errorRate.toFixed(1)}%` : '—'} icon={AlertTriangle} color="#ef4444" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
                <SectionHeader title="Latency Percentiles" icon={Activity} />
                <div className="space-y-3">
                  {sys && [
                    { label: 'P50', value: sys.p50LatencyMs },
                    { label: 'P95', value: sys.p95LatencyMs },
                    { label: 'P99', value: sys.p99LatencyMs },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between text-sm">
                      <span className="text-gray-400">{item.label}</span>
                      <span className={`font-medium ${item.value > 1000 ? 'text-red-400' : item.value > 500 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {item.value}ms
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
                <SectionHeader title="Environment" icon={Server} />
                <div className="space-y-2">
                  {sys && [
                    ['Node.js', sys.nodeVersion],
                    ['Platform', sys.platform],
                    ['Requests', fmtNum(sys.activeConnections)],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between text-sm">
                      <span className="text-gray-400">{k as string}</span>
                      <span className="font-mono text-xs text-gray-300">{v as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
