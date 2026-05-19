/** API base URL — set VITE_API_URL in .env to override */
export const API_URL = import.meta.env.VITE_API_URL ?? 'https://mixpiloteai-production.up.railway.app'

/** App name */
export const APP_NAME = 'NeuroTek AI'

/** Plans */
export const PLANS = {
  FREE:   'free',
  PRO:    'pro',
  STUDIO: 'studio',
  LABEL:  'label',
} as const

export type Plan = typeof PLANS[keyof typeof PLANS]

/** Plan prices (in cents) */
export const PLAN_PRICES = {
  pro_monthly:    999,
  pro_annual:     7999,
  studio_monthly: 2499,
  studio_annual:  19999,
  label_monthly:  7999,
  label_annual:   63999,
} as const

/** External links */
export const LINKS = {
  discord: 'https://discord.gg/neurotek',
  twitter: 'https://twitter.com/neurotekAI',
  github:  'https://github.com/mixpiloteai-oss',
  docs:    'https://docs.neurotek.ai',
} as const
