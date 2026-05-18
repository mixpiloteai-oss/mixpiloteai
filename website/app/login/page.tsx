'use client'
import { useState, FormEvent } from 'react'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://mixpiloteai-production.up.railway.app'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const body = mode === 'login' ? { email, password } : { email, password, name }
      const res = await fetch(`${API_URL}/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Request failed')
      if (mode === 'login') {
        localStorage.setItem('token', data.token)
        setSuccess('Logged in successfully!')
      } else {
        setSuccess('Account created! You can now sign in.')
        setMode('login')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-nt-text mb-2">
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h1>
        <p className="text-nt-muted text-sm mb-8">
          {mode === 'login' ? (
            <>No account? <button onClick={() => setMode('register')} className="text-nt-purple hover:underline">Register</button></>
          ) : (
            <>Already have one? <button onClick={() => setMode('login')} className="text-nt-purple hover:underline">Sign in</button></>
          )}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Display name"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="px-4 py-3 rounded-lg bg-nt-card border border-nt-border text-nt-text placeholder-nt-muted focus:outline-none focus:border-nt-purple"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="px-4 py-3 rounded-lg bg-nt-card border border-nt-border text-nt-text placeholder-nt-muted focus:outline-none focus:border-nt-purple"
          />
          <input
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="px-4 py-3 rounded-lg bg-nt-card border border-nt-border text-nt-text placeholder-nt-muted focus:outline-none focus:border-nt-purple"
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {success && <p className="text-green-400 text-sm">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="py-3 rounded-lg bg-nt-purple text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-nt-muted">
          <span>Demo: </span>
          <button onClick={() => { setEmail('free@neurotek.ai'); setPassword('demo1234') }} className="text-nt-cyan hover:underline">free account</button>
          {' · '}
          <button onClick={() => { setEmail('pro@neurotek.ai'); setPassword('demo1234') }} className="text-nt-cyan hover:underline">pro account</button>
        </div>
      </div>
    </div>
  )
}
