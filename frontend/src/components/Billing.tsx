// ============================================================
// NEUROTEK AI — Billing Dashboard
// Real transaction history, invoices, subscription management,
// refund requests. All data from live backend APIs.
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Receipt, Download, RefreshCw, AlertCircle,
  CheckCircle, Clock, XCircle, ChevronRight, Zap,
  Shield, TrendingUp, ArrowDownLeft, FileText, ExternalLink,
  Calendar, DollarSign, Package, X,
} from 'lucide-react';
import { billingApi, subscriptionsApi, newPaymentKey } from '../services/api';

// ── Types ──────────────────────────────────────────────────────

interface PaymentHistoryEntry {
  id: string;
  event: string;
  amountCents?: number;
  currency?: string;
  paymentMethod?: 'stripe' | 'paypal';
  planId?: string;
  productId?: string;
  createdAt: number;
  success: boolean;
  errorMessage?: string;
}

interface Invoice {
  id: string;
  number: string;
  customerName: string;
  customerEmail: string;
  totalCents: number;
  currency: string;
  status: 'paid' | 'pending' | 'void' | 'refunded';
  paymentMethod: 'stripe' | 'paypal';
  createdAt: number;
  paidAt?: number;
}

interface SubscriptionStatus {
  plan: string;
  status: string;
  isActive: boolean;
  isPremium: boolean;
  expiresAt?: string;
  daysRemaining?: number;
  quota?: { used: number; limit: number; remaining: number; resetAt: string };
}

// ── Helpers ────────────────────────────────────────────────────

function formatAmount(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatEvent(event: string): string {
  return event.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function StatusBadge({ status, success }: { status?: string; success?: boolean }) {
  if (success !== undefined) {
    return success ? (
      <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
        <CheckCircle className="w-3 h-3" /> Success
      </span>
    ) : (
      <span className="flex items-center gap-1 text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
        <XCircle className="w-3 h-3" /> Failed
      </span>
    );
  }
  const s = status ?? 'unknown';
  const colors: Record<string, string> = {
    paid:     'text-green-400 bg-green-400/10',
    active:   'text-green-400 bg-green-400/10',
    pending:  'text-yellow-400 bg-yellow-400/10',
    refunded: 'text-blue-400 bg-blue-400/10',
    void:     'text-gray-400 bg-gray-400/10',
    canceled: 'text-red-400 bg-red-400/10',
    failed:   'text-red-400 bg-red-400/10',
  };
  const icons: Record<string, React.ReactNode> = {
    paid:     <CheckCircle className="w-3 h-3" />,
    active:   <CheckCircle className="w-3 h-3" />,
    pending:  <Clock className="w-3 h-3" />,
    refunded: <ArrowDownLeft className="w-3 h-3" />,
    void:     <XCircle className="w-3 h-3" />,
    canceled: <XCircle className="w-3 h-3" />,
    failed:   <XCircle className="w-3 h-3" />,
  };
  return (
    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${colors[s] ?? 'text-gray-400 bg-gray-400/10'}`}>
      {icons[s] ?? <Clock className="w-3 h-3" />}
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

// ── Refund Modal ───────────────────────────────────────────────

function RefundModal({ invoice, onClose, onRefunded }: {
  invoice: Invoice;
  onClose: () => void;
  onRefunded: () => void;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefund() {
    if (!reason.trim()) { setError('Please provide a reason.'); return; }
    setLoading(true);
    setError(null);
    try {
      await billingApi.requestRefund({
        paymentMethod: invoice.paymentMethod,
        paymentIntentId: invoice.paymentMethod === 'stripe' ? invoice.id : undefined,
        reason,
      });
      onRefunded();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Refund request failed. Please contact support.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Request Refund</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Invoice</span>
            <span className="text-white font-mono">{invoice.number}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-400">Amount</span>
            <span className="text-white font-semibold">{formatAmount(invoice.totalCents, invoice.currency)}</span>
          </div>
        </div>

        <label className="block text-sm text-gray-400 mb-2">Reason for refund *</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Please describe why you're requesting a refund..."
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none mb-4"
        />

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-sm font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={handleRefund}
            disabled={loading || !reason.trim()}
            className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing…</span> : 'Submit Refund Request'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Billing Component ─────────────────────────────────────

export default function Billing() {
  const [tab, setTab] = useState<'overview' | 'history' | 'invoices'>('overview');
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [history, setHistory] = useState<PaymentHistoryEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingSub, setLoadingSub] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [refundTarget, setRefundTarget] = useState<Invoice | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    setLoadingSub(true);
    try {
      const res = await subscriptionsApi.my();
      setSubscription(res.data?.data ?? null);
    } catch {
      setError('Failed to load subscription status.');
    } finally {
      setLoadingSub(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await billingApi.history(50);
      setHistory(res.data?.data ?? []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    try {
      const res = await billingApi.invoices();
      setInvoices(res.data?.data ?? []);
    } catch {
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);

  useEffect(() => {
    if (tab === 'history') fetchHistory();
    if (tab === 'invoices') fetchInvoices();
  }, [tab, fetchHistory, fetchInvoices]);

  async function handleUpgrade(planId: string) {
    setCheckoutLoading(planId);
    setError(null);
    try {
      const key = newPaymentKey();
      const baseUrl = window.location.origin;
      const res = await billingApi.createStripeSession({
        type: 'plan',
        planId,
        successUrl: `${baseUrl}/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl:  `${baseUrl}/billing?canceled=1`,
      }, key);
      const url = res.data?.url;
      if (url) window.location.href = url;
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Checkout failed. Please try again.');
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleCancel() {
    if (!confirm('Cancel your subscription at period end?')) return;
    try {
      await subscriptionsApi.cancel(false, 'User requested cancellation');
      setSuccessMsg('Subscription will cancel at end of billing period.');
      await fetchSubscription();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Cancel failed.');
    }
  }

  async function handleReactivate() {
    try {
      await subscriptionsApi.reactivate();
      setSuccessMsg('Subscription reactivated successfully!');
      await fetchSubscription();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Reactivation failed.');
    }
  }

  async function downloadInvoice(id: string, number: string) {
    try {
      const res = await billingApi.getInvoice(id);
      const json = JSON.stringify(res.data?.data ?? {}, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${number}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download invoice.');
    }
  }

  const planColor: Record<string, string> = {
    free:   'bg-gray-700 text-gray-300',
    pro:    'bg-purple-600 text-white',
    studio: 'bg-cyan-600 text-white',
    label:  'bg-amber-500 text-black',
  };

  const tabs = [
    { id: 'overview',  label: 'Overview',   icon: TrendingUp },
    { id: 'history',   label: 'History',    icon: Clock },
    { id: 'invoices',  label: 'Invoices',   icon: FileText },
  ] as const;

  // Check if landed on success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === '1') {
      setSuccessMsg('Payment successful! Your plan has been upgraded.');
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => fetchSubscription(), 2000);
    }
  }, [fetchSubscription]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing & Payments</h1>
          <p className="text-gray-400 text-sm mt-0.5">Manage your subscription, view invoices & history</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Shield className="w-4 h-4 text-green-400" />
          <span>Secured by Stripe & PayPal</span>
        </div>
      </div>

      {/* Success / Error banners */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 bg-green-400/10 border border-green-400/30 rounded-xl px-4 py-3 text-green-400 text-sm"
          >
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="ml-auto"><X className="w-4 h-4" /></button>
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3 text-red-400 text-sm"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-gray-800 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ─────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Current Plan Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-400 text-sm mb-1">Current Plan</p>
                {loadingSub ? (
                  <div className="h-8 w-24 bg-gray-800 rounded-lg animate-pulse" />
                ) : (
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-white capitalize">
                      {subscription?.plan ?? 'Free'}
                    </h2>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${planColor[subscription?.plan ?? 'free'] ?? 'bg-gray-700 text-gray-300'}`}>
                      {subscription?.status ?? 'active'}
                    </span>
                  </div>
                )}
              </div>
              <div className="text-right">
                {subscription?.expiresAt && (
                  <div className="text-sm text-gray-400">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    Renews {formatDate(new Date(subscription.expiresAt).getTime())}
                  </div>
                )}
                {typeof subscription?.daysRemaining === 'number' && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {subscription.daysRemaining} days remaining
                  </div>
                )}
              </div>
            </div>

            {/* Quota bar */}
            {subscription?.quota && (
              <div className="mb-5">
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>Daily AI Requests</span>
                  <span>{subscription.quota.used} / {subscription.quota.limit}</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-cyan-500 transition-all"
                    style={{ width: `${Math.min(100, (subscription.quota.used / Math.max(1, subscription.quota.limit)) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Resets {new Date(subscription.quota.resetAt).toLocaleTimeString()}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              {subscription?.plan === 'free' && (
                <button
                  onClick={() => handleUpgrade('pro')}
                  disabled={checkoutLoading === 'pro'}
                  className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {checkoutLoading === 'pro' ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Zap className="w-4 h-4" />}
                  Upgrade to Pro
                </button>
              )}
              {subscription?.plan === 'pro' && (
                <button
                  onClick={() => handleUpgrade('studio')}
                  disabled={checkoutLoading === 'studio'}
                  className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {checkoutLoading === 'studio' ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Zap className="w-4 h-4" />}
                  Upgrade to Studio
                </button>
              )}
              {subscription?.isActive && subscription.plan !== 'free' && (
                subscription.status === 'active' ? (
                  <button onClick={handleCancel} className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors">
                    <XCircle className="w-4 h-4" /> Cancel Subscription
                  </button>
                ) : subscription.status === 'canceled' ? (
                  <button onClick={handleReactivate} className="flex items-center gap-2 px-5 py-2.5 bg-green-700 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors">
                    <CheckCircle className="w-4 h-4" /> Reactivate
                  </button>
                ) : null
              )}
              <button
                onClick={() => setTab('invoices')}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors"
              >
                <Receipt className="w-4 h-4" /> View Invoices
              </button>
            </div>
          </div>

          {/* Payment Methods Notice */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <CreditCard className="w-5 h-5 text-purple-400" />
              <h3 className="text-white font-semibold">Payment Methods</h3>
            </div>
            <p className="text-gray-400 text-sm">
              Payment methods are managed securely by Stripe. Click "Upgrade" to add a card via our
              secure checkout, or update your payment method through the{' '}
              <button className="text-purple-400 hover:underline" onClick={() => handleUpgrade(subscription?.plan ?? 'pro')}>
                billing portal
              </button>.
            </p>
            <div className="flex items-center gap-4 mt-3 text-gray-600 text-xs">
              <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-green-400" /> PCI DSS Compliant</span>
              <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-blue-400" /> 256-bit Encryption</span>
              <span className="flex items-center gap-1"><Package className="w-3 h-3 text-yellow-400" /> Stripe & PayPal</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Transaction History ──────────────────────────── */}
      {tab === 'history' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">Transaction History</h3>
            <button
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loadingHistory ? (
            <div className="space-y-px">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                  <div className="w-8 h-8 bg-gray-800 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-800 rounded w-1/3" />
                    <div className="h-3 bg-gray-800 rounded w-1/4" />
                  </div>
                  <div className="h-5 bg-gray-800 rounded w-16" />
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Clock className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No transactions yet</p>
              <p className="text-gray-600 text-xs mt-1">Your payment history will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {history.map(entry => (
                <div key={entry.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-800/30 transition-colors">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    entry.success ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'
                  }`}>
                    {entry.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{formatEvent(entry.event)}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {formatDate(entry.createdAt)}
                      {entry.planId && ` · ${entry.planId}`}
                      {entry.paymentMethod && ` · ${entry.paymentMethod}`}
                    </p>
                    {!entry.success && entry.errorMessage && (
                      <p className="text-red-400 text-xs mt-0.5">{entry.errorMessage}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {entry.amountCents ? (
                      <span className={`text-sm font-semibold ${entry.success ? 'text-white' : 'text-red-400'}`}>
                        {formatAmount(entry.amountCents, entry.currency)}
                      </span>
                    ) : null}
                    <div className="mt-0.5 flex justify-end">
                      <StatusBadge success={entry.success} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Invoices ─────────────────────────────────────── */}
      {tab === 'invoices' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">Invoices</h3>
            <button
              onClick={fetchInvoices}
              disabled={loadingInvoices}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loadingInvoices ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loadingInvoices ? (
            <div className="space-y-px">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                  <div className="w-8 h-8 bg-gray-800 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-800 rounded w-1/4" />
                    <div className="h-3 bg-gray-800 rounded w-1/3" />
                  </div>
                  <div className="h-5 bg-gray-800 rounded w-20" />
                </div>
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <FileText className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No invoices yet</p>
              <p className="text-gray-600 text-xs mt-1">Invoices are generated after each payment</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {invoices.map(inv => (
                <div key={inv.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-800/30 transition-colors">
                  <div className="w-9 h-9 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-mono">{inv.number}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {formatDate(inv.createdAt)}
                      {inv.paymentMethod && ` · ${inv.paymentMethod}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={inv.status} />
                    <span className="text-white text-sm font-semibold">
                      {formatAmount(inv.totalCents, inv.currency)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => downloadInvoice(inv.id, inv.number)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        title="Download invoice"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      {inv.status === 'paid' && (
                        <button
                          onClick={() => setRefundTarget(inv)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-orange-400 transition-colors"
                          title="Request refund"
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Refund modal */}
      <AnimatePresence>
        {refundTarget && (
          <RefundModal
            invoice={refundTarget}
            onClose={() => setRefundTarget(null)}
            onRefunded={() => { fetchInvoices(); setSuccessMsg('Refund request submitted successfully.'); }}
          />
        )}
      </AnimatePresence>

      {/* Footer note */}
      <p className="text-center text-gray-600 text-xs">
        All payments are processed securely. For billing questions, contact{' '}
        <a href="mailto:billing@neurotek.ai" className="text-purple-400 hover:underline">billing@neurotek.ai</a>
      </p>
    </div>
  );
}
