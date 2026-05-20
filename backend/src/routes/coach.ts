// ============================================================
// NEUROTEK AI — AI Coach Route (Genre-Specific + MIDI Aware)
// ============================================================
import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { checkQuota } from '../middleware/quota';
import { antiAbuse } from '../middleware/antiAbuse';
import { buildCoachPrompt, type Genre, type CoachSession } from '../prompts/coachPrompts';
import { logger } from '../utils/logger';
import { selectModel } from '../services/costOptimizer';
import { incrementUsage } from '../data/mockDB';
import { PLANS } from '../data/plans';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY ?? '' });

// POST /api/coach/chat
router.post(
  '/chat',
  antiAbuse,
  requireAuth,
  checkQuota,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const {
      message, genre = 'general', level = 'intermediate',
      midiSetup, context, history = [],
    } = req.body as {
      message: string;
      genre?: Genre;
      level?: 'beginner' | 'intermediate' | 'advanced';
      midiSetup?: string;
      context?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    if (!message?.trim()) {
      res.status(400).json({ success: false, error: 'Message required' });
      return;
    }

    const plan = (req.user?.plan ?? 'free') as keyof typeof PLANS;
    const planConfig = PLANS[plan] ?? PLANS.free;

    if (!planConfig.coachAccess) {
      res.status(403).json({
        success: false,
        error: 'AI Coach requires Creator plan or higher',
        code: 'PLAN_UPGRADE_REQUIRED',
        upgradeUrl: '/plans',
      });
      return;
    }

    const session: CoachSession = { genre, level, midiSetup, context };
    const systemPrompt = buildCoachPrompt(session);
    const modelSelection = selectModel(plan as any, 'coach', message.length);

    const messages = [
      ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: message },
    ];

    try {
      const response = await anthropic.messages.create({
        model: modelSelection.model,
        max_tokens: modelSelection.maxTokens,
        system: systemPrompt,
        messages,
      });

      incrementUsage(req.user!.id);

      const content = response.content[0];
      const text = content.type === 'text' ? content.text : '';

      res.json({
        success: true,
        data: {
          response: text,
          genre,
          level,
          model: modelSelection.tier,
          tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        },
      });
    } catch (err: unknown) {
      logger.error('[Coach] Claude API error', { error: err instanceof Error ? err.message : String(err) });
      res.status(503).json({ success: false, error: 'AI service temporarily unavailable' });
    }
  },
);

// GET /api/coach/genres
router.get('/genres', (_req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'mentalcore',  name: 'Mentalcore',          bpm: '190–220', description: 'Ultra-fast, distorted, industrial' },
      { id: 'hardtek',     name: 'Hardtek',              bpm: '140–155', description: 'Raw acid, lo-fi, hypnotic' },
      { id: 'tribe',       name: 'Tribe / Tribal Tekno', bpm: '140–155', description: 'Organic percussion, ritualistic' },
      { id: 'acidcore',    name: 'Acidcore',             bpm: '160–180', description: 'Extreme 303, saturated kicks' },
      { id: 'hardtechno',  name: 'Hard Techno',          bpm: '145–165', description: 'Dark industrial groove, DJ-friendly' },
      { id: 'general',     name: 'General',              bpm: 'all',     description: 'All genres coaching' },
    ],
  });
});

export default router;
