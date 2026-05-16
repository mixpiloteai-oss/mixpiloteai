// ============================================================
// NEUROTEK AI — Analytics Dashboard
// Usage stats, 14-day bar chart, quota ring, model badge
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Zap, BarChart2, ChevronRight, AlertTriangle, RefreshCw, Clock, DollarSign, Cpu, Lock } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { apiClient } from '../services/api';

interface DayUsage { date: string; requests: number; }
interface AnalyticsData {
  plan: string; model: string; dailyLimit: number | 'unlimited';
  usedToday: number; remainingToday: number | 'unlimited';
  totalRequests: number; estimatedCostCents: number; avgPerDay: number;
  history: DayUsage[];
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-gray-700/50 rounded-lg ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0,1,2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="grid grid-cols-3 gap-4">
        {[0,1,2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    </div>
  );
}

function CircularRing({ used, limit, size = 120, strokeWidth = 8 }: { used: number; limit: number | 'unlimited'; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = limit === 'unlimited' ? 0.1 : Math.min(used / (limit as number), 1);
  const offset = circumference - pct * circumference;
  const ringColor = limit === 'unlimited' ? '#06b6d4' : pct >= 0.9 ? '#ef4444' : pct >= 0.7 ? '#f59e0b' : '#7c3aed';
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#1f2937" strokeWidth={strokeWidth} />
      <motion.circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={ringColor} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: 'easeOut' }}
        style={{ filter: `drop-shadow(0 0 6px ${ringColor}60)` }}
      />
    </svg>
  );
}

function BarChart({ data }: { data: DayUsage[] }) {
  const max = Math.max(...data.map((d) => d.requests), 1);
  const barWidth = 16; const gap = 6; const chartH = 100;
  const totalW = data.length * (barWidth + gap) - gap;
  return (
    <div className="overflow-x-auto">
      <svg width={totalW} height={chartH + 32} className="block min-w-full" style={{ minWidth: totalW }}>
        {data.map((day, i) => {
          const barH = Math.max((day.requests / max) * chartH, 2);
          const x = i * (barWidth + gap); const y = chartH - barH;
          const isToday = i === data.length - 1;
          const dateLabel = new Date(day.date).toLocaleDateString('en', { month: 'short', day: 'numeric' });
          return (
            <g key={day.date}>
              <motion.rect x={x} y={y} width={barWidth} height={barH} rx={3}
                fill={isToday ? '#7c3aed' : '#7c3aed60'}
                initial={{ height: 0, y: chartH }} animate={{ height: barH, y }}
                transition={{ duration: 0.4, delay: i * 0.03 }}
              />
              {(i === 0 || i === data.length - 1 || i % 7 === 0) && (
                <text x={x + barWidth/2} y={chartH + 18} textAnchor="middle" fontSize={9} fill="#6b7280" className="font-mono">{dateLabel}</text>
              )}
              <title>{dateLabel}: {day.requests} requests</title>
              <rect x={x} y={0} width={barWidth} height={chartH} fill="transparent" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ModelBadge({ model }: { model: string }) {
  const isOpus = model.toLowerCase().includes('opus');
  const isSonnet = model.toLowerCase().includes('sonnet');
  const color = isOpus ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10' : isSonnet ? 'border-purple-500 text-purple-400 bg-purple-500/10' : 'border-gray-500 text-gray-400 bg-gray-500/10';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${color}`}>
      <Cpu className="w-3 h-3" />{model}
    </span>
  );
}

function PlanGatePrompt({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center gap-5"
    >
      <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center">
        <Lock className="w-7 h-7 text-gray-500" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-white mb-2">Analytics not available on Free plan</h3>
        <p className="text-gray-400 text-sm max-w-xs mx-auto">Upgrade to Creator or Studio to track your AI usage, costs, and 14-day history.</p>
      </div>
      <button onClick={onUpgrade} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors">
        Upgrade to Creator <ChevronRight className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }: { icon: React.FC<{ className?: string }>; label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/60 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/20 flex items-center justify-center">
          <Icon className={`w-3.5 h-3.5 ${accent ?? 'text-purple-400'}`} />
        </div>
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-extrabold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { auth } = useAppStore();
  const userPlan = (auth.user as { plan?: string } | null)?.plan ?? 'free';
  const isPlanGated = userPlan === 'free';
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAnalytics = useCallback(async () => {
    if (isPlanGated) { setIsLoading(false); return; }
    setIsLoading(true); setError(null);
    try {
      const { data: resp } = await apiClient.get('/api/analytics/me');
      setData(resp?.data ?? resp); setLastRefresh(new Date());
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message ?? 'Failed to load analytics. Please try again.');
    } finally { setIsLoading(false); }
  }, [isPlanGated]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const handleUpgrade = () => window.dispatchEvent(new CustomEvent('neurotek:navigate', { detail: 'plans' }));

  const pctUsed = data && data.dailyLimit !== 'unlimited' ? data.usedToday / (data.dailyLimit as number) : 0;
  const nearLimit = pctUsed >= 0.8;
  const remainingLabel = data?.remainingToday === 'unlimited' ? '∞' : String(data?.remainingToday ?? 0);
  const limitLabel = data?.dailyLimit === 'unlimited' ? '∞' : String(data?.dailyLimit ?? 0);

  if (isPlanGated) return <div className="bg-[#0a0a0f] min-h-full p-6"><PlanGatePrompt onUpgrade={handleUpgrade} /></div>;
  if (isLoading) return <div className="bg-[#0a0a0f] min-h-full"><DashboardSkeleton /></div>;
  if (error) return (
    <div className="bg-[#0a0a0f] min-h-full p-6 flex flex-col items-center justify-center gap-4">
      <AlertTriangle className="w-10 h-10 text-red-400" />
      <p className="text-red-400 text-sm font-medium">{error}</p>
      <button onClick={fetchAnalytics} className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors">
        <RefreshCw className="w-4 h-4" /> Try again
      </button>
    </div>
  );
  if (!data) return null;

  return (
    <div className="bg-[#0a0a0f] min-h-full text-white">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Analytics</h1>
              <p className="text-xs text-gray-500">Last updated: {lastRefresh.toLocaleTimeString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ModelBadge model={data.model} />
            <button onClick={fetchAnalytics} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-300 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-1.5 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm bg-gray-800/40 border border-gray-700/60 rounded-xl px-4 py-3">
          <Zap className="w-4 h-4 text-purple-400" />
          <span className="text-gray-400">Active plan: <span className="text-white font-semibold capitalize">{data.plan}</span></span>
          <span className="mx-2 text-gray-700">·</span>
          <span className="text-gray-400">Daily quota: <span className="text-white font-semibold">{limitLabel} requests/day</span></span>
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">Today's Usage</h2>
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="flex-shrink-0 relative flex items-center justify-center">
              <CircularRing used={data.usedToday} limit={data.dailyLimit} size={140} strokeWidth={10} />
              <div className="absolute text-center">
                <p className="text-3xl font-extrabold text-white leading-none">{data.usedToday}</p>
                <p className="text-xs text-gray-500 mt-0.5">/ {limitLabel}</p>
              </div>
            </div>
            <div className="flex-1 space-y-3 w-full">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <span className="text-sm text-gray-400">Requests used</span>
                <span className="text-sm font-bold text-white">{data.usedToday}</span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <span className="text-sm text-gray-400">Remaining today</span>
                <span className={`text-sm font-bold ${data.remainingToday === 'unlimited' ? 'text-cyan-400' : (data.remainingToday as number) < 10 ? 'text-red-400' : 'text-green-400'}`}>
                  {remainingLabel}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Usage today</span>
                <span className={`text-sm font-bold ${nearLimit ? 'text-amber-400' : 'text-purple-400'}`}>
                  {data.dailyLimit === 'unlimited' ? '—' : `${Math.round(pctUsed * 100)}%`}
                </span>
              </div>
              {data.dailyLimit !== 'unlimited' && (
                <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                  <motion.div className={`h-full rounded-full ${pctUsed >= 0.9 ? 'bg-red-500' : pctUsed >= 0.7 ? 'bg-amber-500' : 'bg-purple-500'}`}
                    initial={{ width: 0 }} animate={{ width: `${Math.round(pctUsed * 100)}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              )}
              <AnimatePresence>
                {nearLimit && (
                  <motion.button initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    onClick={handleUpgrade}
                    className="flex items-center justify-center gap-2 w-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-semibold py-2 rounded-xl hover:bg-amber-500/20 transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4" /> Approaching limit — Upgrade plan <ChevronRight className="w-4 h-4" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {data.history && data.history.length > 0 && (
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">14-Day History</h2>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-2.5 h-2.5 rounded-sm bg-purple-600" /><span>requests/day</span>
              </div>
            </div>
            <BarChart data={data.history} />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={TrendingUp} label="Total Requests" value={data.totalRequests.toLocaleString()} sub="All time" accent="text-purple-400" />
          <StatCard icon={DollarSign} label="Est. Cost" value={`$${(data.estimatedCostCents / 100).toFixed(2)}`} sub="Approximate, this billing period" accent="text-cyan-400" />
          <StatCard icon={Clock} label="Avg / Day" value={data.avgPerDay.toFixed(1)} sub="14-day rolling average" accent="text-amber-400" />
        </div>

        {userPlan !== 'studio' && (
          <div className="flex justify-center">
            <button onClick={handleUpgrade}
              className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 border border-purple-500/30 hover:border-purple-500/60 bg-purple-600/10 hover:bg-purple-600/20 px-5 py-2.5 rounded-xl transition-all duration-200"
            >
              <Zap className="w-4 h-4" /> Upgrade for more requests &amp; lower cost <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
