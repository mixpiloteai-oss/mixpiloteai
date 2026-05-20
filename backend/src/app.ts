// ============================================================
// NEUROTEK AI Backend — Express App
// ============================================================
// This file exports the configured Express app WITHOUT calling
// `app.listen`. The only file that listens is `index.ts`. Tests
// import this module, mount the app on an ephemeral port, and
// hit it with native `fetch`.
// ============================================================
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { validateEnv } from './utils/validateEnv';
import { requestId } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import { securityHeaders } from './middleware/securityHeaders';
import { trackResponse, blockSuspicious } from './middleware/suspiciousActivity';
import { generalRateLimiter } from './middleware/rateLimiter';
import { logSecurityEvent } from './utils/securityLog';

// Validate env in non-test contexts. Tests own env explicitly via
// tests/setup/env.ts and must not be killed by a strict check.
if (process.env.NODE_ENV !== 'test') {
  validateEnv();
}

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
import pluginsRouter from './routes/plugins'
import updatesRouter from './routes/updates';

const app = express();

// Disable Express's default "X-Powered-By: Express" header — information disclosure.
app.disable('x-powered-by');

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

const PROJECT_VERCEL_RE = /^https:\/\/mixpiloteai(-[a-z0-9-]+)?\.vercel\.app$/;

app.use(cors({
  origin: (origin, callback) => {
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

app.use('/api/auth', express.json({ limit: '10kb' }));
app.use(express.json({ limit: '2mb' }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}
app.use(cacheHeaders);

app.use(trackResponse);
app.use(generalRateLimiter);

// ── Routes ───────────────────────────────────────────────────
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
app.use('/api/plugins',     pluginsRouter);
app.use('/api/updates',     updatesRouter);

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use(errorHandler);

export default app;
