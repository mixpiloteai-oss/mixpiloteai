// ============================================================
// NEUROTEK AI Backend — Server entry point
// ============================================================
import dotenv from 'dotenv';
dotenv.config();

import { validateEnv } from './utils/validateEnv';
import { logger } from './utils/logger';
import app from './app';

validateEnv();

const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  logger.info(`[NEUROTEK AI] Backend listening on ${HOST}:${PORT}`);
  if (!process.env.CLAUDE_API_KEY || process.env.CLAUDE_API_KEY.includes('REPLACE')) {
    logger.warn('[NEUROTEK AI] CLAUDE_API_KEY not set — AI features disabled');
  }
  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('REPLACE')) {
    logger.warn('[NEUROTEK AI] SUPABASE_URL not set — using in-memory fallback');
  }
});

// ── Graceful shutdown ──────────────────────────────────────────────
// Gives in-flight requests up to 10s to complete before process exits.
// Required for Railway/Docker deployments that send SIGTERM on scale-down.
function shutdown(signal: string): void {
  logger.info(`[NEUROTEK AI] ${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info('[NEUROTEK AI] All connections closed — process exiting');
    process.exit(0);
  });
  // Force-exit after 10s if connections don't drain
  setTimeout(() => {
    logger.warn('[NEUROTEK AI] Forcing exit after 10s drain timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

export default app;
