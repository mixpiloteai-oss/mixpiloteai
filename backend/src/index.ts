// ============================================================
// NEUROTEK AI Backend — Express Server
// ============================================================
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

import authRouter from './routes/auth';
import projectsRouter from './routes/projects';
import templatesRouter from './routes/templates';
import aiRouter from './routes/ai';
import subscriptionsRouter from './routes/subscriptions';
import packsRouter from './routes/packs';
import licenseRouter from './routes/license';

const app = express();
const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';

// ── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/packs', packsRouter);
app.use('/api/license', licenseRouter);

// ── Health check (must respond 200 for Railway / Render probes) ──
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  console.log(`[NEUROTEK AI] Backend listening on ${HOST}:${PORT}`);
  if (!process.env.CLAUDE_API_KEY || process.env.CLAUDE_API_KEY.includes('REPLACE')) {
    console.warn('[NEUROTEK AI] ⚠  CLAUDE_API_KEY not set — AI features disabled');
  }
  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('REPLACE')) {
    console.warn('[NEUROTEK AI] ⚠  SUPABASE_URL not set — using in-memory fallback');
  }
});

export default app;
