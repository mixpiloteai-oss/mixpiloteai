// ============================================================
// NEUROTEK AI Backend — Express Server
// ============================================================
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

import { validateEnv } from './utils/validateEnv';
import { logger } from './utils/logger';
import { requestId } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import { securityHeaders } from './middleware/securityHeaders';
import { trackResponse, blockSuspicious } from './middleware/suspiciousActivity';
import { generalRateLimiter } from './middleware/rateLimiter';
import { logSecurityEvent } from './utils/securityLog';

validateEnv();

import authRouter from './routes/auth';
import projectsRouter from './routes/projects';
import templatesRouter from './routes/templates';
import aiRouter from './routes/ai';
import subscriptionsRouter from './routes/subscriptions';
import packsRouter from './routes/packs';
import licenseRouter from './routes/license';
import saveRouter    from './routes/save';
import syncRouter    from './routes/sync';
import chunksRouter  from './routes/chunks';
import exportRouter  from './routes/export';
import collabRouter, { teamsRouter } from './routes/collaboration';
import marketplaceRouter from './routes/marketplace';
import creatorsRouter from './routes/creators';
import { cacheHeaders } from './middleware/cacheHeaders';
import paymentsRouter from './routes/payments';
import adminRouter from './routes/admin';

const app = express();
const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';

// ── Middleware ───────────────────────────────────────────────
app.use(requestId);
app.use(securityHeaders);

const STATIC_ORIGINS = [
  'https://mixpiloteai.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

const extraOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : [];

const allowedOrigins = Array.from(new Set([...STATIC_ORIGINS, ...extraOrigins]));

// Only the project's own Vercel deployments may use the wildcard.
// Production prod URL + preview deployments share the prefix `mixpiloteai`,
// e.g. `mixpiloteai-git-feature-x.vercel.app`. We deliberately do NOT
// allow arbitrary `*.vercel.app` — that would let any attacker register
// a Vercel project and obtain a valid origin.
const PROJECT_VERCEL_RE = /^https:\/\/mixpiloteai(-[a-z0-9-]+)?\.vercel\.app$/;

app.use(cors({
  origin: (origin, callback) => {
    // allow server-to-server / curl (no Origin header)
    if (!origin) return callback(null, true);
    if (PROJECT_VERCEL_RE.test(origin)) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);

    logSecurityEvent({
      type: 'cors_blocked',
      severity: 'warn',
      reason: 'origin not allowed',
      meta: { origin },
    });
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id'],
}));

// Ensure preflight OPTIONS requests return 200
app.options('*', cors());

// IMPORTANT: Stripe webhook needs raw body — must be registered BEFORE express.json()
app.post(
  '/api/payments/stripe/webhook',
  express.raw({ type: '*/*' }),
  (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { rawBody?: Buffer }).rawBody = req.body as Buffer;
    next();
  }
);

// Tight payload limit for auth — body should never exceed a few KB.
// Mounted with its own json parser BEFORE the global one so the global
// 2mb parser does not see /api/auth bodies first.
app.use('/api/auth', express.json({ limit: '10kb' }));

app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cacheHeaders);

// Track outcomes globally for the suspicious-activity tracker.
app.use(trackResponse);

// Broad mutation rate-limit. AI / payments / marketplace have their own
// stricter limiters mounted on their routers.
app.use(generalRateLimiter);

// ── Routes ───────────────────────────────────────────────────
// blockSuspicious is mounted ONLY in front of authentication entry
// points — we never want to quarantine legit users on, e.g., GET /api/projects.
app.use('/api/auth', blockSuspicious, authRouter);
app.use('/api/admin/auth', blockSuspicious);
app.use('/api/projects', projectsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/packs', packsRouter);
app.use('/api/license', licenseRouter);
app.use('/api/save',    saveRouter);
app.use('/api/sync',    syncRouter);
app.use('/api/chunks',  chunksRouter);
app.use('/api/export',  exportRouter);
app.use('/api/collab', collabRouter);
app.use('/api/teams',  teamsRouter);
app.use('/api/marketplace', marketplaceRouter);
app.use('/api/creators',    creatorsRouter);
app.use('/api/payments',    paymentsRouter);
app.use('/api/admin',       adminRouter);

// ── Health check (must respond 200 for Railway / Render probes) ──
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

// ── Global error handler (must be last) ──────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
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
