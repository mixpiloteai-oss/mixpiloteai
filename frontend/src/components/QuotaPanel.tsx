// ============================================================
// NEUROTEK AI — Quota & Subscription Panel
// ============================================================
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Crown, Star, TrendingUp, X, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { subscriptionsApi } from '../services/api';
import type { PlanInfo } from '../types';

interface QuotaPanelProps {
  compact?: boolean;
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free: <Zap size={14} />,
  pro: <Star size={14} />,
  studio: <Crown size={14} />,
};

const PLAN_COLORS: Record<string, string> = {
  free: '#475569',
  pro: '#7c3aed',
  studio: '#06b6d4',
};

export function QuotaPanel({ compact = false }: QuotaPanelProps) {
  const { auth, updateQuota } = useAppStore();
  const { user, quota } = auth;

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    if (showUpgrade && plans.length === 0) {
      subscriptionsApi.plans().then((res) => setPlans(res.data.data)).catch(() => {});
    }
  }, [showUpgrade, plans.length]);

  if (!user || !quota) return null;

  const usagePercent = Math.min(100, (quota.used / quota.limit) * 100);
  const isLow = quota.remaining <= Math.ceil(quota.limit * 0.1);
  const isEmpty = quota.remaining === 0;

  const planColor = PLAN_COLORS[user.plan] ?? '#7c3aed';

  async function handleUpgrade(planId: string) {
    if (planId === user!.plan) return;
    setUpgrading(planId);
    try {
      await subscriptionsApi.upgrade(planId);
      const meRes = await import('../services/api').then((m) => m.authApi.me());
      updateQuota(meRes.data.data.quota);
      setShowUpgrade(false);
    } catch (err) {
      console.error('Upgrade failed', err);
    } finally {
      setUpgrading(null);
    }
  }

  if (compact) {
    return (
      <div className="px-3 py-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-text-muted flex items-center gap-1">
            <span style={{ color: planColor }}>{PLAN_ICONS[user.plan]}</span>
            <span className="font-medium" style={{ color: planColor }}>{user.plan.toUpperCase()}</span>
          </span>
          <span className={`text-xs font-mono ${isEmpty ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-text-muted'}`}>
            {quota.remaining}/{quota.limit}
          </span>
        </div>
        <div className="w-full h-1 bg-bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full transition-all"
            style={{ width: `${usagePercent}%`, backgroundColor: isEmpty ? '#ef4444' : isLow ? '#f59e0b' : planColor }}
            initial={{ width: 0 }}
            animate={{ width: `${usagePercent}%` }}
          />
        </div>
        {user.plan === 'free' && (
          <button
            onClick={() => setShowUpgrade(true)}
            className="mt-2 w-full text-xs py-1.5 rounded-lg font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: `${planColor}20`, color: planColor, border: `1px solid ${planColor}30` }}
          >
            Upgrade Plan
          </button>
        )}

        <AnimatePresence>
          {showUpgrade && (
            <UpgradeModal plans={plans} currentPlan={user.plan} upgrading={upgrading} onUpgrade={handleUpgrade} onClose={() => setShowUpgrade(false)} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border-default rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ color: planColor }}>{PLAN_ICONS[user.plan]}</span>
          <span className="text-sm font-semibold text-text-primary">{user.plan.toUpperCase()} Plan</span>
        </div>
        <button onClick={() => setShowUpgrade(!showUpgrade)} className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1">
          {showUpgrade ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {user.plan !== 'studio' && 'Upgrade'}
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-text-secondary">
          <span>AI Requests today</span>
          <span className={`font-mono ${isEmpty ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-text-primary'}`}>
            {quota.used} / {quota.limit === 9999 ? '∞' : quota.limit}
          </span>
        </div>
        <div className="w-full h-2 bg-bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: isEmpty ? '#ef4444' : isLow ? '#f59e0b' : planColor }}
            initial={{ width: 0 }}
            animate={{ width: `${usagePercent}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        {isEmpty && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <TrendingUp size={12} /> Daily quota reached — resets at midnight
          </p>
        )}
        {isLow && !isEmpty && (
          <p className="text-xs text-amber-400">{quota.remaining} requests remaining today</p>
        )}
      </div>

      <AnimatePresence>
        {showUpgrade && (
          <UpgradeModal plans={plans} currentPlan={user.plan} upgrading={upgrading} onUpgrade={handleUpgrade} onClose={() => setShowUpgrade(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Upgrade Modal ────────────────────────────────────────────
interface UpgradeModalProps {
  plans: PlanInfo[];
  currentPlan: string;
  upgrading: string | null;
  onUpgrade: (plan: string) => void;
  onClose: () => void;
}

function UpgradeModal({ plans, currentPlan, upgrading, onUpgrade, onClose }: UpgradeModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-bg-card border border-border-default rounded-2xl p-6 shadow-card"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Choose Your Plan</h2>
            <p className="text-sm text-text-secondary mt-1">Unlock the full power of NEUROTEK AI</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const color = PLAN_COLORS[plan.id] ?? '#7c3aed';

            return (
              <div
                key={plan.id}
                className={`relative rounded-xl p-5 border transition-all ${
                  plan.popular ? 'border-accent-primary shadow-glow-purple' : 'border-border-default'
                }`}
                style={{ backgroundColor: `${color}08` }}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent-primary text-white text-xs px-3 py-1 rounded-full font-medium">
                    Most Popular
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <span style={{ color }}>{PLAN_ICONS[plan.id]}</span>
                  <h3 className="font-bold text-text-primary">{plan.name}</h3>
                </div>

                <div className="mb-4">
                  <span className="text-2xl font-bold" style={{ color }}>
                    {plan.price === 0 ? 'Free' : `€${(plan.price / 100).toFixed(2)}`}
                  </span>
                  {plan.price > 0 && <span className="text-text-muted text-xs ml-1">/{plan.billing}</span>}
                </div>

                <ul className="space-y-2 mb-5">
                  {plan.features.slice(0, 5).map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-xs text-text-secondary">
                      <Check size={12} className="mt-0.5 shrink-0" style={{ color }} />
                      {feat}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => !isCurrent && onUpgrade(plan.id)}
                  disabled={isCurrent || upgrading !== null}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isCurrent
                      ? 'bg-bg-secondary text-text-muted cursor-default'
                      : 'text-white hover:opacity-90 active:scale-95'
                  }`}
                  style={!isCurrent ? { backgroundColor: color } : undefined}
                >
                  {upgrading === plan.id ? 'Processing...' : isCurrent ? 'Current Plan' : plan.cta}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-text-muted mt-4">
          Demo mode — no real payment processed. Plans upgrade instantly for testing.
        </p>
      </motion.div>
    </motion.div>
  );
}
