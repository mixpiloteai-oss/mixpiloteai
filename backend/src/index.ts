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

app.listen(PORT, HOST, () => {
  logger.info(`[NEUROTEK AI] Backend listening on ${HOST}:${PORT}`);
  if (!process.env.CLAUDE_API_KEY || process.env.CLAUDE_API_KEY.includes('REPLACE')) {
    logger.warn('[NEUROTEK AI] CLAUDE_API_KEY not set — AI features disabled');
  }
  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('REPLACE')) {
    logger.warn('[NEUROTEK AI] SUPABASE_URL not set — using in-memory fallback');
  }
});

export default app;
