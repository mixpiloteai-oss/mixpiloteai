import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SubscriptionState {
  plan: string           // 'free' | 'pro' | 'studio' | 'label'
  status: string         // 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive'
  isActive: boolean
  isPremium: boolean
  expiresAt: number | null
  daysRemaining: number | null
  lastChecked: number | null   // Unix timestamp of last successful check
  // Actions
  setSubscription: (data: Omit<SubscriptionState, 'setSubscription' | 'reset' | 'lastChecked'>) => void
  reset: () => void
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set) => ({
      plan: 'free',
      status: 'inactive',
      isActive: false,
      isPremium: false,
      expiresAt: null,
      daysRemaining: null,
      lastChecked: null,
      setSubscription: (data) => set({ ...data, lastChecked: Math.floor(Date.now() / 1000) }),
      reset: () => set({ plan: 'free', status: 'inactive', isActive: false, isPremium: false, expiresAt: null, daysRemaining: null, lastChecked: null }),
    }),
    { name: 'nt-subscription' }
  )
)
