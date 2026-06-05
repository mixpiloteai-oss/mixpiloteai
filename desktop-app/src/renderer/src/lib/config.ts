/**
 * Desktop app runtime config.
 * All environment-specific values live here.
 */

// In Electron renderer, import.meta.env works for Vite
const env = import.meta.env as Record<string, string | undefined>

export const config = {
  /** Backend API base URL */
  apiUrl: env['VITE_API_URL'] ?? 'https://mixpiloteai-production.up.railway.app',

  /** App version from package.json */
  version: env['VITE_APP_VERSION'] ?? '1.0.0',

  /** Feature flags */
  features: {
    cloudSync:     env['VITE_FEATURE_CLOUD_SYNC']     !== 'false',
    marketplace:   env['VITE_FEATURE_MARKETPLACE']    !== 'false',
    collaboration: env['VITE_FEATURE_COLLABORATION']  !== 'false',
    aiAssistant:   env['VITE_FEATURE_AI_ASSISTANT']   !== 'false',
  },

  /** API timeouts in ms */
  timeouts: {
    default:    10_000,
    ai:         60_000,
    upload:    120_000,
    export:    300_000,
  },
} as const

export type Config = typeof config
