// ============================================================
// NEUROTEK AI — Local AI Management Routes
// ============================================================
// Mounted at /api/local-ai. Requires auth.
// Provides model management, status, and SSE pull progress.
// ============================================================
import { Router, Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminAuth';
import { asyncHandler } from '../middleware/asyncHandler';
import { RequestHandler } from 'express';
import {
  getLocalAIStatus,
  listOllamaModels,
  pullOllamaModel,
  deleteOllamaModel,
  detectGPU,
  RECOMMENDED_MODELS,
  checkOllama,
} from '../services/localAIService';
import { getRoutingStatus } from '../services/aiRouter';

const router = Router();
router.use(requireAuth);

// ── Status ────────────────────────────────────────────────────

/**
 * GET /api/local-ai/status
 * Returns Ollama/llama.cpp availability, loaded models, GPU info.
 */
router.get('/status', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const [status, routing] = await Promise.all([
    getLocalAIStatus(),
    getRoutingStatus(),
  ]);
  res.json({ success: true, data: { ...status, routing } });
}));

/**
 * GET /api/local-ai/gpu
 * Returns GPU detection result.
 */
router.get('/gpu', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const gpu = await detectGPU();
  res.json({ success: true, data: gpu });
}));

// ── Model catalogue ───────────────────────────────────────────

/**
 * GET /api/local-ai/catalogue
 * Returns the list of recommended models with RAM/disk requirements.
 */
router.get('/catalogue', (_req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: RECOMMENDED_MODELS });
});

/**
 * GET /api/local-ai/models
 * Returns models currently installed in Ollama.
 */
router.get('/models', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const [installed, catalogue] = await Promise.all([
    listOllamaModels(),
    Promise.resolve(RECOMMENDED_MODELS),
  ]);

  // Enrich installed models with catalogue metadata
  const enriched = installed.map(m => {
    const meta = catalogue.find(c => c.ollamaId === m.name || m.name.startsWith(c.family));
    return { ...m, catalogueInfo: meta ?? null };
  });

  res.json({ success: true, data: enriched });
}));

// ── Pull model (SSE progress stream) ─────────────────────────

/**
 * POST /api/local-ai/models/:name/pull
 * Starts downloading a model from Ollama registry.
 * Streams progress as SSE events.
 * Body: { name: string }  OR model name from URL param.
 */
router.post('/models/:name/pull', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Only admin or studio plan can pull models
  const plan = req.user?.plan ?? 'free';
  if (plan !== 'studio' && !req.user?.id) {
    res.status(403).json({ success: false, error: 'Studio plan required to pull models.' });
    return;
  }

  const rawName = req.params.name!;
  // Decode URL-encoded colon (mistral:7b → mistral%3A7b in URL)
  const modelName = decodeURIComponent(rawName);

  // Validate model name — only allow safe characters
  if (!/^[a-z0-9_:.\-/]+$/i.test(modelName)) {
    res.status(400).json({ success: false, error: 'Invalid model name.' });
    return;
  }

  const ollamaOk = await checkOllama();
  if (!ollamaOk.available) {
    res.status(503).json({ success: false, error: 'Ollama is not running. Start it with: ollama serve' });
    return;
  }

  // SSE setup
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    for await (const progress of pullOllamaModel(modelName)) {
      sendEvent(progress);
      if (progress.status === 'complete' || progress.status === 'error') break;
    }
  } catch (err) {
    sendEvent({ status: 'error', model: modelName, error: (err as Error).message });
  } finally {
    res.end();
  }
}));

// ── Delete model (admin only) ─────────────────────────────────

/**
 * DELETE /api/local-ai/models/:name
 * Removes a model from Ollama. Admin only.
 */
router.delete(
  '/models/:name',
  requireAdmin as unknown as RequestHandler,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const modelName = decodeURIComponent(req.params.name!);
    const ok = await deleteOllamaModel(modelName);
    if (ok) {
      res.json({ success: true, message: `Model ${modelName} deleted.` });
    } else {
      res.status(500).json({ success: false, error: 'Failed to delete model from Ollama.' });
    }
  })
);

// ── Routing status ────────────────────────────────────────────

/**
 * GET /api/local-ai/routing
 * Returns AI routing status — which backend will be used.
 */
router.get('/routing', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const status = await getRoutingStatus();
  res.json({ success: true, data: status });
}));

export default router;
