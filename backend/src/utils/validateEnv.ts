import { logger } from './logger'

interface EnvVar {
  key: string
  required: boolean
  sensitive: boolean
}

const ENV_VARS: EnvVar[] = [
  { key: 'JWT_SECRET',                required: true,  sensitive: true },
  { key: 'ADMIN_JWT_SECRET',          required: false, sensitive: true },
  { key: 'STRIPE_WEBHOOK_SECRET',     required: false, sensitive: true },
  { key: 'SUPABASE_URL',              required: false, sensitive: false },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', required: false, sensitive: true },
  { key: 'STRIPE_SECRET_KEY',         required: false, sensitive: true },
  { key: 'CLAUDE_API_KEY',            required: false, sensitive: true },
  { key: 'ADMIN_KEY',                 required: false, sensitive: true },
]

const INSECURE_DEFAULTS = [
  'dev-secret',
  'placeholder',
  'change-in-production',
  'your-',
  'nt-admin-dev-2025',
  'admin-dev-secret',
  'dev-refresh-secret',
]

export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === 'production'
  let hasWarnings = false

  for (const { key, required, sensitive } of ENV_VARS) {
    const value = process.env[key]

    if (!value) {
      if (required) {
        logger.error(`Missing required env var: ${key}`)
        process.exit(1)
      }
      logger.warn(`Optional env var not set: ${key} — some features disabled`)
      hasWarnings = true
      continue
    }

    if (sensitive && INSECURE_DEFAULTS.some(d => value.includes(d))) {
      if (isProd) {
        logger.error(
          `Insecure default detected for ${key} in production — refusing to start`,
          { key }
        )
        process.exit(1)
      }
      logger.warn(`Insecure default detected for ${key} — change before production`)
      hasWarnings = true
    }
  }

  if (!hasWarnings) {
    logger.info('Environment validation passed')
  }
}
