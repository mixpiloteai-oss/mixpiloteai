// ============================================================
// NEUROTEK AI — Reset Password Page
// Consumes a reset token from the URL, validates it, then
// allows the user to set a new password.
//
// Usage: /auth/reset-password?token=<hex-token>
// ============================================================
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authApi } from '../services/api';

interface ResetPasswordProps {
  /** Token extracted from URL query params */
  token?: string;
  onSuccess?: () => void;
  onBack?: () => void;
}

function StrengthBar({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
    password.length >= 12,
  ].filter(Boolean).length;

  const colors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-500'];
  const labels = ['', 'Very weak', 'Weak', 'Fair', 'Good', 'Strong'];

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : 'bg-[#2d2d3d]'}`} />
        ))}
      </div>
      <p className={`text-xs ${score < 3 ? 'text-red-400' : score < 4 ? 'text-yellow-400' : 'text-green-400'}`}>
        {labels[score]}
        {score < 3 && ' — add uppercase letters, numbers, and symbols'}
      </p>
    </div>
  );
}

export default function ResetPassword({ token: propToken, onSuccess, onBack }: ResetPasswordProps) {
  const [token, setToken]             = useState(propToken ?? '');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [done, setDone]               = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Extract token from URL if not passed as prop
  useEffect(() => {
    if (!token) {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token') ?? '';
      setToken(urlToken);
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Reset token is missing. Please use the link from your email.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      setTimeout(() => onSuccess?.(), 3000);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string; code?: string } } })?.response?.data;
      if (data?.code === 'INVALID_RESET_TOKEN') {
        setError('This reset link has expired or already been used. Please request a new one.');
      } else {
        setError(data?.error ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  const passwordMismatch = confirm.length > 0 && password !== confirm;

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
            {done ? (
              /* ── Success state ── */
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <div className="text-5xl mb-4">✅</div>
                <h2 className="text-xl font-bold text-slate-100 mb-3">Password updated!</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Your password has been changed. All other sessions have been signed out for security.
                </p>
                <p className="text-slate-500 text-xs">Redirecting to sign in…</p>
              </motion.div>
            ) : (
              /* ── Form state ── */
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-100">Set new password</h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Choose a strong password. All active sessions will be signed out.
                  </p>
                </div>

                {!token && (
                  <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4">
                    <p className="text-red-400 text-sm">
                      Reset token not found. Please use the link from your email.
                    </p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* New password */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
                      New password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={e => { setPassword(e.target.value); setError(null); }}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        autoFocus
                        className="w-full bg-[#0d0d16] border border-[#2d2d3d] rounded-lg px-4 py-2.5 pr-10
                                   text-slate-100 placeholder-slate-600 focus:outline-none
                                   focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30
                                   transition-colors text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                      >
                        {showPass ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <StrengthBar password={password} />
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label htmlFor="confirm" className="block text-sm font-medium text-slate-300 mb-1.5">
                      Confirm new password
                    </label>
                    <input
                      id="confirm"
                      type={showPass ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => { setConfirm(e.target.value); setError(null); }}
                      placeholder="Repeat your new password"
                      autoComplete="new-password"
                      className={`w-full bg-[#0d0d16] border rounded-lg px-4 py-2.5
                                 text-slate-100 placeholder-slate-600 focus:outline-none
                                 focus:ring-1 transition-colors text-sm
                                 ${passwordMismatch
                                   ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
                                   : 'border-[#2d2d3d] focus:border-purple-500 focus:ring-purple-500/30'}`}
                    />
                    {passwordMismatch && (
                      <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                    )}
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        key="err"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-red-900/20 border border-red-800/50 rounded-lg p-3"
                      >
                        <p className="text-red-400 text-sm">{error}</p>
                        {error.includes('expired') && (
                          <button
                            type="button"
                            onClick={onBack}
                            className="text-purple-400 hover:text-purple-300 text-sm mt-2 block transition-colors"
                          >
                            Request a new reset link →
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={loading || !token || !password || !confirm || passwordMismatch}
                    className="w-full bg-gradient-to-r from-purple-600 to-violet-600
                               hover:from-purple-500 hover:to-violet-500
                               disabled:opacity-50 disabled:cursor-not-allowed
                               text-white font-semibold py-2.5 rounded-lg transition-all
                               text-sm shadow-lg shadow-purple-900/30"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Updating password…
                      </span>
                    ) : 'Update Password'}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {onBack && !done && (
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

        <p className="text-center text-slate-600 text-xs mt-4">
          🔒 Your new password is hashed with bcrypt before storage. We never see it.
        </p>
      </motion.div>
    </div>
  );
}
