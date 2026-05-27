// ============================================================
// NEUROTEK AI — AI Gateway Routes (auth + quota protected)
// ============================================================
import { Router, Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { checkQuota } from '../middleware/quota';
import { aiRateLimiter } from '../middleware/rateLimiter';
import { callClaude, getDemoResponse, isConfigured, type AIRequest } from '../services/aiGateway';
import { logger } from '../utils/logger';
import { incrementUsage, getTodayUsage, getDailyLimit, type Plan } from '../data/mockDB';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();
router.use(requireAuth);
router.use(aiRateLimiter);
router.use(checkQuota);

async function executeAI(req: AuthenticatedRequest, res: Response, aiReq: AIRequest, demoType: string) {
  try {
    let content: string;
    let meta: object = { demo: true };
    if (isConfigured()) {
      const result = await callClaude(aiReq);
      content = result.content;
      meta = { model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
    } else {
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
      content = getDemoResponse(demoType);
    }
    await incrementUsage(req.user!.id);
    const used = await getTodayUsage(req.user!.id);
    const limit = getDailyLimit(req.user!.plan as Plan);
    res.json({
      success: true,
      data: { id: `msg-${Date.now()}`, role: 'assistant', content, timestamp: new Date().toISOString(), meta, quota: { used, limit, remaining: Math.max(0, limit - used) } },
    });
  } catch (err) {
    const error = err as Error;
    logger.error('[AI Gateway]', { message: error.message });
    res.status(500).json({ success: false, error: 'AI service error', message: error.message });
  }
}

router.post('/chat', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { message, context, history, type = 'chat' } = req.body;
  if (!message || typeof message !== 'string') return res.status(400).json({ success: false, error: 'message is required' });
  const validTypes = ['chat', 'template', 'mix', 'fx', 'live', 'kick', 'acid'];
  const messageType = validTypes.includes(type) ? type : 'chat';
  await executeAI(req, res, { userId: req.user!.id, plan: req.user!.plan, messageType, userMessage: message, projectContext: context, history }, messageType);
}));

router.post('/generate-template', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { genre, bpm, mood } = req.body;
  if (!genre || !bpm) return res.status(400).json({ success: false, error: 'genre and bpm are required' });
  const message = `Generate a complete ${genre} template at ${bpm} BPM${mood ? ` with a ${mood} mood` : ''}. Include full track list, FX chains, routing, and production notes.`;
  await executeAI(req, res, { userId: req.user!.id, plan: req.user!.plan, messageType: 'template', userMessage: message, projectContext: { genre, bpm, mood } }, 'template');
}));

router.post('/analyse-mix', async (req: AuthenticatedRequest, res: Response) => {
  const { tracks, genre, bpm } = req.body;
  const trackList = Array.isArray(tracks) ? tracks.map((t: { name: string; type: string }) => `${t.name} (${t.type})`).join(', ') : 'unknown tracks';
  const message = `Analyse this ${genre ?? 'electronic'} mix at ${bpm ?? '?'} BPM. Tracks: ${trackList}. Identify frequency conflicts, suggest sidechain relationships, and provide specific EQ/compression recommendations.`;
  await executeAI(req, res, { userId: req.user!.id, plan: req.user!.plan, messageType: 'mix', userMessage: message, projectContext: { genre, bpm } }, 'mix');
});

router.post('/suggest-fx', async (req: AuthenticatedRequest, res: Response) => {
  const { trackType, genre, bpm, trackName } = req.body;
  if (!trackType) return res.status(400).json({ success: false, error: 'trackType is required' });
  const message = `Design an FX chain for a ${trackType} track${trackName ? ` named "${trackName}"` : ''} in ${genre ?? 'hard techno'} at ${bpm ?? 180} BPM. Provide the complete processing chain with exact plugin settings.`;
  await executeAI(req, res, { userId: req.user!.id, plan: req.user!.plan, messageType: 'fx', userMessage: message, projectContext: { genre, bpm } }, 'fx');
});

router.post('/design-kick', async (req: AuthenticatedRequest, res: Response) => {
  const { genre, bpm, style } = req.body;
  const message = `Design a kick drum for ${genre ?? 'mentalcore'} at ${bpm ?? 200} BPM${style ? ` (style: ${style})` : ''}. Provide synthesis approach, processing chain with exact parameters, and layering tips.`;
  await executeAI(req, res, { userId: req.user!.id, plan: req.user!.plan, messageType: 'kick', userMessage: message, projectContext: { genre, bpm } }, 'kick');
});

router.post('/prepare-live', async (req: AuthenticatedRequest, res: Response) => {
  const { genre, duration, bpm, tracksCount } = req.body;
  const message = `Prepare a ${duration ?? 60}-minute live set structure for ${genre ?? 'tribe/mentalcore'} at ${bpm ?? 200} BPM with ${tracksCount ?? 8} tracks. Define scenes, transitions, and energy arc.`;
  await executeAI(req, res, { userId: req.user!.id, plan: req.user!.plan, messageType: 'live', userMessage: message, projectContext: { genre, bpm } }, 'live');
});

router.post('/acid-pattern', async (req: AuthenticatedRequest, res: Response) => {
  const { key, bpm, style, bars } = req.body;
  const message = `Create a ${style ?? 'dark psychedelic'} acid pattern in ${key ?? 'Am'} at ${bpm ?? 180} BPM over ${bars ?? 4} bars. Include note sequence, accent/slide positions, filter automation, and 303 parameter settings.`;
  await executeAI(req, res, { userId: req.user!.id, plan: req.user!.plan, messageType: 'acid', userMessage: message, projectContext: { bpm } }, 'acid');
});

router.get('/quota', async (req: AuthenticatedRequest, res: Response) => {
  const used = await getTodayUsage(req.user!.id);
  const limit = getDailyLimit(req.user!.plan as Plan);
  res.json({ success: true, data: { plan: req.user!.plan, used, limit, remaining: Math.max(0, limit - used), resetAt: new Date(new Date().setHours(24, 0, 0, 0)).toISOString() } });
});

export default router;
