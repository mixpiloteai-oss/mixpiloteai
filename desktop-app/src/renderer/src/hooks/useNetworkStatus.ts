import { useEffect, useRef } from 'react'
import { useDesktopNetworkStore } from '../store/networkStore'

// ─── useNetworkStatus ─────────────────────────────────────────────────────────
// Mount once in App.  Monitors connectivity and probes the backend.
// DAW features are NEVER gated — only cloud/AI is affected by connectivity.

const API_BASE       = import.meta.env.VITE_API_URL ?? 'https://mixpiloteai-production.up.railway.app'
const PROBE_URL      = `${API_BASE}/health`
const PROBE_INTERVAL = 30_000
const PROBE_TIMEOUT  = 5_000

async function probeBackend(): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const t    = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT)
    const res  = await fetch(PROBE_URL, { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(t)
    return res.ok
  } catch { return false }
}

export function useNetworkStatus(): void {
  // Use stable selector functions instead of the full store to avoid re-render loops
  const setOnline           = useDesktopNetworkStore(s => s.setOnline)
  const setBackendReachable = useDesktopNetworkStore(s => s.setBackendReachable)
  const probe = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    function onOnline()  { setOnline(true);  void probeBackend().then(setBackendReachable) }
    function onOffline() { setOnline(false); setBackendReachable(false) }

    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)

    // Initial probe
    void probeBackend().then(setBackendReachable)

    // Periodic re-check
    probe.current = setInterval(() => {
      if (navigator.onLine) void probeBackend().then(setBackendReachable)
    }, PROBE_INTERVAL)

    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(probe.current)
    }
  }, [setOnline, setBackendReachable])
}
