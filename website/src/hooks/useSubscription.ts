import { useState, useEffect, useCallback } from 'react'
import { subscriptionsApi } from '../lib/api'
import { authTokens } from '../lib/api'

export interface SubscriptionStatus {
  plan: string
  status: string
  isActive: boolean
  isPremium: boolean
  expiresAt: number | null
  daysRemaining: number | null
  loading: boolean
  error: string | null
}

const DEFAULT_STATUS: SubscriptionStatus = {
  plan: 'free',
  status: 'inactive',
  isActive: false,
  isPremium: false,
  expiresAt: null,
  daysRemaining: null,
  loading: false,
  error: null,
}

export function useSubscription(): SubscriptionStatus & { refresh: () => void } {
  const [status, setStatus] = useState<SubscriptionStatus>({ ...DEFAULT_STATUS, loading: true })

  const fetch = useCallback(async () => {
    // Only fetch if logged in
    const token = authTokens.get()
    if (!token) {
      setStatus({ ...DEFAULT_STATUS, loading: false })
      return
    }
    setStatus(s => ({ ...s, loading: true, error: null }))
    try {
      const res = await subscriptionsApi.status()
      setStatus({
        ...(res.data ?? DEFAULT_STATUS),
        loading: false,
        error: null,
      })
    } catch (e: unknown) {
      setStatus(s => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load subscription',
      }))
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { ...status, refresh: fetch }
}
