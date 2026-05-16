// ============================================================
// NEUROTEK AI — Login / Register Screen
// ============================================================
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Music, Shield, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { authApi, setTokens } from '../../services/api';
import { useAppStore } from '../../store/appStore';
import type { AuthUser, QuotaInfo } from '../../types';

type Mode = 'login' | 'register';

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { setAuth } = useAppStore();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = mode === 'login'
        ? await authApi.login(email, password)
        : await authApi.register(email, name, password);

      const { accessToken, refreshToken, user } = res.data.data;
      setTokens(accessToken, refreshToken);

      const meRes = await authApi.me();
      const quota: QuotaInfo = meRes.data.data.quota;

      setAuth(user as AuthUser, quota);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Connection failed. Is the backend running?';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(plan: string) {
    setEmail(`${plan}@neurotek.ai`);
    setPassword('demo1234');
    setMode('login');
    setError('');
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-secondary mb-4 shadow-glow-purple">
            <span className="text-white font-bold text-2xl font-mono">N</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-wider">NEUROTEK AI</h1>
          <p className="text-text-secondary text-sm mt-1">AI-Assisted Music Production</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-bg-card border border-border-default rounded-2xl p-8 shadow-card backdrop-blur-sm"
        >
          <div className="flex bg-bg-secondary rounded-xl p-1 mb-6">
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  mode === m
                    ? 'bg-accent-primary text-white shadow-glow-purple'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {mode === 'register' && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your producer name"
                    required={mode === 'register'}
                    className="w-full bg-bg-secondary border border-border-default rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 transition-all"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full bg-bg-secondary border border-border-default rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Min. 8 characters' : '••••••••'}
                  required
                  minLength={mode === 'register' ? 8 : undefined}
                  className="w-full bg-bg-secondary border border-border-default rounded-xl px-4 py-3 pr-12 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-accent-primary to-purple-500 hover:from-purple-500 hover:to-accent-primary text-white font-semibold py-3 rounded-xl transition-all duration-300 shadow-glow-purple hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Processing...</>
              ) : (
                <>{mode === 'login' ? 'Sign In' : 'Create Account'} <Zap size={16} /></>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border-subtle">
            <p className="text-center text-xs text-text-muted mb-3 uppercase tracking-wider">Demo accounts</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { plan: 'free', color: '#475569', label: 'Free' },
                { plan: 'pro', color: '#7c3aed', label: 'Pro' },
                { plan: 'studio', color: '#06b6d4', label: 'Studio' },
              ].map(({ plan, color, label }) => (
                <button
                  key={plan}
                  onClick={() => fillDemo(plan)}
                  className="text-xs py-2 px-3 rounded-lg border transition-all hover:scale-105"
                  style={{ borderColor: `${color}40`, color, backgroundColor: `${color}10` }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-text-muted mt-2">Password: <code className="font-mono">demo1234</code></p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 grid grid-cols-3 gap-3"
        >
          {[
            { icon: <Music size={14} />, text: 'AI Templates' },
            { icon: <Zap size={14} />, text: 'Mix Assistant' },
            { icon: <Shield size={14} />, text: 'Secure AI' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-xs text-text-muted bg-bg-card/50 rounded-xl px-3 py-2 border border-border-subtle">
              <span className="text-accent-primary">{icon}</span>
              {text}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
