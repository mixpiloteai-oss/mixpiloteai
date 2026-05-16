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
const PORT = process.env.PORT ?? 4000;

// ── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/packs', packsRouter);
app.use('/api/license', licenseRouter);

// ── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'NEUROTEK AI Backend',
    version: '0.2.0',
    claudeConfigured: !!(process.env.CLAUDE_API_KEY && !process.env.CLAUDE_API_KEY.includes('REPLACE')),
    timestamp: new Date().toISOString(),
  });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[NEUROTEK AI] Backend running on http://localhost:${PORT}`);
  if (!process.env.CLAUDE_API_KEY || process.env.CLAUDE_API_KEY.includes('REPLACE')) {
    console.warn('[NEUROTEK AI] ⚠  CLAUDE_API_KEY not set — running in demo mode');
  }
});

export default app;
