// ============================================================
// NEUROTEK AI Backend — Projects Router
// ============================================================
import { Router, Request, Response } from 'express';
import { db } from '../data/mockDB';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const projects = db.getAllProjects();
  res.json({ success: true, data: projects, count: projects.length });
});

router.get('/:id', (req: Request, res: Response) => {
  const project = db.getProject(req.params.id);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
  res.json({ success: true, data: project });
});

router.post('/', (req: Request, res: Response) => {
  const { name, genre, bpm, key, mood, coverColor, tags } = req.body;
  if (!name || !genre || !bpm) return res.status(400).json({ success: false, error: 'name, genre, and bpm are required' });
  const project = db.createProject({
    name, genre: genre ?? 'mentalcore', bpm: Number(bpm) ?? 140,
    key: key ?? 'C', mood: mood ?? 'aggressive', tracks: [], duration: 0,
    isStarred: false, coverColor: coverColor ?? 'linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)', tags: tags ?? [],
    userId: '',
  });
  res.status(201).json({ success: true, data: project });
});

router.patch('/:id', (req: Request, res: Response) => {
  const updated = db.updateProject(req.params.id, req.body);
  if (!updated) return res.status(404).json({ success: false, error: 'Project not found' });
  res.json({ success: true, data: updated });
});

router.delete('/:id', (req: Request, res: Response) => {
  const deleted = db.deleteProject(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, error: 'Project not found' });
  res.json({ success: true, message: 'Project deleted' });
});

router.post('/:id/star', (req: Request, res: Response) => {
  const project = db.getProject(req.params.id);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
  const updated = db.updateProject(req.params.id, { isStarred: !project.isStarred });
  res.json({ success: true, data: updated });
});

export default router;
