// ============================================================
// NEUROTEK AI Backend — Projects Router
// ============================================================
import { Router, Request, Response } from 'express';
import { db } from '../data/mockDB';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, fail, HTTP } from '../utils/response';
import { validate } from '../utils/validate';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const projects = db.getAllProjects();
  res.json(ok(projects, { count: projects.length }));
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const project = db.getProject(req.params.id);
  if (!project) {
    res.status(HTTP.NOT_FOUND).json(fail('Project not found'));
    return;
  }
  res.json(ok(project));
}));

router.post('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!validate(req, res, {
    name:  { required: true, type: 'string' },
    genre: { required: true, type: 'string' },
    bpm:   { required: true, type: 'number' },
  })) return;

  const { name, genre, bpm, key, mood, coverColor, tags } = req.body as Record<string, unknown>;
  const project = db.createProject({
    name: name as string,
    genre: (genre as string) ?? 'mentalcore',
    bpm: Number(bpm) ?? 140,
    key: (key as string) ?? 'C',
    mood: (mood as string) ?? 'aggressive',
    tracks: [],
    duration: 0,
    isStarred: false,
    coverColor: (coverColor as string) ?? 'linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)',
    tags: (tags as string[]) ?? [],
    userId: '',
  });
  res.status(HTTP.CREATED).json(ok(project));
}));

router.patch('/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const updated = db.updateProject(req.params.id, req.body);
  if (!updated) {
    res.status(HTTP.NOT_FOUND).json(fail('Project not found'));
    return;
  }
  res.json(ok(updated));
}));

router.delete('/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const deleted = db.deleteProject(req.params.id);
  if (!deleted) {
    res.status(HTTP.NOT_FOUND).json(fail('Project not found'));
    return;
  }
  res.json(ok({ message: 'Project deleted' }));
}));

router.post('/:id/star', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const project = db.getProject(req.params.id);
  if (!project) {
    res.status(HTTP.NOT_FOUND).json(fail('Project not found'));
    return;
  }
  const updated = db.updateProject(req.params.id, { isStarred: !project.isStarred });
  res.json(ok(updated));
}));

export default router;
