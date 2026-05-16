// ============================================================
// NEUROTEK AI — Pricing / Plans Page
// Monthly/Yearly toggle, 4-plan grid, feature lists, CTA
// ============================================================
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Zap, Star, ChevronRight, ExternalLink, Sparkles, Shield } from 'lucide-react';
import { PLANS, type PlanConfig } from '../data/plans';
import { useAppStore } from '../store/appStore';
import { subscriptionsApi } from '../services/api';

function savingsPercent(monthly: number, yearly: number): number {
  if (monthly === 0) return 0;
  return Math.round(((monthly - yearly / 12) / monthly) * 100);
}

function PlanCard({ plan, isYearly, currentPlan, isUpgrading, onAction }: {
  plan: PlanConfig; isYearly: boolean; currentPlan: string;
  isUpgrading: string | null; onAction: (planId: string) => void;
}) {
  const isCurrent = currentPlan === plan.id;
  const savings = savingsPercent(plan.priceMonthly, plan.priceYearly);
  const displayPrice = isYearly ? (plan.priceYearly === 0 ? 0 : Math.round(plan.priceYearly / 12)) : plan.priceMonthly;

  const accentBorder = { gray: 'border-gray-500', purple: 'border-purple-500', cyan: 'border-cyan-500', amber: 'border-amber-500' }[plan.color] ?? 'border-gray-500';
  const accentGlow = { gray: '', purple: 'shadow-[0_0_30px_rgba(124,58,237,0.2)]', cyan: 'shadow-[0_0_30px_rgba(6,182,212,0.2)]', amber: 'shadow-[0_0_30px_rgba(245,158,11,0.15)]' }[plan.color] ?? '';
  const accentBg = { gray: 'bg-gray-500', purple: 'bg-purple-600', cyan: 'bg-cyan-500', amber: 'bg-amber-500' }[plan.color] ?? 'bg-gray-500';
  const accentText = { gray: 'text-gray-400', purple: 'text-purple-400', cyan: 'text-cyan-400', amber: 'text-amber-400' }[plan.color] ?? 'text-gray-400';
  const btnClass = isCurrent ? 'bg-gray-700 text-gray-400 cursor-default' : ({ gray: 'bg-gray-600 hover:bg-gray-500 text-white', purple: 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20', cyan: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20', amber: 'bg-amber-500 hover:bg-amber-400 text-black' }[plan.color] ?? 'bg-gray-600 hover:bg-gray-500 text-white');

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }} transition={{ duration: 0.25 }}
      className={`relative flex flex-col rounded-2xl border bg-gray-900/60 p-6 backdrop-blur-sm transition-all duration-300 ${
        isCurrent ? `${accentBorder} ${accentGlow} border-2` : plan.popular ? `${accentBorder} ${accentGlow} border` : 'border-gray-800'
      }`}
    >
      {plan.popular && !isCurrent && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white ${accentBg}`}>
          <Star className="w-3 h-3" /> Most Popular
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white bg-green-600">
          <Shield className="w-3 h-3" /> Current Plan
        </div>
      )}
      <div className="mb-4">
        <h3 className={`text-xl font-bold mb-0.5 ${accentText}`}>{plan.name}</h3>
        <p className="text-gray-500 text-sm">{plan.tagline}</p>
      </div>
      <div className="mb-5">
        <div className="flex items-end gap-1">
          <AnimatePresence mode="wait">
            <motion.span key={`${plan.id}-${isYearly}`}
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }} className="text-4xl font-extrabold text-white"
            >€{displayPrice}</motion.span>
          </AnimatePresence>
          <span className="text-gray-500 text-sm mb-1">/mo</span>
        </div>
        {isYearly && plan.priceYearly > 0 && (
          <p className="text-gray-500 text-xs mt-0.5">
            €{plan.priceYearly}/year billed annually
            {savings > 0 && <span className="ml-1.5 text-green-400 font-semibold">(save {savings}%)</span>}
          </p>
        )}
        {plan.priceMonthly === 0 && <p className="text-gray-500 text-xs mt-0.5">Always free · No card needed</p>}
      </div>
      <ul className="flex-1 space-y-2.5 mb-6">
        {plan.features.map((feat) => (
          <li key={feat.label} className="flex items-start gap-2.5">
            <div className={`flex-shrink-0 w-4 h-4 rounded-full mt-0.5 flex items-center justify-center ${
              feat.included ? feat.highlight ? accentBg : 'bg-green-600/30' : 'bg-gray-700/50'
            }`}>
              {feat.included
                ? <Check className={`w-2.5 h-2.5 ${feat.highlight ? 'text-white' : 'text-green-400'}`} />
                : <X className="w-2.5 h-2.5 text-gray-600" />
              }
            </div>
            <span className={`text-sm ${feat.included ? feat.highlight ? 'text-white font-medium' : 'text-gray-300' : 'text-gray-600 line-through'}`}>
              {feat.label}
            </span>
          </li>
        ))}
      </ul>
      <button onClick={() => !isCurrent && onAction(plan.id)} disabled={isCurrent || isUpgrading === plan.id}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${btnClass} disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        {isUpgrading === plan.id ? (
          <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Processing…</>
        ) : isCurrent ? 'Current Plan' : plan.priceMonthly === 0 ? 'Get Started' : (
          <>{currentPlan !== 'free' && plan.priceMonthly < (PLANS.find(p => p.id === currentPlan)?.priceMonthly ?? 0) ? 'Downgrade' : 'Upgrade'} <ChevronRight className="w-4 h-4" /></>
        )}
      </button>
    </motion.div>
  );
}

export default function PlansPage() {
  const { auth } = useAppStore();
  const currentPlan = (auth.user as { plan?: string } | null)?.plan ?? 'free';
  const [isYearly, setIsYearly] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradeSuccess, setUpgradeSuccess] = useState<string | null>(null);

  const handlePlanAction = async (planId: string) => {
    if (planId === currentPlan) return;
    setIsUpgrading(planId); setUpgradeError(null); setUpgradeSuccess(null);
    try {
      await subscriptionsApi.upgrade(planId);
      setUpgradeSuccess(`Successfully switched to ${PLANS.find((p) => p.id === planId)?.name} plan!`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setUpgradeError(axiosErr?.response?.data?.message ?? 'Upgrade failed. Please try again.');
    } finally { setIsUpgrading(null); }
  };

  const maxSavings = Math.max(...PLANS.filter((p) => p.priceMonthly > 0).map((p) => savingsPercent(p.priceMonthly, p.priceYearly)));

  return (
    <div className="min-h-full bg-[#0a0a0f] text-white">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span className="text-sm font-semibold text-purple-400 uppercase tracking-wider">Pricing</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-3">Choose Your Plan</h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">From free exploration to professional studio — unlock the AI tools your production deserves.</p>
        </div>

        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex items-center gap-4 bg-gray-800/60 border border-gray-700 rounded-xl p-1.5">
            <button onClick={() => setIsYearly(false)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${!isYearly ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-300'}`}
            >Monthly</button>
            <button onClick={() => setIsYearly(true)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${isYearly ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-300'}`}
            >
              Yearly
              <AnimatePresence>
                {!isYearly && (
                  <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                    className="text-xs font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full border border-green-400/20"
                  >Save up to {maxSavings}%</motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
          <AnimatePresence>
            {isYearly && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-green-400 text-sm font-medium bg-green-400/10 border border-green-400/20 rounded-lg px-4 py-2"
              >
                <Zap className="w-4 h-4" /> Save up to {maxSavings}% with yearly billing — that's months free!
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {upgradeSuccess && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-6 flex items-center gap-2 text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-3"
            ><Check className="w-4 h-4" /> {upgradeSuccess}</motion.div>
          )}
          {upgradeError && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-6 flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3"
            ><X className="w-4 h-4" /> {upgradeError}</motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
          {PLANS.map((plan, i) => (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <PlanCard plan={plan} isYearly={isYearly} currentPlan={currentPlan} isUpgrading={isUpgrading} onAction={handlePlanAction} />
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { icon: Shield, title: 'Cancel anytime', desc: 'No lock-in. Downgrade or cancel at any time from your account.' },
            { icon: Zap, title: 'Instant activation', desc: 'Your plan upgrades immediately after payment. No waiting.' },
            { icon: Star, title: '14-day refund', desc: 'EU cooling-off period: full refund within 14 days of purchase.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3 bg-gray-800/30 border border-gray-700/40 rounded-xl p-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mt-0.5">
                <Icon className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white mb-0.5">{title}</h4>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center border-t border-gray-800/60 pt-8">
          <p className="text-gray-500 text-sm flex items-center justify-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Merch and physical products available on{' '}
            <a href="https://mixpiloteai.com" target="_blank" rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors"
            >mixpiloteai.com</a>
          </p>
          <p className="text-gray-600 text-xs mt-2">All prices in EUR · VAT may apply · Payments processed securely via Stripe</p>
        </div>
      </div>
    </div>
  );
}
