// ============================================================
// NEUROTEK AI — Forgot Password Page
// Sends a password reset email to the provided address.
// Always shows the same success message regardless of whether
// the email exists (prevents email enumeration).
// ============================================================
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authApi } from '../services/api';

interface ForgotPasswordProps {
  onBack?: () => void;
}

export default function ForgotPassword({ onBack }: ForgotPasswordProps) {
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError('Email address is required'); return; }
    setLoading(true);
    setError(null);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-purple-400">
            Neuro<span className="text-slate-100">Tek AI</span>
          </h1>
        </div>

        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-8 shadow-2xl">
          <AnimatePresence mode="wait">
            {sent ? (
              /* ── Success state ── */
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <div className="text-5xl mb-4">✉️</div>
                <h2 className="text-xl font-bold text-slate-100 mb-3">Check your inbox</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  If <strong className="text-slate-200">{email}</strong> has an account,
                  you'll receive a reset link within a few minutes.
                </p>
                <p className="text-slate-500 text-xs mb-6">
                  The link expires in <strong className="text-slate-400">60 minutes</strong>.
                  Check your spam folder if you don't see it.
                </p>
                <button
                  onClick={() => { setSent(false); setEmail(''); }}
                  className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
                >
                  Send again with a different email
                </button>
              </motion.div>
            ) : (
              /* ── Form state ── */
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-100">Forgot your password?</h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Enter your email and we'll send you a reset link.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(null); }}
                      placeholder="you@example.com"
                      autoComplete="email"
                      autoFocus
                      className="w-full bg-[#0d0d16] border border-[#2d2d3d] rounded-lg px-4 py-2.5
                                 text-slate-100 placeholder-slate-600 focus:outline-none
                                 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30
                                 transition-colors text-sm"
                    />
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.p
                        key="err"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-red-400 text-xs"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="w-full bg-gradient-to-r from-purple-600 to-violet-600
                               hover:from-purple-500 hover:to-violet-500
                               disabled:opacity-50 disabled:cursor-not-allowed
                               text-white font-semibold py-2.5 rounded-lg transition-all
                               text-sm shadow-lg shadow-purple-900/30"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending…
                      </span>
                    ) : 'Send Reset Link'}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Back link */}
          {onBack && !sent && (
            <div className="mt-6 text-center">
              <button
                onClick={onBack}
                className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
              >
                ← Back to sign in
              </button>
            </div>
          )}
        </div>

        {/* Security note */}
        <p className="text-center text-slate-600 text-xs mt-4">
          🔒 Reset links expire after 60 minutes and can only be used once.
        </p>
      </motion.div>
    </div>
  );
}
