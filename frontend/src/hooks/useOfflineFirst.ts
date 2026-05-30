// ─── useOfflineFirst ──────────────────────────────────────────────────────────
// Mount once at App root.  Monitors connectivity, probes the backend, and
// flushes the sync queue automatically when the connection is restored.
// Projects in progress are NEVER discarded on disconnect.

import { useEffect, useRef, useCallback } from 'react'
import { useNetworkStore } from '../store/networkStore'
import { flush, pendingCount } from '../services/syncQueue'
import { getAccessToken } from '../services/api'

const API_BASE       = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
const PROBE_URL      = `${API_BASE}/health`
const PROBE_INTERVAL = 30_000   // 30 s
const PROBE_TIMEOUT  = 5_000    // 5 s
const RECONNECT_WAIT = 800      // ms grace before marking "back online"
const OFFLINE_GRACE  = 4_000    // ms to keep wasOffline=true after reconnect

async function probeBackend(): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT)
    const res = await fetch(PROBE_URL, { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(t)
    return res.ok
  } catch { return false }
}

export function useOfflineFirst(): void {
  const store     = useNetworkStore()
  const reconnect = useRef<ReturnType<typeof setTimeout>>()
  const probe     = useRef<ReturnType<typeof setInterval>>()
  const flushLock = useRef(false)

  // ── Sync queue flush ──────────────────────────────────────────────────────
  const flushQueue = useCallback(async () => {
    if (flushLock.current) return
    flushLock.current = true
    store.setSyncing(true)
    try {
      const { remaining } = await flush(API_BASE, getAccessToken())
      store.setSyncPending(remaining)
      store.setLastSyncAt(Date.now())
    } finally {
      store.setSyncing(false)
      flushLock.current = false
    }
  }, [store])

  // ── Periodic sync-pending count refresh ──────────────────────────────────
  const refreshPendingCount = useCallback(async () => {
    const count = await pendingCount()
    store.setSyncPending(count)
  }, [store])

  // ── Online / offline handlers ─────────────────────────────────────────────
  const handleOnline = useCallback(() => {
    clearTimeout(reconnect.current)
    store.setReconnecting(true)
    reconnect.current = setTimeout(async () => {
      const reachable = await probeBackend()
      store.setOnline(true)
      store.setBackendReachable(reachable)
      store.setReconnecting(false)
      store.setWasOffline(true)
      setTimeout(() => store.setWasOffline(false), OFFLINE_GRACE)
      if (reachable) await flushQueue()
    }, RECONNECT_WAIT)
  }, [store, flushQueue])

  const handleOffline = useCallback(() => {
    clearTimeout(reconnect.current)
    store.setOnline(false)
    store.setReconnecting(false)
    store.setBackendReachable(false)
  }, [store])

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial probe
    probeBackend().then(reachable => {
      store.setBackendReachable(reachable)
      if (reachable) void flushQueue()
    })

    void refreshPendingCount()

    probe.current = setInterval(async () => {
      if (!navigator.onLine) return
      const reachable = await probeBackend()
      store.setBackendReachable(reachable)
      if (reachable && store.syncPending > 0) await flushQueue()
      else await refreshPendingCount()
    }, PROBE_INTERVAL)

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearTimeout(reconnect.current)
      clearInterval(probe.current)
    }
  }, [handleOnline, handleOffline, flushQueue, refreshPendingCount, store])
}
