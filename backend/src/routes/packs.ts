// ============================================================
// NEUROTEK AI — Packs Routes
// ============================================================
import { Router, Response } from 'express';
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { getPacks, getBuiltinPacks, getPackById, downloadPack, ratePack, addComment, getRecommendedPacks, type PackFilters, type PackType } from '../data/mockPacksDB';

const router = Router();

router.get('/', optionalAuth, (req: AuthenticatedRequest, res: Response) => {
  const { type, genre, search, sort, free } = req.query;
  const filters: PackFilters = {
    type: type as PackType | undefined,
    genre: genre as string | undefined,
    search: search as string | undefined,
    sort: (sort as PackFilters['sort']) ?? 'trending',
    freeOnly: free === 'true',
  };
  res.json({ success: true, data: getPacks(filters) });
});

router.get('/builtin', (_req, res) => res.json({ success: true, data: getBuiltinPacks() }));

router.get('/recommended', optionalAuth, (req: AuthenticatedRequest, res: Response) => {
  const genre = req.query.genre as string | undefined;
  res.json({ success: true, data: getRecommendedPacks(genre) });
});

router.get('/:id', (req, res) => {
  const pack = getPackById(req.params.id);
  if (!pack) return res.status(404).json({ success: false, error: 'Pack not found' });
  res.json({ success: true, data: pack });
});

router.post('/:id/download', optionalAuth, (req, res) => {
  const pack = downloadPack(req.params.id);
  if (!pack) return res.status(404).json({ success: false, error: 'Pack not found' });
  res.json({ success: true, data: pack, message: 'Download started' });
});

router.post('/:id/rate', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { rating } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ success: false, error: 'rating must be between 1 and 5' });
  const pack = ratePack(req.params.id, Number(rating));
  if (!pack) return res.status(404).json({ success: false, error: 'Pack not found' });
  res.json({ success: true, data: pack });
});

router.post('/:id/comment', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ success: false, error: 'content is required' });
  const comment = addComment(req.params.id, req.user!.id, req.user!.name, content);
  if (!comment) return res.status(404).json({ success: false, error: 'Pack not found' });
  res.status(201).json({ success: true, data: comment });
});

router.post('/upload', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const plan = req.user!.plan;
  if (plan === 'free') return res.status(403).json({ success: false, error: 'Pack upload requires Pro or Studio plan', code: 'PREMIUM_REQUIRED' });
  const { name, description, type, genre, tags } = req.body;
  if (!name || !description || !type) return res.status(400).json({ success: false, error: 'name, description, and type are required' });
  res.status(201).json({
    success: true,
    message: 'Pack upload queued for review',
    data: { id: `cp-${Date.now()}`, name, description, type, genre, tags: tags ?? [], author: req.user!.name, status: 'pending_review' },
  });
});

export default router;
