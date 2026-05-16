// ============================================================
// NEUROTEK AI — Packs In-Memory Database
// ============================================================
import { v4 as uuidv4 } from 'uuid';

export type PackType = 'template' | 'fx-rack' | 'drum-kit' | 'live-scene' | 'preset' | 'chain' | 'ai-workflow';

export interface Pack {
  id: string;
  name: string;
  description: string;
  type: PackType;
  genre: string;
  author: string;
  authorPlan: 'free' | 'pro' | 'studio';
  downloads: number;
  rating: number;
  ratingCount: number;
  tags: string[];
  isBuiltin: boolean;
  isFree: boolean;
  size: string;
  createdAt: string;
  comments: PackComment[];
}

export interface PackComment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

export interface PackFilters {
  type?: PackType;
  genre?: string;
  search?: string;
  sort?: 'trending' | 'newest' | 'top-rated';
  freeOnly?: boolean;
}

const BUILTIN_PACKS: Pack[] = [
  { id: 'bp-1', name: 'Mentalcore Starter', description: 'Complete mentalcore production template at 200 BPM', type: 'template', genre: 'mentalcore', author: 'NEUROTEK AI', authorPlan: 'studio', downloads: 1842, rating: 4.8, ratingCount: 234, tags: ['mentalcore', 'template', 'starter'], isBuiltin: true, isFree: true, size: '2.4 MB', createdAt: '2024-01-15T00:00:00Z', comments: [] },
  { id: 'bp-2', name: 'Hardtek Kick Pack', description: 'Professional hardtek kick drum processing chains', type: 'fx-rack', genre: 'hardtek', author: 'NEUROTEK AI', authorPlan: 'studio', downloads: 2156, rating: 4.9, ratingCount: 312, tags: ['hardtek', 'kick', 'fx'], isBuiltin: true, isFree: true, size: '1.8 MB', createdAt: '2024-01-20T00:00:00Z', comments: [] },
  { id: 'bp-3', name: 'Tribe Percussion Kit', description: 'Organic tribal percussion patterns and samples', type: 'drum-kit', genre: 'tribe', author: 'NEUROTEK AI', authorPlan: 'studio', downloads: 987, rating: 4.6, ratingCount: 145, tags: ['tribe', 'percussion', 'organic'], isBuiltin: true, isFree: true, size: '15.2 MB', createdAt: '2024-02-01T00:00:00Z', comments: [] },
  { id: 'bp-4', name: 'Acid 303 Presets', description: '16 classic 303 acid presets for mentalcore and hardtek', type: 'preset', genre: 'acidcore', author: 'NEUROTEK AI', authorPlan: 'studio', downloads: 3421, rating: 4.95, ratingCount: 521, tags: ['acid', '303', 'preset'], isBuiltin: true, isFree: true, size: '0.5 MB', createdAt: '2024-02-10T00:00:00Z', comments: [] },
  { id: 'bp-5', name: 'Hard Techno Scene Pack', description: 'Complete live scene launcher setup for hard techno', type: 'live-scene', genre: 'hard-techno', author: 'NEUROTEK AI', authorPlan: 'studio', downloads: 756, rating: 4.7, ratingCount: 98, tags: ['hard-techno', 'live', 'scenes'], isBuiltin: true, isFree: true, size: '3.1 MB', createdAt: '2024-02-15T00:00:00Z', comments: [] },
  { id: 'bp-6', name: 'Master Chain Pro', description: 'Professional mastering chain for tekno genres', type: 'chain', genre: 'mentalcore', author: 'NEUROTEK AI', authorPlan: 'studio', downloads: 4102, rating: 4.85, ratingCount: 678, tags: ['mastering', 'chain', 'pro'], isBuiltin: true, isFree: true, size: '0.3 MB', createdAt: '2024-03-01T00:00:00Z', comments: [] },
  { id: 'bp-7', name: 'AI Mix Workflow', description: 'Automated AI-assisted mixing workflow templates', type: 'ai-workflow', genre: 'mentalcore', author: 'NEUROTEK AI', authorPlan: 'studio', downloads: 1234, rating: 4.75, ratingCount: 189, tags: ['ai', 'workflow', 'mix'], isBuiltin: true, isFree: true, size: '0.8 MB', createdAt: '2024-03-10T00:00:00Z', comments: [] },
  { id: 'bp-8', name: 'Tekno Bass Templates', description: 'Minimalist tekno bass templates and processing chains', type: 'template', genre: 'tekno', author: 'NEUROTEK AI', authorPlan: 'studio', downloads: 654, rating: 4.5, ratingCount: 87, tags: ['tekno', 'bass', 'minimal'], isBuiltin: true, isFree: true, size: '1.2 MB', createdAt: '2024-03-20T00:00:00Z', comments: [] },
];

const communityPacks: Pack[] = [
  { id: 'cp-1', name: 'Mental Acid Toolkit', description: 'My personal acid toolkit for mentalcore — 200 BPM certified', type: 'template', genre: 'mentalcore', author: 'AcidFreak303', authorPlan: 'pro', downloads: 432, rating: 4.6, ratingCount: 67, tags: ['mental', 'acid', 'toolkit'], isBuiltin: false, isFree: true, size: '4.2 MB', createdAt: '2024-04-01T00:00:00Z', comments: [] },
  { id: 'cp-2', name: 'Underground Tribe Vol.1', description: 'Raw tribal tek sounds from the underground scene', type: 'drum-kit', genre: 'tribe', author: 'TribeWarrior', authorPlan: 'studio', downloads: 287, rating: 4.8, ratingCount: 43, tags: ['tribe', 'underground', 'raw'], isBuiltin: false, isFree: false, size: '22.1 MB', createdAt: '2024-04-15T00:00:00Z', comments: [] },
  { id: 'cp-3', name: 'Industrial FX Racks', description: 'Dark industrial FX chains for hard techno', type: 'fx-rack', genre: 'hard-techno', author: 'IndustrialMind', authorPlan: 'pro', downloads: 589, rating: 4.7, ratingCount: 92, tags: ['industrial', 'fx', 'dark'], isBuiltin: false, isFree: true, size: '2.8 MB', createdAt: '2024-05-01T00:00:00Z', comments: [] },
  { id: 'cp-4', name: 'Psychedelic Acid Patterns', description: 'Twisted 303 patterns for psychedelic acidcore', type: 'preset', genre: 'acidcore', author: 'PsychAcid', authorPlan: 'studio', downloads: 1023, rating: 4.9, ratingCount: 156, tags: ['psychedelic', 'acid', 'patterns'], isBuiltin: false, isFree: true, size: '0.7 MB', createdAt: '2024-05-10T00:00:00Z', comments: [] },
  { id: 'cp-5', name: 'Live Set Architect', description: 'Advanced live scene structures for 2+ hour sets', type: 'live-scene', genre: 'mentalcore', author: 'LiveMaster', authorPlan: 'studio', downloads: 234, rating: 4.5, ratingCount: 38, tags: ['live', 'set', 'advanced'], isBuiltin: false, isFree: false, size: '5.4 MB', createdAt: '2024-05-20T00:00:00Z', comments: [] },
];

const allPacks: Pack[] = [...BUILTIN_PACKS, ...communityPacks];

export function getBuiltinPacks(): Pack[] {
  return BUILTIN_PACKS;
}

export function getPacks(filters: PackFilters = {}): Pack[] {
  let result = [...allPacks];

  if (filters.type) result = result.filter((p) => p.type === filters.type);
  if (filters.genre) result = result.filter((p) => p.genre === filters.genre);
  if (filters.freeOnly) result = result.filter((p) => p.isFree);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  if (filters.sort === 'newest') result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  else if (filters.sort === 'top-rated') result.sort((a, b) => b.rating - a.rating);
  else result.sort((a, b) => b.downloads - a.downloads);

  return result;
}

export function getPackById(id: string): Pack | undefined {
  return allPacks.find((p) => p.id === id);
}

export function downloadPack(id: string): Pack | null {
  const pack = allPacks.find((p) => p.id === id);
  if (!pack) return null;
  pack.downloads += 1;
  return pack;
}

export function ratePack(id: string, rating: number): Pack | null {
  const pack = allPacks.find((p) => p.id === id);
  if (!pack) return null;
  const total = pack.rating * pack.ratingCount + rating;
  pack.ratingCount += 1;
  pack.rating = Math.round((total / pack.ratingCount) * 10) / 10;
  return pack;
}

export function addComment(id: string, userId: string, userName: string, content: string): PackComment | null {
  const pack = allPacks.find((p) => p.id === id);
  if (!pack) return null;
  const comment: PackComment = { id: uuidv4(), userId, userName, content, createdAt: new Date().toISOString() };
  pack.comments.push(comment);
  return comment;
}

export function getRecommendedPacks(genre?: string): Pack[] {
  let pool = [...allPacks];
  if (genre) pool = pool.filter((p) => p.genre === genre || p.isBuiltin);
  return pool.sort((a, b) => b.rating * b.downloads - a.rating * a.downloads).slice(0, 6);
}
