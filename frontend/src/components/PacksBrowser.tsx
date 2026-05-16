// ============================================================
// NEUROTEK AI — Packs Browser
// ============================================================
import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Search,
  Upload,
  TrendingUp,
  Clock,
  Star,
  Users,
  Cpu,
  X,
  Filter,
  ChevronDown,
  Layers,
  Disc,
  Music2,
  Radio,
  Sliders,
  Link,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PackCard, PackCardData } from './PackCard';
import { BUILTIN_PACKS, PACK_TYPE_COLORS, PackType } from '../data/builtinPacks';
import { useAppStore } from '../store/appStore';

// ─── Community Pack Data (inline for demo) ────────────────────
const COMMUNITY_PACKS: PackCardData[] = [
  {
    id: 'comm-001',
    name: 'Spiral Tribe Vibes',
    description: 'Raw spiral-tribe energy with free-party aesthetics. No BPM limits, pure chaos control.',
    author: 'DJSpirale',
    type: 'template',
    genre: ['tekno', 'tribe'],
    tags: ['freeParty', 'raw', 'chaos'],
    downloads: 847,
    rating: 4.6,
    ratingCount: 89,
    isBuiltin: false,
    isFree: true,
    fileSize: '3.2 MB',
    version: '1.0.0',
  },
  {
    id: 'comm-002',
    name: 'Psytek Brain Melter',
    description: 'Psychedelic tekno with FM synthesis, morphing basslines and brain-twisting arpeggios.',
    author: 'PsyTekMaster',
    type: 'template',
    genre: ['psytek', 'hard-techno'],
    tags: ['psychedelic', 'fm', 'arpeggios'],
    downloads: 1204,
    rating: 4.7,
    ratingCount: 134,
    isBuiltin: false,
    isFree: true,
    fileSize: '4.1 MB',
    version: '2.1.0',
  },
  {
    id: 'comm-003',
    name: 'Berlin Steel Drums',
    description: 'Industrial techno drum kit inspired by Berlin warehouse raves. Steel percussion and mechanical rhythms.',
    author: 'WallBreaker_T',
    type: 'drumKit',
    genre: ['industrial', 'hard-techno'],
    tags: ['berlin', 'industrial', 'steel'],
    downloads: 2103,
    rating: 4.8,
    ratingCount: 278,
    isBuiltin: false,
    isFree: false,
    fileSize: '5.7 MB',
    version: '1.5.0',
  },
  {
    id: 'comm-004',
    name: 'Neurofunk Bass Clinic',
    description: 'Deep neurofunk bass design patches. Reese basses, wobblers and modulated sub frequencies.',
    author: 'NF_Engineer',
    type: 'preset',
    genre: ['neurofunk'],
    tags: ['neurofunk', 'bass', 'reese'],
    downloads: 789,
    rating: 4.4,
    ratingCount: 67,
    isBuiltin: false,
    isFree: false,
    fileSize: '2.0 MB',
    version: '1.0.0',
  },
  {
    id: 'comm-005',
    name: 'AI Arrangement Helper',
    description: 'AI workflow for automatic arrangement suggestions. Drop detection, build analysis and transition hints.',
    author: 'AI_Producer',
    type: 'aiWorkflow',
    genre: ['all'],
    tags: ['ai', 'arrangement', 'drop'],
    downloads: 3412,
    rating: 4.9,
    ratingCount: 445,
    isBuiltin: false,
    isFree: false,
    fileSize: '0.4 MB',
    version: '1.3.0',
  },
  {
    id: 'comm-006',
    name: 'Hardtek Kick Therapy',
    description: '50+ hardtek kick samples with layering guide. Distorted, punchy and festival-ready.',
    author: 'KickDoctor',
    type: 'drumKit',
    genre: ['hardtek'],
    tags: ['hardtek', 'kick', 'distortion'],
    downloads: 1678,
    rating: 4.7,
    ratingCount: 203,
    isBuiltin: false,
    isFree: true,
    fileSize: '8.1 MB',
    version: '3.0.0',
  },
  {
    id: 'comm-007',
    name: 'Festival Live Rig',
    description: 'Complete live rig template. 12 scenes, DJ transitions and emergency stop buttons for real festivals.',
    author: 'LiveRig_Pro',
    type: 'liveScene',
    genre: ['hardtek', 'tribe', 'mentalcore'],
    tags: ['live', 'festival', 'rig'],
    downloads: 982,
    rating: 4.6,
    ratingCount: 112,
    isBuiltin: false,
    isFree: false,
    fileSize: '6.3 MB',
    version: '2.0.0',
  },
  {
    id: 'comm-008',
    name: 'Acid Resonance FX',
    description: 'Resonant acid FX chain. Filter sweeps, LFO modulation and distortion routing for 303-style sounds.',
    author: 'AcidWizard',
    type: 'fxRack',
    genre: ['acidcore'],
    tags: ['acid', 'resonance', 'filter'],
    downloads: 1456,
    rating: 4.8,
    ratingCount: 167,
    isBuiltin: false,
    isFree: true,
    fileSize: '0.6 MB',
    version: '1.2.0',
  },
  {
    id: 'comm-009',
    name: 'Mastering Chain Studio',
    description: 'Professional mastering chain for tekno and hardtek. Optimized for streaming and festival sound systems.',
    author: 'MasterMind_DE',
    type: 'chain',
    genre: ['all'],
    tags: ['mastering', 'loudness', 'limiter'],
    downloads: 2765,
    rating: 4.9,
    ratingCount: 389,
    isBuiltin: false,
    isFree: false,
    fileSize: '0.3 MB',
    version: '4.0.0',
  },
  {
    id: 'comm-010',
    name: 'Darkroom Mentalcore',
    description: 'Dark and claustrophobic mentalcore template. Sub-bass terror with industrial percussion walls.',
    author: 'DarkMental',
    type: 'template',
    genre: ['mentalcore', 'industrial'],
    tags: ['dark', 'claustrophobic', 'terror'],
    downloads: 1123,
    rating: 4.5,
    ratingCount: 98,
    isBuiltin: false,
    isFree: true,
    fileSize: '3.9 MB',
    version: '1.0.0',
  },
  {
    id: 'comm-011',
    name: 'Tekno Travel Kit',
    description: 'Minimal tekno template inspired by nomadic raves. Repetitive hypnotic patterns for long sets.',
    author: 'TravelerTekno',
    type: 'template',
    genre: ['tekno'],
    tags: ['tekno', 'minimal', 'hypnotic'],
    downloads: 654,
    rating: 4.3,
    ratingCount: 54,
    isBuiltin: false,
    isFree: true,
    fileSize: '2.5 MB',
    version: '1.0.0',
  },
  {
    id: 'comm-012',
    name: 'AI Mix Analyser',
    description: 'AI-powered workflow that scans your mix for frequency conflicts and suggests corrective EQ moves.',
    author: 'MixMind_AI',
    type: 'aiWorkflow',
    genre: ['all'],
    tags: ['ai', 'mix', 'eq'],
    downloads: 2341,
    rating: 4.8,
    ratingCount: 312,
    isBuiltin: false,
    isFree: false,
    fileSize: '0.5 MB',
    version: '1.1.0',
  },
];

// ─── Category config ──────────────────────────────────────────
const CATEGORIES = [
  { id: 'all', labelKey: 'packs.categories.all', icon: <Package size={13} /> },
  { id: 'template', labelKey: 'packs.categories.templates', icon: <Layers size={13} /> },
  { id: 'fxRack', labelKey: 'packs.categories.fxRacks', icon: <Sliders size={13} /> },
  { id: 'drumKit', labelKey: 'packs.categories.drumKits', icon: <Disc size={13} /> },
  { id: 'liveScene', labelKey: 'packs.categories.liveScenes', icon: <Radio size={13} /> },
  { id: 'preset', labelKey: 'packs.categories.presets', icon: <Music2 size={13} /> },
  { id: 'chain', labelKey: 'packs.categories.chains', icon: <Link size={13} /> },
  { id: 'aiWorkflow', labelKey: 'packs.categories.aiWorkflows', icon: <Zap size={13} /> },
];

type Tab = 'builtin' | 'community' | 'mine';
type SortMode = 'trending' | 'newest' | 'topRated';

const skeletonCount = 6;

export function PacksBrowser() {
  const { t } = useTranslation();
  const { auth } = useAppStore();

  const [tab, setTab] = useState<Tab>('builtin');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [sort, setSort] = useState<SortMode>('trending');
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [loading] = useState(false);

  const builtinAsCards: PackCardData[] = BUILTIN_PACKS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    author: p.author,
    type: p.type,
    genre: p.genre,
    tags: p.tags,
    downloads: p.downloads,
    rating: p.rating,
    ratingCount: p.ratingCount,
    isBuiltin: true,
    isFree: true,
    fileSize: p.fileSize,
    version: p.version,
  }));

  const sourcePacks = tab === 'builtin' ? builtinAsCards : tab === 'mine' ? [] : COMMUNITY_PACKS;

  const filteredPacks = useMemo(() => {
    let result = sourcePacks.filter((p) => {
      if (category !== 'all' && p.type !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        const target = [p.name, p.description, p.author, ...p.tags, ...p.genre].join(' ').toLowerCase();
        if (!target.includes(q)) return false;
      }
      return true;
    });

    if (sort === 'trending') result = result.sort((a, b) => b.downloads - a.downloads);
    else if (sort === 'newest') result = result; // already ordered by recency in data
    else if (sort === 'topRated') result = result.sort((a, b) => b.rating - a.rating);

    return result;
  }, [sourcePacks, category, search, sort]);

  const handleDownload = useCallback((id: string) => {
    setDownloadedIds((prev) => new Set([...prev, id]));
  }, []);

  const isPremium = auth.user?.plan !== 'free';

  const tabs: { id: Tab; labelKey: string; icon: React.ReactNode }[] = [
    { id: 'builtin', labelKey: 'packs.builtin', icon: <Cpu size={14} /> },
    { id: 'community', labelKey: 'packs.community', icon: <Users size={14} /> },
    { id: 'mine', labelKey: 'packs.myPacks', icon: <Package size={14} /> },
  ];

  const sorts: { id: SortMode; labelKey: string; icon: React.ReactNode }[] = [
    { id: 'trending', labelKey: 'packs.trending', icon: <TrendingUp size={12} /> },
    { id: 'newest', labelKey: 'packs.newest', icon: <Clock size={12} /> },
    { id: 'topRated', labelKey: 'packs.topRated', icon: <Star size={12} /> },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex-shrink-0 px-6 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <Package size={20} style={{ color: '#10b981' }} />
              {t('packs.title')}
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              {filteredPacks.length} {filteredPacks.length === 1 ? 'pack' : 'packs'} available
            </p>
          </div>

          {/* Upload button */}
          {tab === 'community' && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: isPremium ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                border: isPremium ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)',
                color: isPremium ? '#10b981' : '#6b7280',
              }}
            >
              <Upload size={14} />
              {t('packs.uploadPack')}
              {!isPremium && <span className="text-[9px] text-yellow-400 ml-1">PRO</span>}
            </motion.button>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-4">
          {tabs.map((tabItem) => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={
                tab === tabItem.id
                  ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }
                  : { background: 'transparent', border: '1px solid transparent', color: '#6b7280' }
              }
            >
              {tabItem.icon}
              {t(tabItem.labelKey)}
            </button>
          ))}
        </div>

        {/* Search + Sort row */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('packs.search')}
              className="w-full h-8 pl-8 pr-8 rounded-lg text-xs bg-transparent text-text-primary placeholder-text-muted outline-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1">
            {sorts.map((s) => (
              <button
                key={s.id}
                onClick={() => setSort(s.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                style={
                  sort === s.id
                    ? { background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa' }
                    : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#6b7280' }
                }
              >
                {s.icon}
                <span className="hidden sm:inline">{t(s.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category chips */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-6 py-3 overflow-x-auto"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = category === cat.id;
          const color = cat.id !== 'all' ? PACK_TYPE_COLORS[cat.id as PackType] : '#6b7280';
          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all flex-shrink-0"
              style={
                isActive
                  ? { background: `${color}20`, border: `1px solid ${color}35`, color }
                  : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#6b7280' }
              }
            >
              {cat.icon}
              {t(cat.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Pack grid */}
      <div className="flex-1 overflow-y-auto scroll-area px-6 py-4">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              {Array.from({ length: skeletonCount }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 rounded-xl animate-pulse"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}
                />
              ))}
            </motion.div>
          ) : tab === 'mine' ? (
            <motion.div
              key="mine-empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                <Package size={28} style={{ color: '#10b981' }} />
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">{t('packs.myPacks')}</h3>
              <p className="text-xs text-text-muted max-w-xs">
                You haven't downloaded any packs yet. Browse the Built-in or Community packs to get started.
              </p>
            </motion.div>
          ) : filteredPacks.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <Search size={32} className="text-text-muted mb-3" />
              <p className="text-sm text-text-muted">No packs found for "{search}"</p>
              <button onClick={() => { setSearch(''); setCategory('all'); }} className="mt-2 text-xs text-accent-primary hover:underline">
                Clear filters
              </button>
            </motion.div>
          ) : (
            <motion.div
              key={`${tab}-${category}-${sort}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              {filteredPacks.map((pack, idx) => (
                <motion.div
                  key={pack.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.2 }}
                >
                  <PackCard
                    pack={pack}
                    onDownload={handleDownload}
                    downloaded={downloadedIds.has(pack.id)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowUploadModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-2xl p-6"
              style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Upload size={16} style={{ color: '#10b981' }} />
                  {t('packs.uploadPack')}
                </h2>
                <button onClick={() => setShowUploadModal(false)} className="text-text-muted hover:text-text-primary">
                  <X size={16} />
                </button>
              </div>

              {!isPremium ? (
                <div
                  className="rounded-xl p-4 text-center"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
                >
                  <p className="text-sm text-yellow-400 font-semibold mb-2">PRO Feature</p>
                  <p className="text-xs text-text-muted">
                    Uploading community packs requires a Pro or Studio plan.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-text-muted mb-1.5 block">Pack Name</label>
                    <input
                      type="text"
                      placeholder="My Awesome Pack"
                      className="w-full h-9 px-3 rounded-lg text-sm text-text-primary placeholder-text-muted outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted mb-1.5 block">Description</label>
                    <textarea
                      placeholder="Describe your pack..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg text-sm text-text-primary placeholder-text-muted outline-none resize-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                  </div>
                  <div
                    className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors"
                    style={{ borderColor: 'rgba(16,185,129,0.3)' }}
                  >
                    <Upload size={24} className="mx-auto mb-2" style={{ color: '#10b981' }} />
                    <p className="text-sm text-text-muted">Drop your pack files here</p>
                    <p className="text-xs text-text-muted mt-1">.zip up to 50MB</p>
                  </div>
                  <button
                    className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.35)', color: '#10b981' }}
                  >
                    Upload Pack
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
