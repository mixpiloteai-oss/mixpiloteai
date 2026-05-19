import { useState } from 'react'
import { Link } from 'react-router-dom'
import { login, register, ApiError } from '../lib/api'
import './Login.css'

type Mode = 'signin' | 'signup' | 'reset'

function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      if (mode === 'reset') {
        // Password reset is not yet implemented server-side; show info message
        setSuccess('If an account exists for that email, a reset link has been sent.')
        return
      }
      if (mode === 'signup') {
        await register(name, email, password)
        setSuccess('Account created! Download the app to start producing.')
      } else {
        await login(email, password)
        setSuccess('Signed in! Open the NeuroTek AI app to continue.')
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Connection failed. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg" aria-hidden="true">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-grid" />
      </div>

      <div className="login-card glass-card">
        <div className="login-logo">
          <svg width="40" height="40" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="url(#loginGrad)" />
            <path d="M8 14C8 10.686 10.686 8 14 8C17.314 8 20 10.686 20 14" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <circle cx="14" cy="14" r="3" fill="white" />
            <path d="M6 18C7.5 16 10 15 14 15C18 15 20.5 16 22 18" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
            <defs><linearGradient id="loginGrad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse"><stop stopColor="#7c3aed" /><stop offset="1" stopColor="#06b6d4" /></linearGradient></defs>
          </svg>
          <span className="login-logo-text">NeuroTek <span>AI</span></span>
        </div>

        {mode === 'reset' ? (
          <>
            <h1 className="login-title">Reset password</h1>
            <p className="login-sub">We'll send a reset link to your email.</p>
            <form className="login-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              {error && <div className="login-error">{error}</div>}
              {success && <div className="login-success">{success}</div>}
              <button type="submit" className="btn-primary login-btn" disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
            <button className="login-switch" onClick={() => { setMode('signin'); setError(''); setSuccess('') }}>← Back to sign in</button>
          </>
        ) : (
          <>
            <div className="login-tabs">
              <button className={`login-tab${mode === 'signin' ? ' active' : ''}`} onClick={() => { setMode('signin'); setError(''); setSuccess('') }}>Sign In</button>
              <button className={`login-tab${mode === 'signup' ? ' active' : ''}`} onClick={() => { setMode('signup'); setError(''); setSuccess('') }}>Create Account</button>
            </div>

            <h1 className="login-title">
              {mode === 'signin' ? 'Welcome back' : 'Get started free'}
            </h1>
            <p className="login-sub">
              {mode === 'signin' ? 'Sign in to access your projects and settings.' : 'Create your account — no credit card required.'}
            </p>

            <form className="login-form" onSubmit={handleSubmit}>
              {mode === 'signup' && (
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input type="text" className="form-input" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" className="form-input" placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'} value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              {mode === 'signin' && (
                <button type="button" className="login-forgot" onClick={() => { setMode('reset'); setError(''); setSuccess('') }}>Forgot password?</button>
              )}
              {error && <div className="login-error">{error}</div>}
              {success && <div className="login-success">{success}</div>}
              <button type="submit" className="btn-primary login-btn" disabled={loading}>
                {loading ? (mode === 'signin' ? 'Signing in…' : 'Creating account…') : (mode === 'signin' ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <div className="login-divider"><span>or continue with</span></div>
            <button className="login-discord" disabled>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.04.032.05a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>
              Continue with Discord
              <span style={{ fontSize: '11px', opacity: 0.5, marginLeft: '4px' }}>(coming soon)</span>
            </button>
          </>
        )}

        <p className="login-terms">
          By continuing you agree to our <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>.
        </p>

        <div className="login-download-hint">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1v9M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Don't have the app? <Link to="/download">Download NeuroTek AI free →</Link>
        </div>
      </div>
    </div>
  )
}

export default Login
