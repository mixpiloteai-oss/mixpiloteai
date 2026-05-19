import { useEffect, useState } from 'react'

const BACKEND = 'https://mixpiloteai-production.up.railway.app/health'
const PROBE_INTERVAL = 30_000
const PROBE_TIMEOUT  = 5_000

async function probeBackend(): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const t    = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT)
    const res  = await fetch(BACKEND, { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(t)
    return res.ok
  } catch { return false }
}

export interface SiteOnlineStatus {
  isOnline:        boolean
  backendReachable: boolean | null
}

export function useOnlineStatus(): SiteOnlineStatus {
  const [isOnline,         setIsOnline]         = useState(navigator.onLine)
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null)

  useEffect(() => {
    const on  = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)

    probeBackend().then(setBackendReachable)
    const id = setInterval(() => {
      if (navigator.onLine) probeBackend().then(setBackendReachable)
    }, PROBE_INTERVAL)

    return () => {
      window.removeEventListener('online',  on)
      window.removeEventListener('offline', off)
      clearInterval(id)
    }
  }, [])

  return { isOnline, backendReachable }
}
