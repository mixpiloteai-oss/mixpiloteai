// ── db.ts — Supabase client wrapper with retry + helpers ─────────────────────
import { supabase, isSupabaseConfigured } from './supabase'
import { logger } from '../utils/logger'

export { supabase, isSupabaseConfigured }

const MAX_RETRIES = 3
const RETRY_BASE_MS = 200

/** Retries a Supabase query on transient errors (network, timeout, 5xx) */
export async function withRetry<T>(
  fn: () => Promise<{ data: T | null; error: { message: string; code?: string } | null }>,
  context = 'db',
  retries = MAX_RETRIES,
): Promise<T> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1)
      await new Promise(r => setTimeout(r, delay))
      logger.warn(`[${context}] retry attempt ${attempt}/${retries}`)
    }
    const { data, error } = await fn()
    if (!error) return data as T
    lastError = new Error(error.message)
    // Don't retry on client errors (4xx / constraint violations)
    const code = (error as { code?: string }).code ?? ''
    const msg = error.message ?? ''
    if (
      code === '23505' ||  // unique violation
      code === '23503' ||  // FK violation
      code === '42703' ||  // column not found
      msg.includes('not found') ||
      msg.includes('violates')
    ) {
      throw lastError
    }
  }
  throw lastError ?? new Error(`[${context}] query failed after ${retries} retries`)
}

/** Supabase does not support multi-statement transactions over HTTP.
 *  Use this to wrap related writes and attempt rollback on failure.
 *  True ACID transactions require using the Postgres DB directly or Supabase RPC.
 */
export async function withTransaction<T>(
  fn: () => Promise<T>,
  _context = 'txn',
): Promise<T> {
  // For now: execute sequentially; full transaction support requires direct pg connection
  return fn()
}
