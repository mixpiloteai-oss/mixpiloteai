// ============================================================
// NEUROTEK AI Backend — Templates Router
// ============================================================
import { Router, Request, Response } from 'express';
import { db } from '../data/mockDB';

const router = Router();

const genreDefaults: Record<string, { bpmRange: [number, number]; tracks: string[] }> = {
  mentalcore: { bpmRange: [190, 220], tracks: ['kick', 'kick-sub', 'bass', 'acid', 'fx', 'hihat', 'master'] },
  tribe: { bpmRange: [140, 155], tracks: ['kick', 'percussion', 'bass', 'loop-fx', 'master'] },
  hardtek: { bpmRange: [140, 155], tracks: ['kick', 'bass', 'lead', 'percussion', 'fx', 'master'] },
  acidcore: { bpmRange: [160, 180], tracks: ['kick', 'break', 'bass', 'acid', 'pad', 'fx', 'master'] },
  'hard-techno': { bpmRange: [145, 165], tracks: ['kick', 'bass', 'synth', 'stab', 'fx', 'pad', 'master'] },
  tekno: { bpmRange: [150, 165], tracks: ['kick', 'bass', 'loop', 'fx', 'master'] },
};

router.get('/', (_req: Request, res: Response) => {
  res.json({ success: true, data: db.getAllTemplates() });
});

router.get('/:id', (req: Request, res: Response) => {
  const template = db.getTemplate(req.params.id);
  if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
  res.json({ success: true, data: template });
});

router.post('/generate', (req: Request, res: Response) => {
  const { genre = 'mentalcore', bpm = 140, mood = 'aggressive' } = req.body;

  const genreDef = genreDefaults[genre] ?? genreDefaults.mentalcore;
  const trackColors: Record<string, string> = {
    kick: '#ef4444', 'kick-sub': '#dc2626', bass: '#f59e0b', acid: '#06b6d4',
    fx: '#10b981', hihat: '#ec4899', master: '#7c3aed', percussion: '#ec4899',
    'loop-fx': '#10b981', lead: '#06b6d4', pad: '#38bdf8', break: '#a78bfa',
    synth: '#06b6d4', stab: '#ec4899', loop: '#10b981',
  };
  const fxByType: Record<string, Array<{ name: string; type: string; enabled: boolean; params: Record<string, unknown> }>> = {
    kick: [{ name: 'Transient Shaper', type: 'compressor', enabled: true, params: { attack: 0, sustain: -6 } }, { name: 'Clipper', type: 'distortion', enabled: true, params: { ceiling: 0.9 } }],
    bass: [{ name: 'OTT Compressor', type: 'compressor', enabled: true, params: { depth: 0.7 } }, { name: 'Saturator', type: 'distortion', enabled: true, params: { drive: 45 } }],
    acid: [{ name: 'Filter Sweep', type: 'filter', enabled: true, params: { cutoff: 2000, resonance: 0.85 } }, { name: '1/8 Delay', type: 'delay', enabled: true, params: { time: '1/8', feedback: 0.35 } }],
    fx: [{ name: 'Reverb', type: 'reverb', enabled: true, params: { size: 0.8, mix: 0.5 } }],
    master: [{ name: 'Multiband Compressor', type: 'compressor', enabled: true, params: { threshold: -6, ratio: 4 } }, { name: 'Limiter', type: 'limiter', enabled: true, params: { ceiling: -0.3 } }],
  };

  const tracks = genreDef.tracks.map((trackType) => {
    const baseType = trackType.split('-')[0];
    return {
      name: trackType.toUpperCase().replace('-', ' '),
      type: baseType,
      color: trackColors[trackType] ?? '#7c3aed',
      volumeDefault: baseType === 'kick' ? 112 : baseType === 'master' ? 100 : 85,
      suggestedFX: fxByType[baseType] ?? [],
    };
  });

  const template = db.saveTemplate({
    name: `${genre.charAt(0).toUpperCase() + genre.slice(1)} Template`,
    genre, bpm: Number(bpm), mood,
    description: `AI-generated ${genre} template at ${bpm} BPM with ${mood} mood. Optimised for live performance and studio production.`,
    tracks, aiConfidence: 0.85 + Math.random() * 0.12, generatedAt: new Date().toISOString(),
  });
  res.status(201).json({ success: true, data: template });
});

export default router;
